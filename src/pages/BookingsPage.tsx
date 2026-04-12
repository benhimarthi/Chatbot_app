import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  Calendar, 
  Users, 
  Clock, 
  Hotel, 
  Utensils, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Search,
  Filter,
  MoreVertical,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Card, CustomButton as Button } from '../components/UI';
import { auth, getBookings, updateBookingStatus, deleteBooking } from '../firebase';
import { cn } from '../lib/utils';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';

export const BookingsPage = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'restaurant' | 'hotel'>('all');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null; name: string }>({
    isOpen: false,
    id: null,
    name: ''
  });

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = getBookings(auth.currentUser.uid, (data) => {
      setBookings(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async () => {
    if (!deleteModal.id) return;
    try {
      await deleteBooking(deleteModal.id);
      setDeleteModal({ isOpen: false, id: null, name: '' });
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const handleStatusUpdate = async (id: string, status: 'confirmed' | 'cancelled') => {
    try {
      await updateBookingStatus(id, status);
    } catch (error) {
      console.error("Status update error:", error);
    }
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = (booking.data.full_name || booking.data.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (booking.data.phone || '').includes(searchQuery);
    const matchesType = filterType === 'all' || booking.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Manage Bookings</h1>
          <p className="text-gray-500 mt-1">View and manage your restaurant and hotel reservations.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'restaurant', 'hotel'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border",
                filterType === type 
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100" 
                  : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-0 overflow-hidden border-none shadow-xl shadow-gray-100/50">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-400 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">Loading bookings...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No bookings found</h3>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-50">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Customer</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Type</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Details</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredBookings.map((booking) => (
                  <tr key={booking.id} className="group hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                          {(booking.data.full_name || booking.data.name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{booking.data.full_name || booking.data.name}</p>
                          <p className="text-xs text-gray-500">{booking.data.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {booking.type === 'hotel' ? (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-bold uppercase">
                            <Hotel className="w-3 h-3" /> Hotel
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold uppercase">
                            <Utensils className="w-3 h-3" /> Restaurant
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Calendar className="w-3 h-3" />
                          {booking.type === 'hotel' 
                            ? `${booking.data.check_in_date} - ${booking.data.check_out_date}`
                            : booking.data.date}
                        </div>
                        <div className="flex items-center gap-4">
                          {booking.type !== 'hotel' && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Clock className="w-3 h-3" /> {booking.data.time}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Users className="w-3 h-3" /> {booking.data.number_of_guests} Guests
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        booking.status === 'confirmed' ? "bg-green-100 text-green-700" :
                        booking.status === 'cancelled' ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-700"
                      )}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {booking.status !== 'confirmed' && (
                          <button 
                            onClick={() => handleStatusUpdate(booking.id, 'confirmed')}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                            title="Confirm Booking"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {booking.status !== 'cancelled' && (
                          <button 
                            onClick={() => handleStatusUpdate(booking.id, 'cancelled')}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Cancel Booking"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => setDeleteModal({ isOpen: true, id: booking.id, name: booking.data.full_name || booking.data.name })}
                          className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                          title="Delete Permanently"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <DeleteConfirmModal 
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={handleDelete}
        title="Delete Booking"
        message={`Are you sure you want to delete the booking for "${deleteModal.name}"? This will permanently remove it from your records.`}
      />
    </div>
  );
};
