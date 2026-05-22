import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, MessageSquare, Settings, LogOut, Wallet, UserCircle, Briefcase, Code, Users, Shield, Inbox } from 'lucide-react';
import { cn } from '../lib/utils';
import { logout, auth, getUserSettings } from '../firebase';
import * as React from 'react';
import { ProfileModal } from './ProfileModal';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: FileText, label: 'Documents', path: '/dashboard/documents' },
  { icon: MessageSquare, label: 'Chat', path: '/dashboard/chat' },
  { icon: Inbox, label: 'WhatsApp', path: '/dashboard/whatsapp' },
  { icon: Briefcase, label: 'Business', path: '/dashboard/business' },
  { icon: Users, label: 'Customers', path: '/dashboard/customers' },
  { icon: Code, label: 'Install', path: '/dashboard/install' },
  { icon: Settings, label: 'Settings', path: '/dashboard/settings' },
];

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);

  React.useEffect(() => {
    if (!auth.currentUser) return;
    
    const unsubscribe = getUserSettings(auth.currentUser.uid, (settings) => {
      setIsAdmin(settings?.role === 'admin' || auth.currentUser?.email === 'technov009@gmail.com');
    });

    return () => unsubscribe();
  }, []);

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
      <Link to="/" className="p-6 flex items-center hover:opacity-80 transition-opacity">
        <span className="font-bold text-xl tracking-tight text-gray-900">Chat<span className="text-indigo-600">Flow</span></span>
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
        {isAdmin && (
          <Link
            to="/dashboard/admin"
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
              location.pathname === '/dashboard/admin'
                ? 'bg-rose-50 text-rose-600'
                : 'text-gray-500 hover:bg-rose-50 hover:text-rose-600'
            )}
          >
            <Shield className={cn('w-5 h-5', location.pathname === '/dashboard/admin' ? 'text-rose-600' : 'text-gray-400')} />
            Admin
          </Link>
        )}
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
