import * as React from 'react';
import { Send, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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
          'max-w-[85%] px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-sm',
          isAssistant
            ? 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
            : 'bg-indigo-600 text-white rounded-br-none'
        )}
      >
        <div className={cn(
          'markdown-body',
          !isAssistant && 'text-white'
        )}>
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }: any) {
                if (inline) {
                  return (
                    <code className={cn(
                      'px-1.5 py-0.5 rounded font-mono text-xs',
                      isAssistant ? 'bg-gray-100 text-indigo-600' : 'bg-indigo-500 text-white'
                    )} {...props}>
                      {children}
                    </code>
                  );
                }
                return (
                  <pre className={cn(
                    'p-4 rounded-xl font-mono text-xs overflow-x-auto my-3',
                    isAssistant ? 'bg-gray-900 text-gray-100' : 'bg-indigo-700 text-white'
                  )}>
                    <code {...props}>{children}</code>
                  </pre>
                );
              },
              a({ node, ...props }: any) {
                return (
                  <a 
                    className={cn(
                      'underline transition-opacity hover:opacity-80',
                      isAssistant ? 'text-indigo-600' : 'text-white'
                    )} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    {...props} 
                  />
                );
              }
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
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
