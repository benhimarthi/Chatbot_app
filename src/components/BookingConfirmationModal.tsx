import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Users, Clock, Hotel, Utensils, X, Check } from 'lucide-react';
import { CustomButton as Button } from './UI';

interface BookingConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  bookingData: any;
  type: 'restaurant' | 'hotel';
}

export const BookingConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  bookingData,
  type
}: BookingConfirmationModalProps) => {
  if (!bookingData) return null;

  const isHotel = type === 'hotel';

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
            <div className="bg-indigo-600 p-6 text-white relative">
              <div className="flex items-center gap-3 mb-2">
                {isHotel ? <Hotel className="w-6 h-6" /> : <Utensils className="w-6 h-6" />}
                <h3 className="text-xl font-bold">Confirm Your Booking</h3>
              </div>
              <p className="text-indigo-100 text-sm">Please review the details below before confirming.</p>
              
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Name</p>
                  <p className="text-sm font-semibold text-gray-900 truncate">{bookingData.full_name || bookingData.name || 'Not provided'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Phone</p>
                  <p className="text-sm font-semibold text-gray-900">{bookingData.phone || 'Not provided'}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                      {isHotel ? 'Check-in / Check-out' : 'Date'}
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {isHotel 
                        ? `${bookingData.check_in_date || '?'} to ${bookingData.check_out_date || '?'}`
                        : bookingData.date || 'Not provided'}
                    </p>
                  </div>
                </div>

                {!isHotel && (
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Time</p>
                      <p className="text-sm font-semibold text-gray-900">{bookingData.time || 'Not provided'}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Guests</p>
                    <p className="text-sm font-semibold text-gray-900">{bookingData.number_of_guests || '0'} Guests</p>
                  </div>
                </div>
                
                {isHotel && (
                   <div className="flex items-center gap-3">
                    <Hotel className="w-4 h-4 text-indigo-600" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Rooms</p>
                      <p className="text-sm font-semibold text-gray-900">{bookingData.number_of_rooms || '0'} Rooms</p>
                    </div>
                  </div>
                )}
              </div>

              {(bookingData.special_requests || bookingData.special_request) && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Special Requests</p>
                  <p className="text-sm text-gray-600 italic">"{bookingData.special_requests || bookingData.special_request}"</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button 
                  variant="secondary" 
                  onClick={onClose}
                  className="flex-1"
                >
                  Edit Details
                </Button>
                <Button 
                  onClick={onConfirm}
                  className="flex-1 gap-2"
                >
                  <Check className="w-4 h-4" />
                  Confirm Booking
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
