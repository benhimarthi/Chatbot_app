import { Bell, Search, User, Loader2 } from 'lucide-react';
import { auth, getNotifications, getUserSettings } from '../firebase';
import * as React from 'react';
import { NotificationDropdown } from './NotificationDropdown';

export const Navbar = () => {
  const user = auth.currentUser;
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [userSettings, setUserSettings] = React.useState<any>(null);

  React.useEffect(() => {
    if (!user) return;

    const unsubscribeNotifications = getNotifications(user.uid, (data) => {
      setNotifications(data);
    });

    const unsubscribeSettings = getUserSettings(user.uid, (settings) => {
      setUserSettings(settings);
    });

    return () => {
      unsubscribeNotifications();
      unsubscribeSettings();
    };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="h-16 bg-white border-bottom border-gray-100 px-8 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4 bg-gray-50 px-4 py-2 rounded-xl w-96">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search anything..."
          className="bg-transparent border-none outline-none text-sm w-full text-gray-600"
        />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors relative"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </button>
          <NotificationDropdown 
            notifications={notifications} 
            isOpen={isNotificationsOpen} 
            onClose={() => setIsNotificationsOpen(false)} 
          />
        </div>
        <div className="h-8 w-[1px] bg-gray-100 mx-2"></div>
        <div className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-1.5 rounded-xl transition-colors">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-gray-900 leading-none">{userSettings?.displayName || user?.displayName || 'User'}</p>
            <p className="text-xs text-gray-500 mt-1">{userSettings?.subscriptionPlan || 'Free'} Plan</p>
          </div>
          {user?.photoURL ? (
            <img src={user.photoURL} alt="User" className="w-9 h-9 rounded-full border border-indigo-200" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center border border-indigo-200">
              <User className="w-5 h-5 text-indigo-600" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
