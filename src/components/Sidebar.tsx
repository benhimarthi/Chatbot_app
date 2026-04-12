import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, MessageSquare, Settings, Bot, LogOut, Wallet, UserCircle, CalendarCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { logout, auth } from '../firebase';
import * as React from 'react';
import { ProfileModal } from './ProfileModal';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: CalendarCheck, label: 'Bookings', path: '/dashboard/bookings' },
  { icon: MessageSquare, label: 'Chat', path: '/dashboard/chat' },
  { icon: FileText, label: 'Documents', path: '/dashboard/documents' },
  { icon: Settings, label: 'Settings', path: '/dashboard/settings' },
];

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <aside className="w-64 h-screen bg-white border-r border-gray-100 flex flex-col sticky top-0">
      <Link to="/" className="p-6 flex items-center gap-3 hover:opacity-80 transition-opacity">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
          <Bot className="text-white w-6 h-6" />
        </div>
        <span className="font-bold text-xl tracking-tight text-gray-900">ChatFlow</span>
      </Link>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon className={cn('w-5 h-5', isActive ? 'text-indigo-600' : 'text-gray-400')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-50 space-y-2">
        <button 
          onClick={() => setIsProfileOpen(true)}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors group"
        >
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors overflow-hidden">
            {auth.currentUser?.photoURL ? (
              <img src={auth.currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserCircle className="w-5 h-5 text-indigo-600" />
            )}
          </div>
          <div className="flex-1 text-left truncate">
            <div className="font-bold text-gray-900 truncate">{auth.currentUser?.displayName || 'My Profile'}</div>
            <div className="text-[10px] text-gray-400 truncate">{auth.currentUser?.email}</div>
          </div>
        </button>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>

      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </aside>
  );
};
