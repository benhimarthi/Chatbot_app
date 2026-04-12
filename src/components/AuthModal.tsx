import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bot, Mail, Chrome, ArrowRight, Loader2 } from 'lucide-react';
import { CustomButton as Button } from './UI';
import { signInWithGoogle } from '../firebase';
import { useNavigate } from 'react-router-dom';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal = ({ isOpen, onClose }: AuthModalProps) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      onClose();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8 pt-12 text-center">
              <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200">
                <Bot className="text-white w-8 h-8" />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Welcome to ChatFlow</h2>
              <p className="text-gray-500 mt-2">Build your custom AI chatbot in minutes.</p>

              <div className="mt-10 space-y-4">
                <Button
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  variant="secondary"
                  className="w-full py-4 gap-3 border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/30 group"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  ) : (
                    <Chrome className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" />
                  )}
                  <span className="font-semibold">Continue with Google</span>
                </Button>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-100"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold text-gray-400">
                    <span className="bg-white px-4">Or continue with email</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      placeholder="Email address"
                      className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-sm"
                    />
                  </div>
                  <Button className="w-full py-4 gap-2 shadow-indigo-200 shadow-lg">
                    Continue <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>

                {error && (
                  <p className="text-xs text-red-500 font-medium mt-4">{error}</p>
                )}
              </div>

              <p className="mt-8 text-xs text-gray-400 leading-relaxed">
                By continuing, you agree to ChatFlow's <br />
                <a href="#" className="underline hover:text-gray-600">Terms of Service</a> and <a href="#" className="underline hover:text-gray-600">Privacy Policy</a>.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
