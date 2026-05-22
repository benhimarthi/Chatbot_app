import * as React from 'react';
import { useState, useEffect } from 'react';
import { Calendar, Users, Clock, User, Phone, Trash2, Search, Filter, ChevronRight, MoreHorizontal, Plus, X } from 'lucide-react';
import { Card, CustomButton as Button } from '../components/UI';
import { auth, getReservations, deleteReservation, addReservation, incrementBookingUsage, getUserSettings } from '../firebase';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { Reservation, ReservationDraft, UserSettings, PLANS } from '../types';
import { ReservationWidget } from '../components/ReservationWidget';
import { checkAvailability } from '../services/reservationService';

export const BusinessPage = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed'>('all');
  
  // Manual reservation state
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [draft, setDraft] = useState<ReservationDraft>({
    guests: 2,
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '19:00',
    name: '',
    phone: ''
  });

  useEffect(() => {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;

    const unsubscribeSettings = getUserSettings(userId, (s) => {
      setUserSettings(s);
    });

    const unsubscribe = getReservations(userId, (data) => {
      setReservations(data);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
      unsubscribeSettings();
    };
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to cancel this reservation?')) {
      try {
        await deleteReservation(id);
      } catch (error) {
        console.error('Failed to delete reservation:', error);
      }
    }
  };

  const handleConfirmManual = async () => {
    if (!auth.currentUser || !userSettings) return;

    const { name, phone, date, time, guests } = draft;
    if (!name || !phone || !date || !time || !guests) {
      alert('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const plan = PLANS[userSettings.subscriptionPlan] || PLANS.free;
      const usage = userSettings.usage || { messages_this_month: 0, bookings_this_month: 0 };

      if (usage.bookings_this_month >= plan.max_bookings_per_month) {
        alert("Usage limit reached. Upgrade to add more reservations.");
        setIsSubmitting(false);
        return;
      }

      const h = parseInt(time.split(':')[0]);
      const m = parseInt(time.split(':')[1]);
      const startVal = h * 60 + m;
      const endVal = startVal + (userSettings.reservationDuration || 60);

      const availabilityResult = await checkAvailability(
        auth.currentUser.uid,
        guests,
        date,
        time,
        {
          bookingEnabled: userSettings.bookingEnabled,
          capacity: userSettings.capacity || 20,
          reservationDuration: userSettings.reservationDuration || 60,
          openingHours: userSettings.openingHours || { start: '09:00', end: '22:00' }
        }
      );

      if (!availabilityResult.available) {
        if (!window.confirm(`Capacity limit reached for this time. Only ${availabilityResult.remaining} slots left. Book anyway?`)) {
          setIsSubmitting(false);
          return;
        }
      }

      await addReservation({
        business_id: auth.currentUser.uid,
        customer_name: name,
        customer_phone: phone,
        date,
        start_time: time,
        end_time: `${Math.floor(endVal / 60).toString().padStart(2, '0')}:${(endVal % 60).toString().padStart(2, '0')}`,
        guests,
        status: 'confirmed'
      });

      await incrementBookingUsage(auth.currentUser.uid);
      
      setIsAdding(false);
      setDraft({
        guests: 2,
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '19:00',
        name: '',
        phone: ''
      });
    } catch (err) {
      console.error(err);
      alert("Failed to add reservation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredReservations = reservations.filter(res => {
    const matchesSearch = res.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         res.customer_phone.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || res.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservations Management</h1>
          <p className="text-gray-500 text-sm">View and manage your restaurant bookings.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => setIsAdding(true)}
            className="gap-2"
            size="sm"
          >
            <Plus className="w-4 h-4" />
            New Reservation
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none w-64 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {isAdding && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <ReservationWidget 
              draft={draft}
              isLoading={isSubmitting}
              onConfirm={handleConfirmManual}
              onCancel={() => setIsAdding(false)}
              onEdit={(field, value) => setDraft(prev => ({ ...prev, [field]: value }))}
            />
          </div>
        )}
        <Card className="p-0 overflow-hidden border-gray-100 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Guests</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                        <span className="text-sm">Loading reservations...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredReservations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <Calendar className="w-8 h-8 text-gray-200" />
                        <span className="text-sm">No reservations found.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredReservations.map((res) => (
                    <tr key={res.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm">
                            {res.customer_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm">{res.customer_name}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {res.customer_phone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{res.guests}</span> guests
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                            {res.date ? (() => {
                              try {
                                return format(new Date(res.date), 'EEE, MMM do, yyyy');
                              } catch (e) {
                                return res.date;
                              }
                            })() : 'No date'}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            {res.start_time} - {res.end_time}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {res.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => res.id && handleDelete(res.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};
