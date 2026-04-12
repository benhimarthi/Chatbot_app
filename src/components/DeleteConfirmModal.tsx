import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { CustomButton as Button } from './UI';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  isLoading?: boolean;
}

export const DeleteConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message,
  isLoading 
}: DeleteConfirmModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{message}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="ghost" 
                  onClick={onClose}
                  className="flex-1"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={onConfirm}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 shadow-rose-100"
                  disabled={isLoading}
                >
                  {isLoading ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-gray-50 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
