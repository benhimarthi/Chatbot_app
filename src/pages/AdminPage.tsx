import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Shield, 
  UserPlus, 
  MoreHorizontal, 
  Calendar, 
  TrendingUp, 
  Crown,
  Mail,
  ExternalLink,
  ChevronRight,
  UserCheck,
  UserX,
  CreditCard,
  X,
  FileText,
  MessageSquare,
  Activity,
  ArrowUpRight,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Lock,
  Unlock,
  History,
  Terminal,
  Save,
  Clock
} from 'lucide-react';
import { Card, CustomButton as Button } from '../components/UI';
import { getAllUsers, updateUserSettings, auth, getReservationsForAdmin, getUserLogs, clearUserLogs, clearChatHistory } from '../firebase';
import { UserSettings, PLANS, Reservation, AppLog } from '../types';
import { format, isValid, parseISO } from 'date-fns';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const safeFormat = (date: any, formatStr: string, fallback: string = 'N/A') => {
  if (!date) return fallback;
  
  let validDate: Date | null = null;
  
  if (date instanceof Date) {
    validDate = date;
  } else if (typeof date?.toDate === 'function') {
    validDate = date.toDate();
  } else if (typeof date === 'string' || typeof date === 'number') {
    validDate = new Date(date);
  } else if (date?.seconds) {
    // Basic check for Firestore timestamp-like structure
    validDate = new Date(date.seconds * 1000);
  }

  if (validDate && isValid(validDate)) {
    return format(validDate, formatStr);
  }
  
  return fallback;
};

