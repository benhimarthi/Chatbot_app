import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  FileText, 
  MessageSquare, 
  Bot, 
  TrendingUp, 
  Clock, 
  Plus,
  ArrowUpRight,
  MoreHorizontal,
  Users
} from 'lucide-react';
import { Card, CustomButton as Button } from '../components/UI';
import { cn } from '../lib/utils';
import { auth, getDocuments, getChatMessages, getUserSettings } from '../firebase';
import { motion } from 'motion/react';
import { PLANS, UserSettings } from '../types';

export const DashboardHome = () => {
  const [stats, setStats] = useState({
    documents: 0,
    messages: 0,
    activeBots: 1,
    users: 156
  });
  const [usageData, setUsageData] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const userId = auth.currentUser.uid;

    const unsubscribeSettings = getUserSettings(userId, (s) => {
      setUserSettings(s);
    });

    // Fetch documents count
    const unsubscribeDocs = getDocuments(userId, (docs) => {
      setStats(prev => ({ ...prev, documents: docs.length }));
      
      // Add documents to activity
      const docActivity = docs.slice(0, 3).map(doc => ({
        id: doc.id,
        type: 'document',
        title: `Uploaded ${doc.name}`,
        time: 'Recently',
        icon: <FileText className="w-4 h-4 text-indigo-600" />,
        bg: 'bg-indigo-50'
      }));
      
      setRecentActivity(prev => {
        const filtered = prev.filter(a => a.type !== 'document');
        return [...filtered, ...docActivity].sort(() => 0.5 - Math.random());
      });
    });

    // Fetch messages count and calculate trends
    const unsubscribeChat = getChatMessages(userId, (msgs) => {
      setStats(prev => ({ ...prev, messages: msgs.length }));
      
      // Calculate daily counts for the last 7 days
      const counts = Array(7).fill(0);
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      msgs.forEach(msg => {
        if (!msg.createdAt) return;
        const msgDate = msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
        const diffTime = today.getTime() - msgDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 0 && diffDays < 7) {
          counts[6 - diffDays]++;
        }
      });

      // If no real messages, provide placeholder data for demo purposes (optional, but requested by policy not to have mock data if real data is available)
      // Actually, if the user sees 0, they might think it's "not seeing anything".
      // Let's use real counts but maybe default to some minimal visible height if count > 0.
      setUsageData(counts);
      
      if (msgs.length > 0) {
        const chatActivity = {
          id: 'last-chat',
          type: 'chat',
          title: 'New chat message',
          time: 'Just now',
          icon: <MessageSquare className="w-4 h-4 text-emerald-600" />,
          bg: 'bg-emerald-50'
        };
        
        setRecentActivity(prev => {
          const filtered = prev.filter(a => a.type !== 'chat');
          return [chatActivity, ...filtered];
        });
      }
    });

    setIsLoading(false);

    return () => {
      unsubscribeDocs();
      unsubscribeChat();
      unsubscribeSettings();
    };
  }, []);

  const currentPlan = PLANS[userSettings?.subscriptionPlan] || PLANS.free;

  const statCards = [
    { 
      label: 'Documents', 
      value: stats.documents.toString(), 
      icon: FileText,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50'
    },
    { 
      label: 'Month Messages', 
      value: `${userSettings?.usage?.messages_this_month || 0} / ${currentPlan.max_messages_per_month}`, 
      icon: MessageSquare,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50'
    },
    { 
      label: 'Month Bookings', 
      value: `${userSettings?.usage?.bookings_this_month || 0} / ${currentPlan.max_bookings_per_month}`, 
      icon: Bot,
      color: 'text-amber-600',
      bg: 'bg-amber-50'
    },
    { 
      label: 'Plan', 
      value: currentPlan.name, 
      icon: Users,
      color: 'text-rose-600',
      bg: 'bg-rose-50'
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome back, {auth.currentUser?.displayName?.split(' ')[0] || 'User'}!</h1>
          <p className="text-gray-500 mt-1">Here's what's happening with your AI chatbot today.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="hidden sm:flex">
            <Clock className="w-4 h-4 mr-2" />
            View History
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Source
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="p-6 border-none shadow-sm bg-white hover:shadow-md transition-shadow flex items-center gap-4">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", stat.bg)}>
                <stat.icon className={cn("w-6 h-6", stat.color)} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mt-0.5">{stat.value}</h3>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Usage Analytics Chart (Placeholder) */}
        <Card className="lg:col-span-2 p-6 border-none shadow-sm bg-white">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Usage Analytics</h3>
              <p className="text-sm text-gray-500">Message volume over the last 7 days</p>
            </div>
            <select className="text-sm border-none bg-gray-50 rounded-lg px-3 py-1.5 font-medium focus:ring-0">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
            </select>
          </div>
          
          <div className="h-64 flex items-end justify-between gap-2 px-2 relative">
            {usageData.every(c => c === 0) && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px] z-20">
                <p className="text-sm font-medium text-gray-400">No message data available yet</p>
              </div>
            )}
            {usageData.map((count, i) => {
              const maxCount = Math.max(...usageData, 10);
              const height = (count / maxCount) * 100;
              const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
              const today = new Date();
              const date = new Date(today);
              date.setDate(today.getDate() - (6 - i));
              const dayLabel = days[date.getDay()];
              
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(height, 5)}%` }}
                    className="w-full bg-indigo-100 rounded-t-xl group-hover:bg-indigo-600 transition-all duration-300 relative border-b border-indigo-200"
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {count} messages
                    </div>
                  </motion.div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    i === 6 ? "text-indigo-600" : "text-gray-400"
                  )}>
                    {i === 6 ? 'Today' : dayLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="p-6 border-none shadow-sm bg-white">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
            <button className="text-gray-400 hover:text-gray-600">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-6">
            {recentActivity.length > 0 ? recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-4">
                <div className={cn("p-2 rounded-xl mt-0.5", activity.bg)}>
                  {activity.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{activity.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{activity.time}</p>
                </div>
                <button className="text-gray-400 hover:text-indigo-600">
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            )) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">No recent activity</p>
              </div>
            )}
          </div>
          
          <Button variant="outline" className="w-full mt-8 text-xs font-bold uppercase tracking-wider">
            View All Activity
          </Button>
        </Card>
      </div>
    </div>
  );
};
