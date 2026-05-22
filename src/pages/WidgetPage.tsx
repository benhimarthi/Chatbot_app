import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChatMessage, ChatInput } from '../components/Chat';
import { Bot, Loader2, X } from 'lucide-react';
import { getUserSettings, addChatMessage, addReservation, incrementMessageUsage, incrementBookingUsage } from '../firebase';
import { getNextStep, validateReservationField, checkAvailability, suggestAlternatives } from '../services/reservationService';
import { ReservationState, ReservationDraft, ReservationStep, PLANS, UserSettings } from '../types';
import { ReservationWidget } from '../components/ReservationWidget';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: { url: string; alt: string }[];
}

export const WidgetPage = () => {
  const [searchParams] = useSearchParams();
  const appId = searchParams.get('appId');
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reservationState, setReservationState] = useState<ReservationState>({
    step: 'ask_guests',
    data: { guests: null, date: null, time: null, name: null, phone: null },
    isActive: false
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!appId) return;

    // Fetch settings for the specific appId (client's userId)
    const unsubscribeSettings = getUserSettings(appId, (s) => {
      setSettings(s);
    });

    // We don't fetch chat history for the widget as it should be ephemeral per session
    // but we could use local storage if we wanted persistence
    const savedMessages = sessionStorage.getItem(`chat_${appId}`);
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    } else {
      // Add welcome message
      const welcome = {
        id: 'welcome',
        role: 'assistant' as const,
        content: `Hello! How can I help you today?`
      };
      setMessages([welcome]);
    }

    return () => unsubscribeSettings();
  }, [appId]);

  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem(`chat_${appId}`, JSON.stringify(messages));
    }
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, appId]);

  const handleSend = async (content: string) => {
    if (!appId || !content.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const plan = PLANS[settings?.subscriptionPlan] || PLANS.free;
      const usage = settings?.usage || { messages_this_month: 0, bookings_this_month: 0 };

      // 1. Check message limit
      if (usage.messages_this_month >= plan.max_messages_per_month) {
        addAssistantMessage("This chatbot has reached its monthly message limit. Please contact the business owner.");
        setIsLoading(false);
        return;
      }

      // 2. Booking logic
      if (settings?.bookingEnabled && !reservationState.isActive) {
        const intentRes = await fetch('/api/reservation/detect-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content })
        });
        const { isBooking } = await intentRes.json();

        if (isBooking) {
          const extractRes = await fetch('/api/reservation/extract-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: content, currentDraft: reservationState.data })
          });
          const extracted = await extractRes.json();

          const newState = {
            ...reservationState,
            isActive: true,
            data: { ...reservationState.data, ...extracted }
          };
          const nextStep = getNextStep(newState.data);
          newState.step = nextStep;
          setReservationState(newState);
          
          addAssistantMessage(getStepMessage(nextStep));
          setIsLoading(false);
          return;
        }
      }

      if (reservationState.isActive) {
        const extractRes = await fetch('/api/reservation/extract-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content, currentDraft: reservationState.data })
        });
        const extracted = await extractRes.json();
        const updatedData = { ...reservationState.data, ...extracted };
        
        let validationError = "";
        for (const [key, value] of Object.entries(extracted)) {
          const validation = validateReservationField(key as any, value, settings);
          if (!validation.valid) {
            validationError = validation.message || "Invalid input.";
            break;
          }
        }

        if (validationError) {
          addAssistantMessage(validationError);
          setIsLoading(false);
          return;
        }

        const nextStep = getNextStep(updatedData);
        
        if (updatedData.guests && updatedData.date && updatedData.time) {
          const { available } = await checkAvailability(appId, updatedData.guests, updatedData.date, updatedData.time, settings);
          if (!available) {
            const alternatives = await suggestAlternatives(appId, updatedData.guests, updatedData.date, updatedData.time, settings);
            const altMsg = alternatives.length > 0 
              ? `Sorry, we are fully booked for ${updatedData.time}. However, we have availability at: ${alternatives.join(', ')}. Which one would you prefer?`
              : `Sorry, we are fully booked for that time and no nearby slots are available.`;
            
            updatedData.time = null;
            setReservationState({ ...reservationState, data: updatedData, step: 'ask_time' });
            addAssistantMessage(altMsg);
            setIsLoading(false);
            return;
          }
        }

        setReservationState({ ...reservationState, data: updatedData, step: nextStep });
        addAssistantMessage(getStepMessage(nextStep));
        setIsLoading(false);
        return;
      }

      // 2. RAG Flow
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: appId,
          message: content,
          useRag: true
        })
      });
      const response = await chatResponse.json();
      if (response.error) throw new Error(response.error);
      
      // Increment message usage
      await incrementMessageUsage(appId);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text || "I'm sorry, I couldn't find information about that.",
        images: response.images
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error('Widget chat error:', error);
      addAssistantMessage("I'm sorry, I'm having trouble connecting right now.");
    } finally {
      setIsLoading(false);
    }
  };

  const addAssistantMessage = (content: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content }]);
  };

  const getStepMessage = (step: ReservationStep): string => {
    switch (step) {
      case 'ask_guests': return "How many guests?";
      case 'ask_date': return "For which date?";
      case 'ask_time': return "At what time?";
      case 'ask_name': return "Under what name?";
      case 'ask_phone': return "And your phone number?";
      case 'confirm': return "Does this look correct?";
      case 'completed': return "Perfect! Your reservation is confirmed.";
      default: return "";
    }
  };

  const handleConfirmReservation = async () => {
    if (!appId || !reservationState.data.guests || !reservationState.data.date || !reservationState.data.time || !reservationState.data.name || !reservationState.data.phone) return;
    
    setIsLoading(true);
    try {
      const plan = PLANS[settings?.subscriptionPlan] || PLANS.free;
      const usage = settings?.usage || { messages_this_month: 0, bookings_this_month: 0 };

      if (usage.bookings_this_month >= plan.max_bookings_per_month) {
        addAssistantMessage("Sorry, we've reached our booking limit for this month. Please call us directly.");
        setIsLoading(false);
        return;
      }

      const startTime = reservationState.data.time;
      const [h, m] = startTime.split(':').map(Number);
      const startVal = h * 60 + m;
      const endVal = startVal + (settings.reservationDuration || 90);
      const endTime = `${Math.floor(endVal / 60).toString().padStart(2, '0')}:${(endVal % 60).toString().padStart(2, '0')}`;

      await addReservation({
        business_id: appId,
        guests: reservationState.data.guests,
        date: reservationState.data.date,
        start_time: startTime,
        end_time: endTime,
        status: 'confirmed',
        customer_name: reservationState.data.name,
        customer_phone: reservationState.data.phone
      });

      // Increment booking usage
      await incrementBookingUsage(appId);

      setReservationState({
        isActive: false,
        step: 'completed',
        data: { guests: null, date: null, time: null, name: null, phone: null }
      });

      addAssistantMessage("Thank you! Your table is reserved.");
    } catch (e) {
      addAssistantMessage("I'm sorry, I couldn't save your reservation. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!appId) {
    return (
      <div className="h-screen flex items-center justify-center p-6 text-center text-gray-400">
        Configuration error: appId is missing.
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 bg-white">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <Bot className="text-white w-5 h-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-sm font-bold text-gray-900">{settings?.businessName || 'Chat Assistant'}</h1>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Online</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {reservationState.isActive && reservationState.step === 'confirm' && (
          <div className="flex justify-start">
            <ReservationWidget 
              draft={reservationState.data}
              onConfirm={handleConfirmReservation}
              onCancel={() => setReservationState({ ...reservationState, isActive: false })}
              onEdit={(field, val) => setReservationState({ ...reservationState, data: { ...reservationState.data, [field]: val }})}
              isLoading={isLoading}
            />
          </div>
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-50 px-4 py-2 rounded-2xl rounded-bl-none flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
              <span className="text-[10px] text-gray-400">Typing...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-50 bg-gray-50/50">
        <ChatInput onSend={handleSend} isLoading={isLoading} />
        <div className="mt-2 text-center">
          <span className="text-[8px] text-gray-300 uppercase tracking-widest font-bold">Powered by Chat<span className="text-indigo-400">Flow</span></span>
        </div>
      </div>
    </div>
  );
};