const UserDetailsPanel = ({ user, onClose, onUpdatePlan, onToggleAdmin }: { 
  user: UserSettings; 
  onClose: () => void;
  onUpdatePlan: (userId: string, plan: 'free' | 'pro') => void;
  onToggleAdmin: (user: UserSettings) => void;
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'usage' | 'reservations' | 'logs'>('info');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [logs, setLogs] = useState<AppLog[]>([]);
  const [resSearch, setResSearch] = useState('');
  const [isEditingUsage, setIsEditingUsage] = useState(false);
  const [usageEdits, setUsageEdits] = useState({
    messages: user.usage?.messages_this_month || 0,
    bookings: user.usage?.bookings_this_month || 0,
    documents: user.usage?.documents_count || 0,
    limit_messages: user.customLimits?.max_messages_per_month || PLANS[user.subscriptionPlan].max_messages_per_month,
    limit_bookings: user.customLimits?.max_bookings_per_month || PLANS[user.subscriptionPlan].max_bookings_per_month,
  });

  const plan = PLANS[user.subscriptionPlan];

  useEffect(() => {
    if (activeTab === 'reservations') {
      const unsubscribe = getReservationsForAdmin({ businessId: user.uid }, (data) => {
        setReservations(data as Reservation[]);
      });
      return () => unsubscribe();
    }
    if (activeTab === 'logs') {
      const unsubscribe = getUserLogs(user.uid, (data) => {
        setLogs(data as AppLog[]);
      });
      return () => unsubscribe();
    }
  }, [activeTab, user.uid]);

  const handleUpdateSetting = async (key: string, value: any) => {
    try {
      await updateUserSettings(user.uid, { [key]: value } as any);
    } catch (error) {
      console.error(`Failed to update ${key}:`, error);
    }
  };

  const handleSaveUsage = async () => {
    try {
      await updateUserSettings(user.uid, {
        usage: {
          ...user.usage,
          messages_this_month: usageEdits.messages,
          bookings_this_month: usageEdits.bookings,
          documents_count: usageEdits.documents
        },
        customLimits: {
          max_messages_per_month: usageEdits.limit_messages,
          max_bookings_per_month: usageEdits.limit_bookings
        }
      } as any);
      setIsEditingUsage(false);
    } catch (error) {
      console.error('Failed to update usage:', error);
    }
  };

  const handleResetHistory = async () => {
    if (!window.confirm("Are you sure you want to clear this user's activity logs and chat history?")) return;
    
    try {
      await clearUserLogs(user.uid);
      await clearChatHistory(user.uid);
    } catch (error) {
      console.error('Failed to reset history:', error);
    }
  };

  const filteredReservations = reservations.filter(r => 
    r.customer_name.toLowerCase().includes(resSearch.toLowerCase()) ||
    r.customer_phone.includes(resSearch)
  );
  
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-50 overflow-hidden border-l border-gray-100 flex flex-col"
    >
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm">
            {user.displayName?.charAt(0) || user.email.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-sm">{user.displayName || 'Unknown User'}</h2>
            <p className="text-[10px] text-gray-400 font-mono">UID: {user.uid.slice(0, 8)}...</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <div className="flex border-b border-gray-100 bg-gray-50/30">
        {(['info', 'usage', 'reservations', 'logs'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-all border-b-2",
              activeTab === tab 
                ? "border-indigo-600 text-indigo-600 bg-white" 
                : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {activeTab === 'info' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            {/* Platform Identity */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Platform Identity</h4>
              <Card className="p-4 bg-gray-50 border-none space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Email</p>
                    <p className="text-xs font-medium text-gray-900 mt-1 truncate">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Business</p>
                    <p className="text-xs font-medium text-gray-900 mt-1 truncate">{user.businessName || 'Not Set'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Registration</p>
                    <p className="text-xs font-medium text-gray-900 mt-1">
                      {safeFormat(user.createdAt, 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Last Active</p>
                    <p className="text-xs font-medium text-indigo-600 mt-1">
                      {safeFormat(user.lastActiveAt, 'MMM d, HH:mm', 'Never')}
                    </p>
                  </div>
                </div>
              </Card>
            </section>

            {/* Policies & Access */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Policies & Access Control</h4>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Online Booking</p>
                      <p className="text-[10px] text-gray-400 leading-tight">Allow clients to book slots</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleUpdateSetting('bookingEnabled', !user.bookingEnabled)}
                    className={cn(
                      "w-10 h-6 rounded-full transition-colors relative",
                      user.bookingEnabled ? "bg-emerald-500" : "bg-gray-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      user.bookingEnabled ? "left-5" : "left-1"
                    )} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Chatbot Feature</p>
                      <p className="text-[10px] text-gray-400 leading-tight">AI Assistant functional</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleUpdateSetting('chatbotEnabled', !user.chatbotEnabled)}
                    className={cn(
                      "w-10 h-6 rounded-full transition-colors relative",
                      user.chatbotEnabled ? "bg-indigo-500" : "bg-gray-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      user.chatbotEnabled ? "left-5" : "left-1"
                    )} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-rose-50 bg-rose-50/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-rose-900">Block Chat Usage</p>
                      <p className="text-[10px] text-rose-400 leading-tight">Completely disable chat UI</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleUpdateSetting('isChatbotBlocked', !user.isChatbotBlocked)}
                    className={cn(
                      "w-10 h-6 rounded-full transition-colors relative",
                      user.isChatbotBlocked ? "bg-rose-500" : "bg-gray-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      user.isChatbotBlocked ? "left-5" : "left-1"
                    )} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-rose-50 bg-rose-50/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                      <Terminal className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-rose-900">Block API Access</p>
                      <p className="text-[10px] text-rose-400 leading-tight">Revoke all technical keys</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleUpdateSetting('isApiAccessBlocked', !user.isApiAccessBlocked)}
                    className={cn(
                      "w-10 h-6 rounded-full transition-colors relative",
                      user.isApiAccessBlocked ? "bg-rose-500" : "bg-gray-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      user.isApiAccessBlocked ? "left-5" : "left-1"
                    )} />
                  </button>
                </div>
              </div>
            </section>
          </motion.div>
        )}

        {activeTab === 'usage' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Usage Override</h4>
              <div className="text-[10px] text-gray-400 font-mono">
                Period Start: {safeFormat(user.usage?.current_period_start, 'MMM d, yyyy')}
              </div>
              {!isEditingUsage ? (
                <Button variant="ghost" size="sm" className="h-7 text-indigo-600 font-bold" onClick={() => setIsEditingUsage(true)}>
                  Edit Values
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-gray-500" onClick={() => setIsEditingUsage(false)}>Cancel</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-emerald-600 font-bold" onClick={handleSaveUsage}>
                    <Save className="w-3.5 h-3.5 mr-1" /> Save
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <UsageMetric 
                label="Messages" 
                current={user.usage?.messages_this_month || 0} 
                max={user.customLimits?.max_messages_per_month || plan?.max_messages_per_month} 
                icon={MessageSquare}
                color="indigo"
                isEditing={isEditingUsage}
                editValue={usageEdits.messages}
                onEdit={(v: number) => setUsageEdits(prev => ({ ...prev, messages: v }))}
                limitValue={usageEdits.limit_messages}
                onLimitChange={(v: number) => setUsageEdits(prev => ({ ...prev, limit_messages: v }))}
              />
              <UsageMetric 
                label="Bookings" 
                current={user.usage?.bookings_this_month || 0} 
                max={user.customLimits?.max_bookings_per_month || plan?.max_bookings_per_month} 
                icon={Calendar}
                color="emerald"
                isEditing={isEditingUsage}
                editValue={usageEdits.bookings}
                onEdit={(v: number) => setUsageEdits(prev => ({ ...prev, bookings: v }))}
                limitValue={usageEdits.limit_bookings}
                onLimitChange={(v: number) => setUsageEdits(prev => ({ ...prev, limit_bookings: v }))}
              />
              <UsageMetric 
                label="Documents" 
                current={user.usage?.documents_count || 0} 
                max={Infinity} 
                icon={FileText}
                color="amber"
                isEditing={isEditingUsage}
                editValue={usageEdits.documents}
                onEdit={(v: number) => setUsageEdits(prev => ({ ...prev, documents: v }))}
              />
            </div>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
              <div className="text-[10px] text-amber-900 leading-normal">
                <strong>Warning:</strong> Manually overriding usage values can cause sync issues with the user's local cycle. Use only for support purposes.
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'reservations' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text"
                placeholder="Search history..."
                value={resSearch}
                onChange={(e) => setResSearch(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            </div>
            
            <div className="space-y-2">
              {filteredReservations.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">No reservations found</p>
                </div>
              ) : (
                filteredReservations.map((res) => (
                  <div key={res.id} className="p-3 rounded-xl border border-gray-100 bg-white hover:border-indigo-100 transition-all group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-gray-900">{res.customer_name}</span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase",
                        res.status === 'confirmed' ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"
                      )}>
                        {res.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {res.date ? format(parseISO(res.date), 'MMM d') : ''} {res.start_time}
                      </div>
                      <div className="group-hover:text-indigo-600 transition-colors">
                        {res.customer_phone}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'logs' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Usage Logs</h4>
            <div className="space-y-3">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">No activity logs recorded yet</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="p-3 rounded-xl border border-gray-100 bg-white space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md",
                        log.type === 'error' ? "bg-rose-50 text-rose-600" : 
                        log.type === 'booking' ? "bg-emerald-50 text-emerald-600" :
                        "bg-indigo-50 text-indigo-600"
                      )}>
                        {log.type}
                      </span>
                      <span className="text-[9px] text-gray-400">
                        {safeFormat(log.createdAt, 'MMM d, HH:mm:ss')}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-700 font-medium leading-relaxed">
                      {log.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </div>

      <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-2">
        <Button 
          variant="outline" 
          className="flex-1 text-rose-500 hover:bg-rose-50 border-rose-100"
          onClick={handleResetHistory}
        >
          Reset History
        </Button>
        <Button className="flex-1 bg-indigo-600" onClick={() => onUpdatePlan(user.uid, user.subscriptionPlan === 'pro' ? 'free' : 'pro')}>
          {user.subscriptionPlan === 'pro' ? 'Downgrade' : 'Upgrade to Pro'}
        </Button>
      </div>
    </motion.div>
  );
};

const UsageMetric = ({ label, current, max, icon: Icon, color, isEditing, editValue, onEdit, limitValue, onLimitChange }: any) => {
  return (
    <div className="p-4 rounded-2xl border border-gray-100 space-y-3 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("p-2 rounded-lg", color === 'indigo' ? "bg-indigo-50 text-indigo-600" : color === 'emerald' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold text-gray-700">{label}</span>
        </div>
        <div className="text-right flex items-center gap-1.5">
          {isEditing ? (
            <>
              <input 
                type="number" 
                value={editValue} 
                onChange={(e) => onEdit(parseInt(e.target.value) || 0)}
                className="w-14 px-1.5 py-1 border border-gray-200 rounded text-right text-xs font-bold bg-white"
                title="Current Usage"
              />
              {onLimitChange && (
                <>
                  <span className="text-xs text-gray-400">/</span>
                  <input 
                    type="number" 
                    value={limitValue} 
                    onChange={(e) => onLimitChange(parseInt(e.target.value) || 0)}
                    className="w-14 px-1.5 py-1 border border-indigo-200 rounded text-right text-xs font-bold bg-indigo-50/50 text-indigo-600"
                    title="Override Limit"
                  />
                </>
              )}
            </>
          ) : (
            <>
              <span className="text-sm font-bold text-gray-900">{current}</span>
              {max !== Infinity && <span className="text-xs text-gray-400">/ {max}</span>}
            </>
          )}
        </div>
      </div>
      {max !== Infinity && (
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((current / max) * 100, 100)}%` }}
            className={cn("h-full rounded-full transition-all", color === 'indigo' ? "bg-indigo-500" : color === 'emerald' ? "bg-emerald-500" : "bg-amber-500")}
          />
        </div>
      )}
    </div>
  );
};

export const AdminPage = () => {
  const [users, setUsers] = useState<UserSettings[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'pro' | 'free'>('all');
  const [selectedUser, setSelectedUser] = useState<UserSettings | null>(null);

  useEffect(() => {
    const unsubscribe = getAllUsers((data) => {
      setUsers(data as UserSettings[]);
      setIsLoading(false);
      
      // Keep selected user updated if they change in the list
      if (selectedUser) {
        const updated = (data as UserSettings[]).find(u => u.uid === selectedUser.uid);
        if (updated) setSelectedUser(updated);
      }
    });

    return () => unsubscribe();
  }, [selectedUser?.uid]);

  const handleUpdatePlan = async (userId: string, plan: 'free' | 'pro') => {
    try {
      await updateUserSettings(userId, { subscriptionPlan: plan } as any);
    } catch (error) {
      console.error('Failed to update plan:', error);
    }
  };

  const handleToggleAdmin = async (user: UserSettings) => {
    const isAdmin = (user as any).role === 'admin';
    try {
      await updateUserSettings(user.uid, { role: isAdmin ? 'user' : 'admin' } as any);
    } catch (error) {
      console.error('Failed to toggle admin:', error);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.businessName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || user.subscriptionPlan === filter;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: users.length,
    pro: users.filter(u => u.subscriptionPlan === 'pro').length,
    requestedUpgrade: users.filter(u => u.upgrade_requested).length
  };

  return (
    <div className="relative min-h-screen">
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Shield className="w-8 h-8 text-indigo-600" />
              Platform Administration
            </h1>
            <p className="text-gray-500 text-sm">Manage users, subscriptions, and system-wide settings.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none w-64 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Stats Quick View */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Card className="p-6 bg-white border-none shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Users className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Users</p>
              <h3 className="text-xl font-bold text-gray-900">{stats.total}</h3>
            </div>
          </Card>
          <Card className="p-6 bg-white border-none shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
              <Crown className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pro Customers</p>
              <h3 className="text-xl font-bold text-gray-900">{stats.pro}</h3>
            </div>
          </Card>
          <Card className="p-6 bg-white border-none shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Upgrade Requests</p>
              <h3 className="text-xl font-bold text-gray-900">{stats.requestedUpgrade}</h3>
            </div>
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
                All Users
              </button>
              <button 
                onClick={() => setFilter('pro')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  filter === 'pro' ? "bg-white shadow-sm text-amber-600" : "text-gray-500 hover:text-gray-900"
                )}
              >
                Pro Only
              </button>
            </div>
            <p className="text-xs text-gray-400 font-medium">{filteredUsers.length} users found</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">User / Business</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Usage (Msg/Book)</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                        <span className="text-sm">Loading user directory...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-24 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-3">
                        <Users className="w-12 h-12 text-gray-100" />
                        <div className="space-y-1">
                          <p className="font-bold text-gray-900">No users found</p>
                          <p className="text-xs">Try adjusting your search or filters.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr 
                      key={user.uid} 
                      onClick={() => setSelectedUser(user)}
                      className={cn(
                        "hover:bg-gray-50/50 transition-colors group cursor-pointer",
                        selectedUser?.uid === user.uid && "bg-indigo-50/30"
                      )}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 overflow-hidden border border-indigo-100 flex-shrink-0">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-indigo-600 font-bold">
                                {user.displayName?.charAt(0) || user.email.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-gray-900 text-sm truncate flex items-center gap-2">
                              {user.displayName || 'Unknown User'}
                              {(user as any).role === 'admin' && (
                                <Shield className="w-3 h-3 text-indigo-600" fill="currentColor" />
                              )}
                            </div>
                            <div className="text-xs text-gray-500 truncate flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </div>
                            {user.businessName && (
                              <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-tight mt-0.5">
                                {user.businessName}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border",
                            user.subscriptionPlan === 'pro' 
                              ? "bg-amber-50 text-amber-700 border-amber-100" 
                              : "bg-gray-50 text-gray-600 border-gray-100"
                          )}>
                            {user.subscriptionPlan?.toUpperCase() || 'FREE'}
                          </span>
                          {user.upgrade_requested && (
                            <span className="text-[10px] font-bold text-rose-500 animate-pulse">
                              Upgrade Pending
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span className="text-gray-400">MESSAGES</span>
                            <span className="text-gray-900">{user.usage?.messages_this_month || 0}</span>
                          </div>
                          <div className="w-24 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 rounded-full" 
                              style={{ width: `${Math.min(((user.usage?.messages_this_month || 0) / (PLANS[user.subscriptionPlan]?.max_messages_per_month || 200)) * 100, 100)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span className="text-gray-400">BOOKINGS</span>
                            <span className="text-gray-900">{user.usage?.bookings_this_month || 0}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-gray-500 font-medium">
                          {safeFormat(user.createdAt, 'MMM d, yyyy')}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdatePlan(user.uid, user.subscriptionPlan === 'pro' ? 'free' : 'pro');
                            }}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleAdmin(user);
                            }}
                          >
                            <Shield className={cn("w-3.5 h-3.5", (user as any).role === 'admin' ? "text-indigo-600" : "text-gray-400")} />
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

      {/* Overlay & Side Panel */}
      <AnimatePresence>
        {selectedUser && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
              className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 transition-opacity"
            />
            <UserDetailsPanel 
              user={selectedUser} 
              onClose={() => setSelectedUser(null)}
              onUpdatePlan={handleUpdatePlan}
              onToggleAdmin={handleToggleAdmin}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
