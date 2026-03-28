import { Users, MessageSquare, FileText, TrendingUp } from 'lucide-react';
import { Card } from '../components/UI';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

const stats = [
  { label: 'Total Documents', value: '12', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'Messages Used', value: '842', icon: MessageSquare, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { label: 'Active Chatbots', value: '2', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
  { label: 'Total Users', value: '156', icon: Users, color: 'text-orange-600', bg: 'bg-orange-50' },
];

export const DashboardHome = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, Alex!</h1>
        <p className="text-gray-500">Here's what's happening with your chatbots today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="flex items-center gap-4">
              <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', stat.bg)}>
                <stat.icon className={cn('w-6 h-6', stat.color)} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Usage Analytics</h3>
            <select className="bg-gray-50 border-none text-sm font-medium text-gray-600 rounded-lg px-3 py-1.5 outline-none">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
            </select>
          </div>
          <div className="h-64 flex items-end justify-between gap-2 px-4">
            {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  className="w-full bg-indigo-100 rounded-t-lg hover:bg-indigo-600 transition-colors cursor-pointer group relative"
                >
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {h * 10} messages
                  </span>
                </motion.div>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Day {i + 1}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-bold text-gray-900 mb-6">Recent Activity</h3>
          <div className="space-y-6">
            {[
              { type: 'upload', text: 'New document "Pricing.pdf" uploaded', time: '2h ago' },
              { type: 'chat', text: '50 new messages in "Support Bot"', time: '4h ago' },
              { type: 'settings', text: 'Custom instructions updated', time: '1d ago' },
            ].map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-2 h-2 rounded-full bg-indigo-600 mt-2 shrink-0" />
                <div>
                  <p className="text-sm text-gray-800 font-medium">{item.text}</p>
                  <p className="text-xs text-gray-400 mt-1">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
