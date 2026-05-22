import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { ChatMessage, ChatInput } from '../components/Chat';
import { Bot, Sparkles, Loader2, Wallet, FileText, User, Settings, Trash2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { auth, addChatMessage, getChatMessages, getDocuments, getUserSettings, clearChatHistory, addReservation, incrementMessageUsage, incrementBookingUsage, logEvent } from '../firebase';
import { getNextStep, validateReservationField, checkAvailability, suggestAlternatives } from '../services/reservationService';
import { ReservationState, ReservationDraft, ReservationStep, PLANS } from '../types';
import { ReservationWidget } from '../components/ReservationWidget';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: { url: string; alt: string }[];
  isReservationWidget?: boolean;
}

export const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [useRag, setUseRag] = useState(true);
  
  // Reservation State
  const [reservationState, setReservationState] = useState<ReservationState>({
    step: 'ask_guests',
    data: { guests: null, date: null, time: null, name: null, phone: null },
    isActive: false
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const userId = auth.currentUser.uid;

    // Fetch chat history
    const unsubscribeChat = getChatMessages(userId, (msgs) => {
      setMessages(msgs);
    });

    // Fetch documents for context
    const unsubscribeDocs = getDocuments(userId, (docs) => {
      setDocuments(docs);
    });

    // Fetch settings
    const unsubscribeSettings = getUserSettings(userId, (s) => {
      setSettings(s);
    });

    return () => {
      unsubscribeChat();
      unsubscribeDocs();
      unsubscribeSettings();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (content: string) => {
    if (!auth.currentUser || !content.trim()) return;

    const userId = auth.currentUser.uid;
    const userMsg = { userId, role: 'user' as const, content };
    await addChatMessage(userId, userMsg);
    logEvent(userId, 'message', `User sent message: ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}`);
    setIsLoading(true);

    try {
      const plan = PLANS[settings?.subscriptionPlan] || PLANS.free;
      const usage = settings?.usage || { messages_this_month: 0, bookings_this_month: 0 };

      // Check message limit
      if (usage.messages_this_month >= plan.max_messages_per_month) {
        await addAssistantMessage(userId, "You’ve reached your monthly message limit. Upgrade to continue.");
        setIsLoading(false);
        return;
      }

      // 1. Check if we should enter or continue reservation flow
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
          
          await addAssistantMessage(userId, getStepMessage(nextStep, newState.data));
          setIsLoading(false);
          return;
        }
      }

      // 2. Handle active reservation flow
      if (reservationState.isActive) {
        const extractRes = await fetch('/api/reservation/extract-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content, currentDraft: reservationState.data })
        });
        const extracted = await extractRes.json();
        const updatedData = { ...reservationState.data, ...extracted };
        
        // Validate specifically the field we might have just gotten
        let validationError = "";
        for (const [key, value] of Object.entries(extracted)) {
          const validation = validateReservationField(key as any, value, settings);
          if (!validation.valid) {
            validationError = validation.message || "Invalid input.";
            break;
          }
        }

        if (validationError) {
          await addAssistantMessage(userId, validationError);
          setIsLoading(false);
          return;
        }

        const nextStep = getNextStep(updatedData);
        
        // If we have date, time, and guests, check availability
        if (updatedData.guests && updatedData.date && updatedData.time) {
          const { available } = await checkAvailability(userId, updatedData.guests, updatedData.date, updatedData.time, settings);
          if (!available) {
            const alternatives = await suggestAlternatives(userId, updatedData.guests, updatedData.date, updatedData.time, settings);
            const altMsg = alternatives.length > 0 
              ? `Sorry, we are fully booked for ${updatedData.time}. However, we have availability at: ${alternatives.join(', ')}. Which one would you prefer?`
              : `Sorry, we are fully booked for that time and no nearby slots are available. Would you like to try another date?`;
            
            // Revert the time so it asks again
            updatedData.time = null;
            setReservationState({ ...reservationState, data: updatedData, step: 'ask_time' });
            await addAssistantMessage(userId, altMsg);
            setIsLoading(false);
            return;
          }
        }

        setReservationState({
          ...reservationState,
          data: updatedData,
          step: nextStep
        });

        await addAssistantMessage(userId, getStepMessage(nextStep, updatedData));
        setIsLoading(false);
        return;
      }

      // 3. Normal RAG flow
      let aiResponseText = "";
      let aiImages: { url: string; alt: string }[] = [];

      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: userId,
          message: content,
          useRag: useRag,
          documents: documents,
          customInstructions: settings?.customInstructions
        })
      });
      const chatData = await chatResponse.json();
      if (chatData.error) throw new Error(chatData.error);
      aiResponseText = chatData.text;
      aiImages = chatData.images || [];

      await incrementMessageUsage(userId);

      await addChatMessage(userId, {
        userId,
        role: 'assistant',
        content: aiResponseText || "I'm sorry, I couldn't generate a response.",
        images: aiImages
      });
    } catch (error) {
      console.error('Error in chat processing:', error);
      await addAssistantMessage(userId, "I encountered an error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const addAssistantMessage = async (userId: string, content: string) => {
    await addChatMessage(userId, {
      userId,
      role: 'assistant',
      content
    });
  };

  const getStepMessage = (step: ReservationStep, data: ReservationDraft): string => {
    switch (step) {
      case 'ask_guests': return "How many guests will be joining us?";
      case 'ask_date': return "For which date would you like to book?";
      case 'ask_time': return "What time would you like to arrive?";
      case 'ask_name': return "Under what name should I place the reservation?";
      case 'ask_phone': return "Could I have a contact phone number for the booking?";
      case 'confirm': return "Great! I have all the details. Please review and confirm your reservation below:";
      case 'completed': return "Your reservation has been confirmed! We look forward to seeing you.";
      default: return "How can I help you today?";
    }
  };

  const handleConfirmReservation = async () => {
    if (!auth.currentUser || !reservationState.data.guests || !reservationState.data.date || !reservationState.data.time || !reservationState.data.name || !reservationState.data.phone) return;
    
    setIsLoading(true);
    try {
      const userId = auth.currentUser.uid;
      const plan = PLANS[settings?.subscriptionPlan] || PLANS.free;
      const usage = settings?.usage || { messages_this_month: 0, bookings_this_month: 0 };

      if (usage.bookings_this_month >= plan.max_bookings_per_month) {
        await addAssistantMessage(userId, "You’ve reached your monthly booking limit. Upgrade to accept more reservations.");
        setIsLoading(false);
        return;
      }

      const startTime = reservationState.data.time;
      const [h, m] = startTime.split(':').map(Number);
      const startVal = h * 60 + m;
      const endVal = startVal + settings.reservationDuration;
      const endTime = `${Math.floor(endVal / 60).toString().padStart(2, '0')}:${(endVal % 60).toString().padStart(2, '0')}`;

      await addReservation({
        business_id: auth.currentUser.uid,
        guests: reservationState.data.guests,
        date: reservationState.data.date,
        start_time: startTime,
        end_time: endTime,
        status: 'confirmed',
        customer_name: reservationState.data.name,
        customer_phone: reservationState.data.phone
      });

      logEvent(auth.currentUser.uid, 'booking', `New reservation confirmed for ${reservationState.data.name} on ${reservationState.data.date}`, {
        guests: reservationState.data.guests,
        time: startTime
      });

      await incrementBookingUsage(auth.currentUser.uid);

      setReservationState({
        isActive: false,
        step: 'completed',
        data: { guests: null, date: null, time: null, name: null, phone: null }
      });

      await addAssistantMessage(auth.currentUser.uid, "Thank you! Your booking is secured. I've sent a notification to the manager.");
    } catch (e) {
      console.error("Booking failed", e);
      alert("Failed to confirm reservation. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelReservation = () => {
    setReservationState({
      isActive: false,
      step: 'ask_guests',
      data: { guests: null, date: null, time: null, name: null, phone: null }
    });
  };

  const handleEditReservation = (field: keyof ReservationDraft, value: any) => {
    setReservationState({
      ...reservationState,
      data: { ...reservationState.data, [field]: value }
    });
  };

  const handleClearHistory = async () => {
    if (!auth.currentUser) return;

    setIsClearing(true);
    try {
      await clearChatHistory(auth.currentUser.uid);
      logEvent(auth.currentUser.uid, 'system', 'Chat history cleared by user');
      setShowConfirmClear(false);
    } catch (error) {
      console.error('Error clearing chat history:', error);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col max-w-4xl mx-auto bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Chat Header */}
      <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Bot className="text-white w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Knowledge Assistant</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Online</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {showConfirmClear ? (
            <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-100 animate-in fade-in zoom-in duration-200">
              <button 
                onClick={handleClearHistory}
                disabled={isClearing}
                className="px-3 py-1.5 bg-red-600 text-white rounded-md text-[10px] font-bold uppercase hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isClearing ? "Clearing..." : "Confirm"}
              </button>
              <button 
                onClick={() => setShowConfirmClear(false)}
                disabled={isClearing}
                className="px-3 py-1.5 bg-white text-gray-600 border border-gray-200 rounded-md text-[10px] font-bold uppercase hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowConfirmClear(true)}
              disabled={isClearing || messages.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Clear Chat History"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
          <button 
            onClick={() => setUseRag(!useRag)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
              useRag 
              ? "bg-indigo-50 text-indigo-600 border border-indigo-100" 
              : "bg-gray-50 text-gray-400 border border-gray-100"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            RAG Mode: {useRag ? 'ON' : 'OFF'}
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold">
            <FileText className="w-3.5 h-3.5" />
            {documents.length} Sources
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 scroll-smooth">
        {messages.length === 0 && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-4">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <Bot className="w-8 h-8 text-indigo-600" />
            </div>
            <div className="max-w-xs">
              <h3 className="text-lg font-bold text-gray-900">Knowledge Base AI</h3>
              <p className="text-sm text-gray-500 mt-1">
                Ask anything about your uploaded documents, PDFs, and websites.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full max-w-sm pt-4">
              <button 
                onClick={() => handleSend("Summarize my uploaded documents.")}
                className="text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-medium text-gray-600 transition-colors border border-gray-100"
              >
                "Summarize my uploaded documents."
              </button>
              <button 
                onClick={() => handleSend("What are the key takeaways from the latest file?")}
                className="text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-medium text-gray-600 transition-colors border border-gray-100"
              >
                "What are the key takeaways from the latest file?"
              </button>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {reservationState.isActive && reservationState.step === 'confirm' && (
          <div className="flex justify-start mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <ReservationWidget 
              draft={reservationState.data}
              onConfirm={handleConfirmReservation}
              onCancel={handleCancelReservation}
              onEdit={handleEditReservation}
              isLoading={isLoading}
            />
          </div>
        )}
        {isLoading && (
          <div className="flex justify-start mb-6 animate-pulse">
            <div className="bg-white border border-gray-100 px-5 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span className="text-xs font-medium text-gray-500">Analyzing your documents...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-6 bg-gray-50/30 border-t border-gray-50">
        <ChatInput onSend={handleSend} isLoading={isLoading} />
        <p className="text-[10px] text-center text-gray-400 mt-3 uppercase tracking-widest font-bold">
          AI can make mistakes. Verify important info.
        </p>
      </div>
    </div>
  );
};
