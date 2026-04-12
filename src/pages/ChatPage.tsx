import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { ChatMessage, ChatInput } from '../components/Chat';
import { Bot, Sparkles, Loader2, Wallet, FileText, User, Settings, Trash2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { auth, addChatMessage, getChatMessages, getDocuments, getUserSettings, clearChatHistory } from '../firebase';
import { generateRagResponse } from '../services/ragService';
import { BookingState, processBookingIntent, saveBooking, validateConstraints } from '../services/bookingService';
import { BookingConfirmationModal } from '../components/BookingConfirmationModal';
import { GoogleGenAI } from "@google/genai";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [useRag, setUseRag] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bookingState, setBookingState] = useState<BookingState>({
    type: null,
    collectedData: {},
    missingFields: [],
    isComplete: false
  });
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
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

    const userMsg = { 
      userId,
      role: 'user' as const, 
      content 
    };
    
    await addChatMessage(userId, userMsg);
    setIsLoading(true);

    try {
      let aiResponse = "";

      // 1. Process Booking Intent
      const updatedBooking = await processBookingIntent(content, bookingState, settings?.customInstructions || "");
      
      if (updatedBooking.type) {
        setBookingState(updatedBooking);
        
        if (updatedBooking.isComplete) {
          // Validate constraints before showing modal
          const validation = await validateConstraints(updatedBooking.type, updatedBooking.collectedData);
          if (validation.valid) {
            setIsBookingModalOpen(true);
            aiResponse = `Great! I've collected all the details for your ${updatedBooking.type} booking. Please review the confirmation summary that just popped up.`;
          } else {
            aiResponse = `I've collected your details, but there's an issue: ${validation.message}. How would you like to proceed?`;
          }
        } else {
          // Ask for missing fields
          const nextField = updatedBooking.missingFields[0].replace(/_/g, ' ');
          aiResponse = `I'm helping you with your ${updatedBooking.type} booking. Could you please provide the **${nextField}**?`;
        }
      } else if (useRag) {
        // Use the RAG pipeline for general document data
        aiResponse = await generateRagResponse(userId, content, messages);
      } else {
        // Fallback to general chat with document context
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
        
        const context = documents
          .filter(doc => doc.status === 'Processed')
          .map(doc => `Source: ${doc.name}\nContent: ${doc.content || ''}`)
          .join('\n\n---\n\n');

        const systemInstruction = `
          You are a helpful AI assistant.
          ${settings?.customInstructions || ''}
          
          Use the following context from the user's uploaded documents to answer their questions.
          
          Context:
          ${context}
        `;

        const result = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ role: 'user', parts: [{ text: content }] }],
          config: {
            systemInstruction: systemInstruction,
          },
        });
        aiResponse = result.text;
      }

      const aiMsg = {
        userId,
        role: 'assistant' as const,
        content: aiResponse || "I'm sorry, I couldn't generate a response."
      };

      await addChatMessage(userId, aiMsg);
    } catch (error) {
      console.error('Error generating AI response:', error);
      const errorMsg = {
        userId,
        role: 'assistant' as const,
        content: "I encountered an error while processing your request. Please ensure your documents are indexed and try again."
      };
      await addChatMessage(userId, errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!auth.currentUser) return;
    setIsLoading(true);
    try {
      await clearChatHistory(auth.currentUser.uid);
      setShowDeleteConfirm(false);
      setBookingState({ type: null, collectedData: {}, missingFields: [], isComplete: false });
    } catch (error) {
      console.error('Error clearing chat history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!auth.currentUser || !bookingState.type) return;
    setIsLoading(true);
    try {
      await saveBooking(auth.currentUser.uid, bookingState.type, bookingState.collectedData);
      setIsBookingModalOpen(false);
      
      const successMsg = {
        userId: auth.currentUser.uid,
        role: 'assistant' as const,
        content: `✅ **Booking Confirmed!** Your ${bookingState.type} reservation has been successfully saved. A notification has been sent to the business owner.`
      };
      await addChatMessage(auth.currentUser.uid, successMsg);
      
      // Reset booking state
      setBookingState({ type: null, collectedData: {}, missingFields: [], isComplete: false });
    } catch (error) {
      console.error('Error confirming booking:', error);
    } finally {
      setIsLoading(false);
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
          {messages.length > 0 && (
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Clear Chat History"
            >
              <Trash2 className="w-4 h-4" />
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 scroll-smooth relative">
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-white border border-gray-100 shadow-xl rounded-2xl p-6 max-w-sm w-full animate-in zoom-in-95 duration-200">
              <h4 className="text-lg font-bold text-gray-900 mb-2">Clear Chat History?</h4>
              <p className="text-sm text-gray-500 mb-6">
                This will permanently delete all messages in this conversation. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 text-sm font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleClearHistory}
                  className="flex-1 px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-sm shadow-red-200"
                >
                  Delete All
                </button>
              </div>
            </div>
          </div>
        )}
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

      <BookingConfirmationModal 
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        onConfirm={handleConfirmBooking}
        bookingData={bookingState.collectedData}
        type={bookingState.type as 'restaurant' | 'hotel'}
      />
    </div>
  );
};
