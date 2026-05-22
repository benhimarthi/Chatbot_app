import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Mail, 
  Phone, 
  Calendar, 
  MoreHorizontal, 
  Filter,
  Download,
  Trash2,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  MessageSquare
} from 'lucide-react';
import { Card, CustomButton as Button } from '../components/UI';
import { getCustomers, auth } from '../firebase';
import { Customer } from '../types';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export const CustomersPage = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'recent' | 'frequent'>('all');

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = getCustomers(auth.currentUser.uid, (data) => {
      setCustomers(data as Customer[]);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filter === 'frequent') return matchesSearch && (customer.totalBookings || 0) > 3;
    if (filter === 'recent') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const lastBooking = customer.lastBookingAt?.toDate ? customer.lastBookingAt.toDate() : new Date(customer.lastBookingAt);
      return matchesSearch && lastBooking > thirtyDaysAgo;
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Directory</h1>
          <p className="text-gray-500 text-sm">Manage your relationship with your business clients.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none w-64 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 bg-white border-none shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Clients</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{customers.length}</h3>
          <p className="text-xs text-green-600 font-bold mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            +12% this month
          </p>
        </Card>
        <Card className="p-6 bg-white border-none shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Recent Activity</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{customers.filter(c => {
             const lastBooking = c.lastBookingAt?.toDate ? c.lastBookingAt.toDate() : new Date(c.lastBookingAt);
             return lastBooking > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          }).length}</h3>
          <p className="text-xs text-gray-400 font-medium mt-1">Booked in the last 7 days</p>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden border-gray-100 shadow-sm bg-white">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                filter === 'all' ? "bg-white shadow-sm text-indigo-600" : "text-gray-500 hover:text-gray-900"
              )}
            >
              All Clients
            </button>
            <button 
              onClick={() => setFilter('frequent')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                filter === 'frequent' ? "bg-white shadow-sm text-amber-600" : "text-gray-500 hover:text-gray-900"
              )}
            >
              Frequent
            </button>
            <button 
              onClick={() => setFilter('recent')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                filter === 'recent' ? "bg-white shadow-sm text-emerald-600" : "text-gray-500 hover:text-gray-900"
              )}
            >
              Recent
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Bookings</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Last Booking</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                      <span className="text-sm">Retrieving customer profiles...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-24 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-3">
                      <Users className="w-12 h-12 text-gray-100" />
                      <div className="space-y-1">
                        <p className="font-bold text-gray-900">No customers found</p>
                        <p className="text-xs">Customers will appear here once they make a reservation.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 text-sm">{customer.name}</div>
                          <div className="text-[10px] text-gray-400 font-medium tracking-tighter uppercase">ID: {customer.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Phone className="w-3 h-3 text-gray-400" />
                          {customer.phone}
                        </div>
                        {customer.email && (
                          <div className="flex items-center gap-2 text-xs text-gray-400 truncate w-32">
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            {customer.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
                        {customer.totalBookings || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-900">
                          {customer.lastBookingAt ? format(customer.lastBookingAt.toDate ? customer.lastBookingAt.toDate() : new Date(customer.lastBookingAt), 'MMM d, yyyy') : 'Never'}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {customer.lastBookingAt ? format(customer.lastBookingAt.toDate ? customer.lastBookingAt.toDate() : new Date(customer.lastBookingAt), 'HH:mm') : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="outline" size="sm" className="h-8 px-2">
                          <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 px-2">
                          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
