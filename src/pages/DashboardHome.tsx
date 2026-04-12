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
import { auth, getDocuments } from '../firebase';
import { motion } from 'motion/react';

export const DashboardHome = () => {
  const [stats, setStats] = useState({
    documents: 0,
    activeBots: 1,
    users: 156
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const userId = auth.currentUser.uid;

    // Fetch documents count
    const unsubscribeDocs = getDocuments(userId, (docs) => {
      setStats(prev => ({ ...prev, documents: docs.length }));
      
      if (docs.length > 0) {
        const docActivity = {
          id: 'last-doc',
          type: 'document',
          title: 'New document processed',
          time: 'Just now',
          icon: <FileText className="w-4 h-4 text-blue-600" />,
          bg: 'bg-blue-50'
        };
        
        setRecentActivity(prev => {
          const filtered = prev.filter(a => a.type !== 'document');
          return [docActivity, ...filtered];
        });
      }
    });

    setIsLoading(false);

    return () => {
      unsubscribeDocs();
    };
  }, []);

  const statCards = [
    { 
      label: 'Knowledge Base', 
      value: stats.documents.toString(), 
      change: '+12%', 
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    { 
      label: 'Active Chatbot', 
      value: stats.activeBots.toString(), 
      change: '0%', 
      icon: Bot,
      color: 'text-amber-600',
      bg: 'bg-amber-50'
    },
    { 
      label: 'Avg Response', 
      value: '1.2s', 
      change: '-0.4s', 
      icon: TrendingUp,
      color: 'text-rose-600',
      bg: 'bg-rose-50'
    },
    { 
      label: 'Users', 
      value: stats.users.toString(), 
      change: '+5%', 
      icon: Users,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50'
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
                  <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                  <span className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                    stat.change.startsWith('+') ? "text-green-600 bg-green-50" : 
                    stat.change.startsWith('-') ? "text-rose-600 bg-rose-50" : "text-gray-600 bg-gray-50"
                  )}>
                    {stat.change}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mt-0.5">{stat.value}</h3>
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
          
          <div className="h-64 flex items-end justify-between gap-2 px-2">
            {[45, 62, 51, 78, 92, 68, 84].map((height, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  className="w-full bg-indigo-100 rounded-t-xl group-hover:bg-indigo-600 transition-all duration-300 relative"
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {height * 10} messages
                  </div>
                </motion.div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                </span>
              </div>
            ))}
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
