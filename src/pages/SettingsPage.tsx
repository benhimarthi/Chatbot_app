import { Save, Globe, Lock, Key } from 'lucide-react';
import { Card, CustomButton as Button } from '../components/UI';

export const SettingsPage = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Chatbot Settings</h1>
        <p className="text-gray-500">Configure your AI's personality and business details.</p>
      </div>

      <div className="space-y-6">
        <Card className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Business Name</label>
              <input
                type="text"
                defaultValue="ChatFlow AI"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Website URL</label>
              <div className="relative flex items-center">
                <Globe className="absolute left-4 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  defaultValue="https://chatflow.ai"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Custom System Instructions</label>
            <textarea
              rows={5}
              placeholder="e.g. You are a helpful customer support agent for a SaaS company. Be professional, concise, and always offer to connect to a human if you can't solve the problem."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm resize-none"
            />
            <p className="text-xs text-gray-400">These instructions define how your AI behaves and responds to users.</p>
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
                placeholder="••••••••••••••••"
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
              />
            </div>
            <p className="text-xs text-gray-400">If provided, we'll use your own API key for all AI requests.</p>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="secondary">Discard Changes</Button>
          <Button className="gap-2">
            <Save className="w-4 h-4" />
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
};
