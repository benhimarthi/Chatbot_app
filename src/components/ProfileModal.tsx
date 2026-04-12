import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Mail, CreditCard, Check, Shield, Zap, Star } from 'lucide-react';
import { auth, updateUserSettings, getUserSettings, addNotification } from '../firebase';
import { cn } from '../lib/utils';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    features: ['5 Documents', 'Basic AI Chat', '1GB Storage'],
    icon: Shield,
    color: 'text-gray-500',
    bg: 'bg-gray-50',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$19',
    features: ['Unlimited Documents', 'Advanced RAG', '10GB Storage', 'Priority Support'],
    icon: Zap,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$49',
    features: ['Custom AI Models', 'Team Collaboration', 'Unlimited Storage', 'Dedicated Support'],
    icon: Star,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
];

export const ProfileModal = ({ isOpen, onClose }: ProfileModalProps) => {
  const [userSettings, setUserSettings] = React.useState<any>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [displayName, setDisplayName] = React.useState('');
  const [businessName, setBusinessName] = React.useState('');

  React.useEffect(() => {
    if (isOpen && auth.currentUser) {
      const unsubscribe = getUserSettings(auth.currentUser.uid, (settings) => {
        setUserSettings(settings);
        setDisplayName(settings.displayName || auth.currentUser?.displayName || '');
        setBusinessName(settings.businessName || '');
      });
      return () => unsubscribe();
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      await updateUserSettings(auth.currentUser.uid, {
        displayName,
        businessName,
      });

      // Add notification
      await addNotification(auth.currentUser.uid, {
        title: 'Profile Updated',
        message: 'Your personal information has been successfully updated.',
        type: 'success'
      });

      onClose();
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePlan = async (planId: string) => {
    if (!auth.currentUser) return;
    try {
      await updateUserSettings(auth.currentUser.uid, {
        subscriptionPlan: planId,
      });

      // Add notification
      await addNotification(auth.currentUser.uid, {
        title: 'Subscription Updated',
        message: `Your plan has been changed to ${planId.charAt(0).toUpperCase() + planId.slice(1)}.`,
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to update plan:', error);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                  <User className="text-white w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Profile Settings</h2>
                  <p className="text-sm text-gray-500">Manage your account and subscription</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white rounded-full transition-colors shadow-sm"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
              {/* Personal Info */}
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                        placeholder="Your name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={auth.currentUser?.email || ''}
                        disabled
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border border-gray-100 rounded-xl text-sm text-gray-500 cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-gray-700">Business Name</label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                      placeholder="Your company name"
                    />
                  </div>
                </div>
              </section>

              {/* Subscription Plans */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Subscription Plan</h3>
                  <span className="text-xs font-medium px-2 py-1 bg-indigo-100 text-indigo-600 rounded-full">
                    Current: {userSettings?.subscriptionPlan || 'Free'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {plans.map((plan) => {
                    const isCurrent = (userSettings?.subscriptionPlan || 'free') === plan.id;
                    return (
                      <button
                        key={plan.id}
                        onClick={() => handleUpdatePlan(plan.id)}
                        className={cn(
                          "relative p-4 rounded-2xl border text-left transition-all group",
                          isCurrent 
                            ? "border-indigo-600 bg-indigo-50/30 ring-1 ring-indigo-600" 
                            : "border-gray-100 hover:border-indigo-200 hover:bg-gray-50"
                        )}
                      >
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-3", plan.bg)}>
                          <plan.icon className={cn("w-5 h-5", plan.color)} />
                        </div>
                        <div className="font-bold text-gray-900">{plan.name}</div>
                        <div className="text-xl font-black text-indigo-600 mt-1">{plan.price}<span className="text-xs font-normal text-gray-400">/mo</span></div>
                        <ul className="mt-4 space-y-2">
                          {plan.features.slice(0, 2).map((feature, i) => (
                            <li key={i} className="flex items-center gap-2 text-[10px] text-gray-500">
                              <Check className="w-3 h-3 text-green-500" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                        {isCurrent && (
                          <div className="absolute top-3 right-3">
                            <div className="bg-indigo-600 rounded-full p-1">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-white rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-8 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
