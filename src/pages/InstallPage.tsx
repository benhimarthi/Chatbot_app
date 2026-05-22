import * as React from 'react';
import { useState } from 'react';
import { Copy, Check, Terminal, ExternalLink, Globe, Layout, Code } from 'lucide-react';
import { auth } from '../firebase';
import { Card, CustomButton as Button } from '../components/UI';

export const InstallPage = () => {
  const [copied, setCopied] = useState(false);
  const user = auth.currentUser;
  
  const appId = user?.uid || 'YOUR_APP_ID';
  const baseUrl = window.location.origin;

  const scriptCode = `<!-- ChatFlow Chatbot SDK -->
<script src="${baseUrl}/chatbot.js"></script>
<script>
  (function() {
    function init() {
      if (window.Chatbot) {
        window.Chatbot.init({
          apiKey: "${appId}",
          botName: "Support Assistant",
          welcomeMessage: "Hi! How can I help you today?",
          primaryColor: "#4CAF50"
        });
      } else {
        setTimeout(init, 100);
      }
    }
    if (document.readyState === 'complete') {
      init();
    } else {
      window.addEventListener('load', init);
    }
  })();
</script>
<!-- End ChatFlow Chatbot SDK -->`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Install Chatbot</h1>
        <p className="text-gray-500 text-sm mt-1">Connect ChatFlow to your website in just a few minutes.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <Code className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-gray-900">Embed Script</h2>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Copy and paste this code before the closing <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code> tag on every page you want the chatbot to appear.
            </p>

            <div className="relative group">
              <pre className="bg-gray-900 text-gray-300 p-6 rounded-xl overflow-x-auto text-sm font-mono leading-relaxed">
                {scriptCode}
              </pre>
              <button
                onClick={copyToClipboard}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase backdrop-blur-sm"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg text-green-600">
                  <ExternalLink className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-gray-900">Live Preview</h2>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs font-bold"
                onClick={() => window.open(`${baseUrl}/example.html`, '_blank')}
              >
                Open in New Tab
              </Button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              See how the chatbot looks on a real website. Use this preview to test the integration before deploying it.
            </p>

            <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50 h-[400px] relative">
              <iframe 
                src={`${baseUrl}/example.html`} 
                className="w-full h-full border-none"
                title="SDK Preview"
              />
              <div className="absolute top-2 left-2 bg-white/80 backdrop-blur px-2 py-1 rounded border border-gray-200 text-[10px] font-bold text-gray-500 pointer-events-none">
                PREVIEW ENVIRONMENT
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <Layout className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-gray-900">Installation Guides</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { name: 'WordPress', icon: 'https://s.w.org/style/images/about/WordPress-logotype-wmark.png' },
                { name: 'Shopify', icon: 'https://cdn.shopify.com/assets/images/logos/shopify-bag.png' },
                { name: 'SquareSpace', icon: 'https://images.squarespace-cdn.com/content/v1/5134cbefe4b0c6fb04df57ba/1547493630635-U55Y7D5U4A6U49B7W6U8/ss-logo.png' },
                { name: 'Custom Website', icon: null }
              ].map((guide) => (
                <div key={guide.name} className="p-4 border border-gray-100 rounded-xl hover:border-indigo-200 transition-colors flex items-center justify-between group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-gray-50 flex items-center justify-center overflow-hidden p-1">
                      {guide.icon ? <img src={guide.icon} alt={guide.name} className="w-full h-full object-contain" /> : <Globe className="w-4 h-4 text-gray-400" />}
                    </div>
                    <span className="text-sm font-bold text-gray-700">{guide.name}</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-indigo-600 border-none shadow-indigo-200/50">
            <div className="text-white space-y-4">
              <div className="p-3 bg-white/10 rounded-xl w-fit">
                <Terminal className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">Need help?</h3>
              <p className="text-indigo-100 text-sm leading-relaxed">
                If you're having trouble installing the widget, our support team can help you get set up for free.
              </p>
              <Button className="w-full bg-white text-indigo-600 hover:bg-indigo-50 border-none font-bold">
                Contact Support
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-bold text-gray-900 mb-4">Widget Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Your App ID</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-xs font-mono text-gray-600 border border-gray-100 break-all">
                  {appId}
                </div>
              </div>
              <p className="text-xs text-gray-500 italic">
                Never share your secret API key. The App ID is public and safe to use in frontend code.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
