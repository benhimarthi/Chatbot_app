import * as React from 'react';
import { Calendar, Users, Clock, User, Phone, Check, X, AlertTriangle } from 'lucide-react';
import { ReservationDraft } from '../types';
import { Card, CustomButton as Button } from './UI';

interface ReservationWidgetProps {
  draft: ReservationDraft;
  onConfirm: () => void;
  onCancel: () => void;
  onEdit: (field: keyof ReservationDraft, value: any) => void;
  isLoading?: boolean;
}

export const ReservationWidget: React.FC<ReservationWidgetProps> = ({ 
  draft, 
  onConfirm, 
  onCancel, 
  onEdit,
  isLoading 
}) => {
  return (
    <Card className="max-w-md w-full border-indigo-100 bg-indigo-50/30 space-y-4 animate-in fade-in zoom-in duration-300">
      <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Calendar className="w-4 h-4 text-indigo-600" />
          </div>
          <h3 className="font-bold text-gray-900">Review Reservation</h3>
        </div>
        <button 
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-indigo-50 shadow-sm">
          <Users className="w-4 h-4 text-indigo-500" />
          <div className="flex-1">
            <p className="text-[10px] uppercase font-bold text-gray-400">Guests</p>
            <input 
              type="number" 
              value={draft.guests || ''} 
              onChange={(e) => onEdit('guests', parseInt(e.target.value))}
              className="text-sm font-medium text-gray-900 w-full bg-transparent outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-indigo-50 shadow-sm">
          <Calendar className="w-4 h-4 text-indigo-500" />
          <div className="flex-1">
            <p className="text-[10px] uppercase font-bold text-gray-400">Date</p>
            <input 
              type="date" 
              value={draft.date || ''} 
              onChange={(e) => onEdit('date', e.target.value)}
              className="text-sm font-medium text-gray-900 w-full bg-transparent outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-indigo-50 shadow-sm">
          <Clock className="w-4 h-4 text-indigo-500" />
          <div className="flex-1">
            <p className="text-[10px] uppercase font-bold text-gray-400">Time</p>
            <input 
              type="time" 
              value={draft.time || ''} 
              onChange={(e) => onEdit('time', e.target.value)}
              className="text-sm font-medium text-gray-900 w-full bg-transparent outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-indigo-50 shadow-sm">
            <User className="w-4 h-4 text-indigo-500" />
            <div className="flex-1">
              <p className="text-[10px] uppercase font-bold text-gray-400">Name</p>
              <input 
                type="text" 
                value={draft.name || ''} 
                onChange={(e) => onEdit('name', e.target.value)}
                className="text-sm font-medium text-gray-900 w-full bg-transparent outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-indigo-50 shadow-sm">
            <Phone className="w-4 h-4 text-indigo-500" />
            <div className="flex-1">
              <p className="text-[10px] uppercase font-bold text-gray-400">Phone</p>
              <input 
                type="text" 
                value={draft.phone || ''} 
                onChange={(e) => onEdit('phone', e.target.value)}
                className="text-sm font-medium text-gray-900 w-full bg-transparent outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button 
          variant="secondary" 
          onClick={onCancel}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button 
          onClick={onConfirm}
          disabled={isLoading}
          className="flex-2 gap-2"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Check className="w-4 h-4" />
              Confirm Booking
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};
