import * as React from 'react';
import { useState, useEffect } from 'react';
import { Save, Globe, Lock, Key, Loader2, CheckCircle2, AlertCircle, RotateCcw, UserCircle, Sparkles } from 'lucide-react';
import { Card, CustomButton as Button } from '../components/UI';
import { auth, getUserSettings, updateUserSettings } from '../firebase';
import { ProfileModal } from '../components/ProfileModal';
import { SUBSCRIPTION_LIMITS, SubscriptionPlan } from '../constants/subscriptions';

export const SettingsPage = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [settings, setSettings] = useState({
    businessName: '',
    websiteUrl: '',
    customInstructions: '',
    apiKey: ''
  });
  const [originalSettings, setOriginalSettings] = useState({
    businessName: '',
    websiteUrl: '',
    customInstructions: '',
    apiKey: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(true);

  const plan: SubscriptionPlan = (settings as any).subscriptionPlan?.toLowerCase() || 'free';

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = getUserSettings(auth.currentUser.uid, (data) => {
      const loadedSettings = {
        businessName: data.businessName || '',
        websiteUrl: data.websiteUrl || '',
        customInstructions: data.customInstructions || '',
        apiKey: data.apiKey || '',
        subscriptionPlan: data.subscriptionPlan || 'free'
      };
      setSettings(loadedSettings);
      setOriginalSettings(loadedSettings);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handlePlanChange = async (newPlan: SubscriptionPlan) => {
    if (!auth.currentUser) return;
    try {
      await updateUserSettings(auth.currentUser.uid, { subscriptionPlan: newPlan });
    } catch (error) {
      console.error('Error updating plan:', error);
    }
  };

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
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <h3 className="font-bold text-gray-900">Subscription Plan</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.keys(SUBSCRIPTION_LIMITS) as SubscriptionPlan[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePlanChange(p)}
                className={`p-4 rounded-2xl border-2 text-left transition-all ${
                  plan === p 
                  ? "border-indigo-600 bg-indigo-50/50" 
                  : "border-gray-100 hover:border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold capitalize">{p}</span>
                  {plan === p && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                    {SUBSCRIPTION_LIMITS[p].maxChats === Infinity ? 'Unlimited' : `${SUBSCRIPTION_LIMITS[p].maxChats} Chats`}
                  </p>
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                    {SUBSCRIPTION_LIMITS[p].maxDocsPerChat === Infinity ? 'All Docs' : `${SUBSCRIPTION_LIMITS[p].maxDocsPerChat} Docs/Chat`}
                  </p>
                </div>
              </button>
            ))}
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
