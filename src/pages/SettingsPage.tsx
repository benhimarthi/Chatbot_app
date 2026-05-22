import * as React from 'react';
import { useState, useEffect } from 'react';
import { Save, Globe, Lock, Key, Loader2, CheckCircle2, AlertCircle, RotateCcw, UserCircle, TrendingUp } from 'lucide-react';
import { Card, CustomButton as Button } from '../components/UI';
import { auth, getUserSettings, updateUserSettings, requestUpgrade } from '../firebase';
import { ProfileModal } from '../components/ProfileModal';
import { PLANS, UserSettings } from '../types';

export const SettingsPage = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [settings, setSettings] = useState({
    businessName: '',
    websiteUrl: '',
    customInstructions: '',
    apiKey: '',
    bookingEnabled: false,
    capacity: 20,
    reservationDuration: 90,
    openingHours: {
      start: '09:00',
      end: '22:00'
    }
  });
  const [originalSettings, setOriginalSettings] = useState({
    businessName: '',
    websiteUrl: '',
    customInstructions: '',
    apiKey: '',
    bookingEnabled: false,
    capacity: 20,
    reservationDuration: 90,
    openingHours: {
      start: '09:00',
      end: '22:00'
    }
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<UserSettings | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = getUserSettings(auth.currentUser.uid, (data) => {
      setUserData(data);
      const loadedSettings = {
        businessName: data.businessName || '',
        websiteUrl: data.websiteUrl || '',
        customInstructions: data.customInstructions || '',
        apiKey: data.apiKey || '',
        bookingEnabled: data.bookingEnabled || false,
        capacity: data.capacity || 20,
        reservationDuration: data.reservationDuration || 90,
        openingHours: data.openingHours || { start: '09:00', end: '22:00' }
      };
      setSettings(loadedSettings);
      setOriginalSettings(loadedSettings);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      await updateUserSettings(auth.currentUser.uid, settings);
      setSaveStatus('success');
      setOriginalSettings(settings);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestUpgrade = async () => {
    if (!auth.currentUser) return;
    setIsUpgrading(true);
    try {
      await requestUpgrade(auth.currentUser.uid);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Error requesting upgrade:', error);
    } finally {
      setIsUpgrading(false);
    }
  };

  const currentPlan = PLANS[userData?.subscriptionPlan] || PLANS.free;
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chatbot Settings</h1>
          <p className="text-gray-500">Configure your AI's personality and business details.</p>
        </div>
        <Button 
          variant="secondary" 
          onClick={() => setIsProfileOpen(true)}
          className="gap-2"
        >
          <UserCircle className="w-4 h-4" />
          Manage Profile
        </Button>
      </div>

      <div className="space-y-6">
        <Card className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Business Name</label>
              <input
                type="text"
                value={settings.businessName}
                onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                placeholder="e.g. ChatFlow AI"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Website URL</label>
              <div className="relative flex items-center">
                <Globe className="absolute left-4 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={settings.websiteUrl}
                  onChange={(e) => setSettings({ ...settings, websiteUrl: e.target.value })}
                  placeholder="https://chatflow.ai"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Custom System Instructions</label>
            <textarea
              rows={5}
              value={settings.customInstructions}
              onChange={(e) => setSettings({ ...settings, customInstructions: e.target.value })}
              placeholder="e.g. You are a helpful customer support agent for a SaaS company. Be professional, concise, and always offer to connect to a human if you can't solve the problem."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm resize-none"
            />
            <p className="text-xs text-gray-400">These instructions define how your AI behaves and responds to users.</p>
          </div>
        </Card>

        <Card className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                <Globe className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Reservations</h3>
                <p className="text-xs text-gray-400">Enable and configure online table bookings.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={settings.bookingEnabled}
                onChange={(e) => setSettings({ ...settings, bookingEnabled: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {settings.bookingEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Total Capacity</label>
                <input
                  type="number"
                  value={settings.capacity}
                  onChange={(e) => setSettings({ ...settings, capacity: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Reservation Duration (min)</label>
                <input
                  type="number"
                  value={settings.reservationDuration}
                  onChange={(e) => setSettings({ ...settings, reservationDuration: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Opening Time</label>
                <input
                  type="time"
                  value={settings.openingHours.start}
                  onChange={(e) => setSettings({ ...settings, openingHours: { ...settings.openingHours, start: e.target.value } })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Closing Time</label>
                <input
                  type="time"
                  value={settings.openingHours.end}
                  onChange={(e) => setSettings({ ...settings, openingHours: { ...settings.openingHours, end: e.target.value } })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
                />
              </div>
            </div>
          )}
        </Card>

        <Card className="space-y-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
              </div>
              <h3 className="font-bold text-gray-900">Usage & Subscription</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase rounded-md tracking-wider">
                {currentPlan.name} Plan
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Messages This Month</label>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-gray-900">{userData?.usage?.messages_this_month || 0}</span>
                <span className="text-xs text-gray-400">/ {currentPlan.max_messages_per_month.toLocaleString()}</span>
              </div>
              <div className="mt-2 w-full bg-gray-200 h-1 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full transition-all duration-500" 
                  style={{ width: `${Math.min(((userData?.usage?.messages_this_month || 0) / currentPlan.max_messages_per_month) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Bookings This Month</label>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-gray-900">{userData?.usage?.bookings_this_month || 0}</span>
                <span className="text-xs text-gray-400">/ {currentPlan.max_bookings_per_month.toLocaleString()}</span>
              </div>
              <div className="mt-2 w-full bg-gray-200 h-1 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-500" 
                  style={{ width: `${Math.min(((userData?.usage?.bookings_this_month || 0) / currentPlan.max_bookings_per_month) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-indigo-900">Need higher limits?</h4>
              <p className="text-xs text-indigo-700 mt-0.5">Upgrade to the Pro plan for up to 5,000 messages and 1,000 bookings.</p>
            </div>
            {userData?.upgrade_requested ? (
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs bg-white px-3 py-1.5 rounded-lg border border-indigo-100 italic">
                <CheckCircle2 className="w-4 h-4" />
                Upgrade Requested
              </div>
            ) : (
              <Button 
                onClick={handleRequestUpgrade}
                disabled={isUpgrading}
                size="sm"
                className="whitespace-nowrap"
              >
                {isUpgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Request Upgrade"}
              </Button>
            )}
          </div>
        </Card>

        <Card className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
              <Key className="w-4 h-4 text-orange-600" />
            </div>
            <h3 className="font-bold text-gray-900">API Configuration</h3>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Gemini API Key (Optional)</label>
            <div className="relative flex items-center">
              <Lock className="absolute left-4 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                placeholder="••••••••••••••••"
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
              />
            </div>
            <p className="text-xs text-gray-400">If provided, we'll use your own API key for all AI requests.</p>
          </div>
        </Card>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {saveStatus === 'success' && (
              <div className="flex items-center gap-2 text-green-600 font-bold text-sm animate-in fade-in slide-in-from-left-2">
                <CheckCircle2 className="w-4 h-4" />
                Settings saved
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center gap-2 text-rose-600 font-bold text-sm animate-in fade-in slide-in-from-left-2">
                <AlertCircle className="w-4 h-4" />
                Error saving
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button 
              variant="secondary" 
              onClick={() => setSettings(originalSettings)}
              disabled={!hasChanges || isSaving}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Discard
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="gap-2 min-w-[140px]"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
};
