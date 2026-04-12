import * as React from 'react';
import { Bell, Check, Info, AlertTriangle, XCircle, Clock, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { markNotificationAsRead } from '../firebase';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: any;
}

interface NotificationDropdownProps {
  notifications: Notification[];
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDropdown = ({ notifications, isOpen, onClose }: NotificationDropdownProps) => {
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'success': return { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50' };
      case 'warning': return { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50' };
      case 'error': return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' };
      default: return { icon: Info, color: 'text-indigo-500', bg: 'bg-indigo-50' };
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.ceil((date.getTime() - Date.now()) / (1000 * 60)),
      'minute'
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden"
        >
          <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
            <h3 className="font-bold text-gray-900">Notifications</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              {notifications.filter(n => !n.read).length} New
            </span>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-sm text-gray-500 font-medium">No notifications yet</p>
                <p className="text-xs text-gray-400 mt-1">We'll notify you when something happens.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map((notification) => {
                  const styles = getTypeStyles(notification.type);
                  return (
                    <div
                      key={notification.id}
                      onClick={() => !notification.read && markNotificationAsRead(notification.id)}
                      className={cn(
                        "p-4 hover:bg-gray-50 transition-colors cursor-pointer relative group",
                        !notification.read && "bg-indigo-50/30"
                      )}
                    >
                      {!notification.read && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
                      )}
                      <div className="flex gap-3">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", styles.bg)}>
                          <styles.icon className={cn("w-4 h-4", styles.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={cn("text-sm font-bold truncate", !notification.read ? "text-gray-900" : "text-gray-600")}>
                              {notification.title}
                            </p>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(notification.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                            {notification.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-3 bg-gray-50/50 border-t border-gray-50 text-center">
              <button className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-indigo-600 transition-colors">
                View All Notifications
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
