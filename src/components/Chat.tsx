import * as React from 'react';
import { Send, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: { url: string; alt: string }[];
}

export const ChatMessage = ({ message }: { message: Message; key?: string }) => {
  const isAssistant = message.role === 'assistant';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex w-full mb-6',
        isAssistant ? 'justify-start' : 'justify-end'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-sm',
          isAssistant
            ? 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
            : 'bg-indigo-600 text-white rounded-br-none'
        )}
      >
        {isAssistant ? (
          <div className="space-y-4">
            <div className="markdown-body prose prose-sm max-w-none prose-indigo">
              <Markdown>{message.content}</Markdown>
            </div>
            
            {message.images && message.images.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-50">
                {message.images.map((img, idx) => (
                  <div key={idx} className="group relative rounded-xl overflow-hidden bg-gray-50 border border-gray-100 aspect-video">
                    <img 
                      src={img.url} 
                      alt={img.alt || 'Relevant image'} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                    {img.alt && (
                      <div className="absolute inset-x-0 bottom-0 p-2 bg-black/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-white truncate">{img.alt}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          message.content
        )}
      </div>
    </motion.div>
  );
};

export const ChatInput = ({ onSend, isLoading }: { onSend: (msg: string) => void; isLoading: boolean }) => {
  const [input, setInput] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSend(input);
      setInput('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex items-center gap-2 bg-white p-2 rounded-2xl border border-gray-200 shadow-lg focus-within:border-indigo-400 transition-all">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask your AI anything..."
        className="flex-1 bg-transparent px-4 py-3 outline-none text-sm text-gray-700"
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={!input.trim() || isLoading}
        className={cn(
          'p-3 rounded-xl transition-all duration-200 flex items-center justify-center',
          input.trim() && !isLoading
            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        )}
      >
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
      </button>
    </form>
  );
};
