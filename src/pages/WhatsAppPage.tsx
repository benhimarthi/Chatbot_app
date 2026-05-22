import * as React from 'react';
import { 
  Loader2, Send, CheckCircle2, AlertCircle, RefreshCw, Smartphone, 
  QrCode, MessageSquare, Wifi, WifiOff, Check, CheckCheck, User, Reply,
  HelpCircle, Sparkles, Terminal, ChevronDown, ChevronRight, Play, Copy
} from 'lucide-react';
import { auth, db } from '../firebase';
import { 
  collection, query, where, orderBy, onSnapshot, doc, updateDoc, setDoc
} from 'firebase/firestore';
import axios from 'axios';

interface Conversation {
  id: string;
  workspaceId: string;
  whatsappInstance: string;
  contactPhone: string;
  contactName: string;
  lastMessage: string;
  lastMessageAt?: any;
  unreadCount: number;
  updatedAt?: any;
}

interface Message {
  id: string;
  workspaceId: string;
  conversationId: string;
  from: string;
  to: string;
  content: string;
  type: string;
  direction: 'incoming' | 'outgoing';
  timestamp?: any;
  status: 'sent' | 'received' | 'read' | 'pending';
}

export const WhatsAppPage = () => {
  const [activeTab, setActiveTab] = React.useState<'inbox' | 'connection'>('inbox');
  const [currentUser, setCurrentUser] = React.useState<any>(null);
  
  // Connection states
  const [connectionState, setConnectionState] = React.useState<{
    connected: boolean;
    state: string;
    phone: string;
    instanceName: string;
  }>({
    connected: false,
    state: 'close',
    phone: '',
    instanceName: ''
  });
  
  const [qrCode, setQrCode] = React.useState<string>('');
  const [isGeneratingQR, setIsGeneratingQR] = React.useState<boolean>(false);
  const [isCheckingState, setIsCheckingState] = React.useState<boolean>(false);
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  
  // Real-time Success State Management
  const [showSuccessModal, setShowSuccessModal] = React.useState<boolean>(false);
  const isFirstCheckRef = React.useRef<boolean>(true);

  // Webhook Event Developer logs
  const [webhookLogs, setWebhookLogs] = React.useState<any[]>([]);
  const [expandedLogId, setExpandedLogId] = React.useState<string | null>(null);

  const connectionLogs = React.useMemo(() => {
    return webhookLogs.filter(log => 
      (log.event === 'connection.update' || log.event === 'CONNECTION_UPDATE') && log.connected
    );
  }, [webhookLogs]);

  const isWebhookReached = webhookLogs.length > 0;
  const isDeviceConnectedViaWebhook = connectionLogs.length > 0;

  // Sub-second Real-time Webhook log listener
  React.useEffect(() => {
    if (!currentUser) return;

    const docRef = doc(db, 'workspaces', currentUser.uid, 'whatsapp', 'logs_history');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && Array.isArray(data.logs)) {
          setWebhookLogs(data.logs);
        }
      }
    }, (err) => {
      console.warn("Realtime Webhook Log subscribe failed (safely continuing):", err);
    });

    return () => unsubscribe();
  }, [currentUser]);
  
  // Inbox states
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = React.useState<Conversation | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [replyText, setReplyText] = React.useState<string>('');
  const [isSending, setIsSending] = React.useState<boolean>(false);

  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

  // Setup user and initial state checks
  React.useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
        checkStatus(user);
      }
    });
    return () => unsub();
  }, []);

  // Poll status while QR is active or during active setting view
  React.useEffect(() => {
    if (!currentUser) return;
    
    // Check status immediately
    checkStatus(currentUser);

    // Setup interval to poll status every 6 seconds to detect successful scan
    const interval = setInterval(() => {
      checkStatus(currentUser);
    }, 6000);

    return () => clearInterval(interval);
  }, [currentUser]);

  // Sub-second Real-time listener for workspace connection state changes (instant scan detection)
  React.useEffect(() => {
    if (!currentUser) return;

    const instanceName = `instance_${currentUser.uid}`;
    const docRef = doc(db, 'workspaces', currentUser.uid, 'whatsapp', instanceName);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const isNowConnected = !!data.connected;
        
        setConnectionState(prev => {
          const wasConnected = prev.connected;
          
          // Trigger success modal on transitioning from disconnected to connected state
          if (isNowConnected && !wasConnected && !isFirstCheckRef.current) {
            setShowSuccessModal(true);
          }
          
          return {
            connected: isNowConnected,
            state: isNowConnected ? 'open' : 'close',
            phone: data.phone || '',
            instanceName: instanceName
          };
        });

        if (isNowConnected) {
          setQrCode(''); // Clear QR if connected successfully
        }
        
        // Mark first check as completed so subsequent changes can trigger celebration
        isFirstCheckRef.current = false;
      }
    }, (err) => {
      console.warn("Realtime active connection check failed, falling back to REST checks:", err);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Real-time Webhook Client-Side Ingestion Fallback
  React.useEffect(() => {
    if (!currentUser) return;

    const pullUpdates = async () => {
      try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch('/api/whatsapp/pending-updates', {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        const res = await response.json();
        if (res.success && res.updates && res.updates.length > 0) {
          for (const update of res.updates) {
            try {
              const sanitizedData = { ...update.data };
              if (sanitizedData.timestamp && typeof sanitizedData.timestamp === 'string') {
                sanitizedData.timestamp = new Date(sanitizedData.timestamp);
              }
              if (sanitizedData.lastMessageAt && typeof sanitizedData.lastMessageAt === 'string') {
                sanitizedData.lastMessageAt = new Date(sanitizedData.lastMessageAt);
              }
              if (sanitizedData.updatedAt && typeof sanitizedData.updatedAt === 'string') {
                sanitizedData.updatedAt = new Date(sanitizedData.updatedAt);
              }

              if (update.collection === 'workspaces' && update.parentPath) {
                const ref = doc(db, update.parentPath, update.id);
                await setDoc(ref, sanitizedData, { merge: true });
              } else if (update.collection === 'messages') {
                const ref = doc(db, 'messages', update.id);
                await setDoc(ref, sanitizedData);
              } else if (update.collection === 'conversations') {
                const ref = doc(db, 'conversations', update.id);
                await setDoc(ref, sanitizedData, { merge: true });
              }
            } catch (writeErr) {
              console.error("Client ingestion error of webhook update:", writeErr);
            }
          }
        }
      } catch (err) {
        console.error("Error polling webhook updates from space:", err);
      }
    };

    pullUpdates();
    const pollTimer = setInterval(pullUpdates, 3000);
    return () => clearInterval(pollTimer);
  }, [currentUser]);

  // Real-time listener for Conversations
  React.useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'conversations'),
      where('workspaceId', '==', currentUser.uid),
      orderBy('lastMessageAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Conversation }));
      setConversations(list);
    }, (err) => {
      console.error("Conversations realtime hook error:", err);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Real-time listener for Messages of Selected Conversation
  React.useEffect(() => {
    if (!currentUser || !selectedConv) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'messages'),
      where('conversationId', '==', selectedConv.id),
      where('workspaceId', '==', currentUser.uid),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Message }));
      setMessages(list);
      
      // Auto-scroll to lowest message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (err) => {
      console.error("Messages realtime hook error:", err);
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser, selectedConv]);

  // Mark selected conversation as read
  React.useEffect(() => {
    if (!selectedConv || selectedConv.unreadCount === 0) return;

    const markAsRead = async () => {
      try {
        const convRef = doc(db, 'conversations', selectedConv.id);
        await updateDoc(convRef, { unreadCount: 0 });
      } catch (e) {
        console.error("Failed to reset unread count:", e);
      }
    };
    markAsRead();
  }, [selectedConv, messages]);

  const checkStatus = async (user = currentUser) => {
    if (!user) return;
    try {
      setIsCheckingState(true);
      const token = await user.getIdToken();
      const response = await axios.get('/api/whatsapp/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data?.success) {
        const isNowConnected = response.data.connected;
        
        setConnectionState(prev => {
          const wasConnected = prev.connected;
          
          // Trigger success modal on transitioning from disconnected to connected state (REST backup)
          if (isNowConnected && !wasConnected && !isFirstCheckRef.current) {
            setShowSuccessModal(true);
          }
          
          return {
            connected: isNowConnected,
            state: response.data.state,
            phone: response.data.phone || '',
            instanceName: response.data.instanceName
          };
        });

        if (isNowConnected) {
          setQrCode(''); // Clear QR if connected successfully
        }
        
        isFirstCheckRef.current = false;
      }
    } catch (err: any) {
      console.error("Error checking whatsapp status:", err);
    } finally {
      setIsCheckingState(false);
    }
  };

  const generateQR = async () => {
    if (!currentUser) return;
    try {
      setIsGeneratingQR(true);
      setErrorMessage('');
      setQrCode('');
      
      // Force first check check to false so pairing successfully triggers the success celebration modal
      isFirstCheckRef.current = false;

      const token = await currentUser.getIdToken();
      const response = await axios.post('/api/whatsapp/connect', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data?.success) {
        if (response.data.qrCode) {
          setQrCode(response.data.qrCode);
        } else {
          setErrorMessage('Failed to generate connection payload. Please try again.');
        }
        setConnectionState(prev => ({ ...prev, instanceName: response.data.instanceName }));
      }
    } catch (err: any) {
      console.error("Failed to generate QR Code:", err);
      setErrorMessage(err?.response?.data?.error || 'Instance connection failed. Check host alignment.');
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const [isSimulating, setIsSimulating] = React.useState<boolean>(false);
  const [simulationSuccess, setSimulationSuccess] = React.useState<boolean>(false);
  const [isCopied, setIsCopied] = React.useState<boolean>(false);

  const copyWebhookUrl = () => {
    const absoluteUrl = window.location.origin + '/api/whatsapp/webhook';
    navigator.clipboard.writeText(absoluteUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const triggerSimulatedWebhook = async () => {
    if (!currentUser) return;
    try {
      setIsSimulating(true);
      setSimulationSuccess(false);
      const token = await currentUser.getIdToken();
      await axios.post('/api/whatsapp/simulate-webhook', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSimulationSuccess(true);
      setTimeout(() => setSimulationSuccess(false), 3000);
    } catch (err: any) {
      console.error("Simulation failed:", err);
      setErrorMessage(err?.response?.data?.error || "Simulation endpoint rejected package.");
    } finally {
      setIsSimulating(false);
    }
  };

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser || !selectedConv || !replyText.trim()) return;

    try {
      setIsSending(true);
      const token = await currentUser.getIdToken();
      await axios.post('/api/whatsapp/send', {
        recipientPhone: selectedConv.contactPhone,
        messageText: replyText
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReplyText('');
    } catch (err: any) {
      console.error("Failed to send message:", err);
      alert(err?.response?.data?.error || 'Failed to dispatch WhatsApp message');
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickReply = (text: string) => {
    setReplyText(text);
  };

  const quickReplies = [
    "Hello! How can we assist you today?",
    "We have processed your reservation request successfully.",
    "Could you please confirm your booking time?",
    "Thank you for contacting Chatflow customer support."
  ];

  return (
    <div className="h-full flex flex-col gap-6" id="whatsapp-root">
      {/* Header and navigation tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">WhatsApp Integration</h1>
            {connectionState.connected ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live: Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Offline: Disconnected
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Connect your Business WhatsApp via Evolution API to receive and send real-time customer conversations.
          </p>
        </div>

        <div className="flex gap-2 bg-gray-100/80 p-1.5 rounded-xl self-start sm:self-center">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'inbox' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Real-time Inbox
          </button>
          <button
            onClick={() => setActiveTab('connection')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'connection' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Connection Settings
          </button>
        </div>
      </div>

      {activeTab === 'connection' ? (
        /* CONNECTION MANAGER TAB */
        <div className="flex flex-col gap-6 animate-fade-in" id="connection-manager">
          {connectionState.connected && (
            <div className="bg-emerald-50 border border-emerald-150 text-emerald-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm animate-scale-up" id="whatsapp-master-success-alert">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                  <CheckCircle2 className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                    WhatsApp Active Connection Stable
                  </h4>
                  <p className="text-[10px] text-emerald-700 mt-0.5">Your phone has authenticated. You can safely close this settings panel or launch the real-time inbox below.</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab('inbox')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow hover:shadow-emerald-100 active:scale-[0.98] self-start sm:self-center"
              >
                Launch Real-time Chats
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 flex flex-col gap-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-indigo-600" /> WhatsApp Linker instructions
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Link your smartphone to host an automated customer responder dashboard.
                </p>
              </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl relative">
                <div className="absolute top-4 right-4 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  Step 1
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">Open WhatsApp</h3>
                <p className="text-xs text-gray-500 mt-2">
                  Open WhatsApp on your mobile phone and tap the settings menu.
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl relative">
                <div className="absolute top-4 right-4 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  Step 2
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">Linked Devices</h3>
                <p className="text-xs text-gray-500 mt-2">
                  Select <strong className="text-gray-700">Linked Devices</strong> and then tap <strong className="text-gray-700">Link a Device</strong>.
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl relative">
                <div className="absolute top-4 right-4 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  Step 3
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">Scan QR Code</h3>
                <p className="text-xs text-gray-500 mt-2">
                  Point your camera to the right QR Code on this desk console screen.
                </p>
              </div>
            </div>

            {/* Status overview card */}
            <div className={`p-4 rounded-xl flex items-center gap-4 ${
              connectionState.connected ? 'bg-green-50 border border-green-100' : 'bg-amber-50 border border-amber-100'
            }`}>
              {connectionState.connected ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                    <Wifi className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-green-900 text-sm">Instance Sync Alive</h4>
                    <p className="text-xs text-green-700 mt-0.5">
                      Your phone connection is stable. Current Number: <strong className="text-green-900">{connectionState.phone || 'Ready'}</strong>
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                    <WifiOff className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900 text-sm">Device Disconnected</h4>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Generate a live session credential QR code and link your phone manually.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={generateQR}
                disabled={isGeneratingQR || connectionState.connected}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors flex items-center gap-2"
              >
                {isGeneratingQR && <Loader2 className="w-4 h-4 animate-spin" />}
                {connectionState.connected ? 'WhatsApp Linked' : 'Generate Connection QR Code'}
              </button>

              <button
                onClick={() => checkStatus()}
                disabled={isCheckingState}
                className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                title="Sync and Refresh connection"
              >
                <RefreshCw className={`w-4 h-4 ${isCheckingState ? 'animate-spin text-indigo-600' : ''}`} />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center justify-center text-center">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-2">
              <QrCode className="w-4 h-4 text-indigo-600" /> Link QR QR-Scan Stage
            </h3>
            
            <div className="w-64 h-64 border-2 border-dashed border-gray-100 rounded-xl my-4 bg-gray-50/50 flex items-center justify-center overflow-hidden p-2">
              {isGeneratingQR ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                  <span className="text-xs text-gray-400 font-medium">Provisioning instance...</span>
                </div>
              ) : connectionState.connected ? (
                <div className="flex flex-col items-center gap-4 text-emerald-600 p-4 animate-scale-up">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center relative shadow-inner">
                    <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
                    <CheckCircle2 className="w-9 h-9 relative z-10" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-gray-900 leading-tight block">Successfully Connected!</span>
                    <p className="text-[10px] text-gray-400 leading-normal max-w-[180px]">Your phone has authenticated. You can safely close this screen or go back to messages.</p>
                  </div>
                </div>
              ) : qrCode ? (
                <div className="relative w-full h-full bg-white flex items-center justify-center">
                  {qrCode.startsWith('data:') ? (
                    <img src={qrCode} alt="WhatsApp QR Code" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="p-4 text-[8px] font-mono break-all text-gray-500">{qrCode}</div>
                  )}
                </div>
              ) : (
                <div className="text-center p-4">
                  <Smartphone className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <span className="text-xs text-gray-400">Click Generate button to assemble new token code</span>
                </div>
              )}
            </div>

            {errorMessage && (
              <div className="text-xs text-red-600 mt-2 px-2 py-1 bg-red-50 rounded-lg flex items-center gap-1.5 justify-center max-w-full">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{errorMessage}</span>
              </div>
            )}

            <p className="text-xs text-gray-400 mt-2">
              System uses real-time event socket sync. Scan takes effect immediately.
            </p>
          </div>
        </div>

        {/* 📡 Under-The-Hood: Live Webhook & Connection Event Stream */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col gap-5 text-white shadow-xl mt-6 animate-scale-up" id="developer-webhook-console">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-800 text-indigo-400 flex items-center justify-center border border-slate-700">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-mono font-bold tracking-wider text-slate-300 uppercase block">Under-The-Hood: Live Event Stream</span>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">Tracing evolution: webhook listener & metadata extractor</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={triggerSimulatedWebhook}
                disabled={isSimulating}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold flex items-center gap-2 transition-all ${
                  simulationSuccess
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 disabled:opacity-50 shadow-lg shadow-indigo-950/50'
                }`}
                title="Inject a virtual Evolution API scan webhook to check extraction logic instantly"
              >
                {isSimulating ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Dispatching...
                  </>
                ) : simulationSuccess ? (
                  <>
                    <Check className="w-3 h-3 animate-bounce" />
                    Webhook Dispatched!
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    Test Webhook Extraction Pipeline
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="text-slate-350 text-xs leading-relaxed space-y-2 font-mono">
            <p className="text-slate-300 font-bold text-xs flex items-center gap-1.5 text-indigo-400">
              ⚡ Webhook Integration Absolute Target
            </p>
            <p className="text-[11px] text-slate-450">
              Our full-stack Cloud Run container hosts both the React interface and the live Node.js/Express backend daemon under a single port. To listen for link-scans and chats, configure the following absolute URL exactly inside your Evolution API panel:
            </p>
            <div className="flex items-stretch gap-2">
              <div className="flex-1 bg-slate-950 hover:bg-black transition-colors px-3 py-2 flex items-center rounded-xl border border-slate-800 text-indigo-300 text-xs font-mono break-all select-all">
                {window.location.origin}/api/whatsapp/webhook
              </div>
              <button
                onClick={copyWebhookUrl}
                className={`px-4 rounded-xl font-bold font-mono text-xs flex items-center gap-1.5 transition-all outline-none ${
                  isCopied 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700'
                }`}
              >
                {isCopied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Webhook Connectivity & Reachability Validation Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
            {/* Gateway Connectivity Box */}
            <div className={`p-4 rounded-xl border ${
              isWebhookReached 
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200 font-mono text-[11px]' 
                : 'bg-amber-950/45 border-amber-800 text-amber-200 animate-pulse font-mono text-[11px]'
            }`}>
              <div className="flex items-center gap-2 mb-1.5 font-bold">
                <div className={`w-2 h-2 rounded-full ${isWebhookReached ? 'bg-emerald-400 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
                <span className="text-[10px] uppercase tracking-wider">Webhook Endpoint Reachability</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">
                {isWebhookReached 
                  ? `🟢 REACHED & ACTIVE: Webhook listener has successfully received ${webhookLogs.length} events from the outer web (confirmed reachability).`
                  : '🟡 WAITING FOR INCOMING WEBHOOKS... Click "Test Webhook Extraction Pipeline" button or scan components to check reachability.'
                }
              </p>
            </div>

            {/* Device Scanner Extractor Box */}
            <div className={`p-4 rounded-xl border ${
              isDeviceConnectedViaWebhook 
                ? 'bg-indigo-950/40 border-indigo-800 text-indigo-200 font-mono text-[11px]' 
                : connectionState.connected 
                  ? 'bg-amber-950/30 border-amber-800/60 text-amber-200 font-mono text-[11px]' 
                  : 'bg-slate-950/80 border-slate-800 text-slate-400 font-mono text-[11px]'
            }`}>
              <div className="flex items-center gap-2 mb-1.5 font-bold">
                <div className={`w-2 h-2 rounded-full ${isDeviceConnectedViaWebhook ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'}`} />
                <span className="text-[10px] uppercase tracking-wider">Device Scan Webhook Verification</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">
                {isDeviceConnectedViaWebhook 
                  ? `✅ DEVICE CONNECTED (WEBHOOK): Phone +${connectionLogs[0].phone || 'N/A'} is fully verified connected via decoded webhook metadata payload.`
                  : connectionState.connected
                    ? 'ℹ️ SCAN DETECTED: QR scanned successfully. Awaiting final state update to log inside active console.'
                    : '⏳ WAITING SCAN: Please scan the QR code above. Once scanned successfully, connection logs will stream immediately.'
                }
              </p>
            </div>
          </div>

          <div className="space-y-3 font-mono">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Active Console Logs ({webhookLogs.length})
            </div>

            {webhookLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-2 text-slate-500 bg-slate-950/40 rounded-xl border border-slate-850/30">
                <AlertCircle className="w-5 h-5 text-slate-600 animate-pulse" />
                <p className="text-xs">No webhooks captured yet for your workspace.</p>
                <p className="text-[9px] text-slate-600 max-w-sm">
                  Click the "Test Webhook Extraction Pipeline" button above to simulate a link scan and trace code performance immediately.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {webhookLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <div 
                      key={log.id} 
                      className="bg-slate-950/60 hover:bg-slate-950 rounded-xl border border-slate-850 p-4 transition-all"
                    >
                      <div 
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            log.event && log.event.includes('connection') 
                              ? 'bg-indigo-950/80 text-indigo-400 border border-indigo-900/50' 
                              : 'bg-emerald-950/80 text-emerald-400 border border-emerald-900/50'
                          }`}>
                            {log.event}
                          </span>
                          <span className="text-xs text-slate-200 font-bold">
                            {log.phone ? `Phone: +${log.phone}` : 'Phone: N/A'}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            log.connected ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                          }`}>
                            {log.connected ? 'Connected' : 'Disconnected'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-3 border-t border-slate-850/60 space-y-4 animate-scale-up">
                          <div className="space-y-1.5 bg-slate-950/85 p-3 rounded-lg border border-slate-900">
                            <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-2 border-b border-slate-900 pb-1 flex items-center justify-between">
                              <span>Webhook Handshake Processing Chain</span>
                              <span className="text-slate-500 font-normal">server.ts:743</span>
                            </div>
                            {Array.isArray(log.steps) ? log.steps.map((step, idx) => (
                              <div key={idx} className="flex gap-2 text-[11px] leading-relaxed">
                                <span className="text-emerald-400 font-bold flex-shrink-0">✓</span>
                                <span className="text-slate-300">{step}</span>
                              </div>
                            )) : (
                              <div className="text-[11px] text-slate-400">Pipeline logs processed successfully.</div>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                              <span>Payload Metadata (payload.data) Passed:</span>
                              <span className="text-slate-500">JSON Format</span>
                            </div>
                            <pre className="text-[10px] overflow-x-auto bg-slate-950 p-3 rounded-lg border border-slate-900 text-indigo-300 select-all max-h-48 overflow-y-auto">
                              {JSON.stringify(log.payloadReceived, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      ) : (
        /* REALTIME INBOX TAB */
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col md:flex-row h-[600px]" id="realtime-inbox">
          {/* Left Pane - Conversations List */}
          <div className="w-full md:w-80 border-r border-gray-100 flex flex-col h-full bg-gray-50/50">
            <div className="p-4 border-b border-gray-100 bg-white flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-600" /> Active Chats ({conversations.length})
              </span>
              <button 
                onClick={() => checkStatus()}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                title="Sync Database inbox status"
              >
                <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-2 space-y-1">
              {conversations.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                  <MessageSquare className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-xs font-medium text-gray-400">No active conversations found</p>
                  <p className="text-[10px] text-gray-400 mt-1">Incoming messages scanned from WhatsApp will be listed here instantly.</p>
                </div>
              ) : (
                conversations.map((conv) => {
                  const isSelected = selectedConv?.id === conv.id;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConv(conv)}
                      className={`w-full text-left p-3 rounded-xl transition-all duration-200 flex items-start gap-3 relative ${
                        isSelected 
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100' 
                          : 'bg-white hover:bg-white/80 text-gray-700 border border-gray-50'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-indigo-500' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <User className="w-4 h-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h4 className={`font-bold text-xs truncate ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                            {conv.contactName || conv.contactPhone}
                          </h4>
                          {conv.lastMessageAt && (
                            <span className={`text-[9px] ${isSelected ? 'text-indigo-200' : 'text-gray-400'}`}>
                              {new Date(conv.lastMessageAt?.seconds * 1000 || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <p className={`text-[11px] truncate ${isSelected ? 'text-indigo-100' : 'text-gray-500'}`}>
                          {conv.lastMessage}
                        </p>
                      </div>

                      {conv.unreadCount > 0 && !isSelected && (
                        <span className="absolute top-3 right-3 bg-indigo-600 text-white font-bold text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Pane - Chat Window */}
          <div className="flex-1 flex flex-col h-full bg-white relative">
            {selectedConv ? (
              <>
                {/* Chat header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10 shadow-sm shadow-gray-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{selectedConv.contactName || selectedConv.contactPhone}</h3>
                      <p className="text-[10px] text-gray-400 mt-0.5">+{selectedConv.contactPhone}</p>
                    </div>
                  </div>
                </div>

                {/* Messages stream */}
                <div className="flex-1 overflow-auto p-4 space-y-3 bg-gray-55/60 max-h-[calc(100%-140px)]">
                  {messages.map((msg) => {
                    const isMe = msg.direction === 'outgoing';
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-xs font-normal leading-relaxed relative ${
                          isMe 
                            ? 'bg-indigo-600 text-white rounded-br-none' 
                            : 'bg-gray-100 text-gray-800 rounded-bl-none'
                        }`}>
                          <p>{msg.content}</p>
                          <div className={`flex items-center justify-end gap-1 text-[9px] mt-1.5 ${isMe ? 'text-indigo-200' : 'text-gray-450'}`}>
                            {msg.timestamp && (
                              <span>
                                {new Date(msg.timestamp?.seconds * 1000 || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {isMe && (
                              msg.status === 'read' ? (
                                <CheckCheck className="w-3 h-3 text-emerald-400" />
                              ) : msg.status === 'received' ? (
                                <CheckCheck className="w-3 h-3" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick replies & Inputs */}
                <div className="border-t border-gray-100 p-4 bg-white space-y-3 mt-auto">
                  {/* Quick reply templates pill wrapper */}
                  <div className="flex gap-2 p-1 overflow-x-auto whitespace-nowrap scrollbar-hide">
                    {quickReplies.map((replyText, i) => (
                      <button
                        key={i}
                        onClick={() => handleQuickReply(replyText)}
                        className="px-3 py-1 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 rounded-full text-[10px] font-medium text-gray-500 border border-gray-100 transition-colors flex items-center gap-1"
                      >
                        <Reply className="w-2.5 h-2.5" /> {replyText}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={sendMessage} className="flex gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type a message or click a quick reply template..."
                      className="flex-1 bg-gray-50 border border-gray-100 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs outline-none transition-colors"
                      disabled={isSending}
                    />
                    <button
                      type="submit"
                      disabled={isSending || !replyText.trim()}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 rounded-xl text-white transition-colors flex items-center justify-center flex-shrink-0"
                    >
                      {isSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500" id="empty-state">
                <MessageSquare className="w-16 h-16 text-gray-200 mb-4 animate-bounce" />
                <h3 className="font-bold text-gray-800 text-sm">Real-time WhatsApp Console</h3>
                <p className="text-xs text-gray-400 mt-2 max-w-sm">
                  Select a live client chat header from the active chat panel on the left to start corresponding instantly.
                </p>
                {!connectionState.connected && (
                  <button
                    onClick={() => setActiveTab('connection')}
                    className="mt-4 px-4 py-2 rounded-xl border border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 text-xs font-bold transition-colors"
                  >
                    Link WhatsApp Instance First
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* INDICATION OF SUCCESS CELEBRATION MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-gray-950/60 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all duration-300" id="whatsapp-success-modal">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-gray-100 p-6 flex flex-col items-center text-center gap-5 relative transform transition-transform duration-300 ease-out scale-100 animate-scale-up">
            <button 
              onClick={() => setShowSuccessModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="sr-only">Close</span>
              <span className="text-xl font-bold leading-none">×</span>
            </button>
            
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center relative shadow-inner">
              <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
              <CheckCircle2 className="w-9 h-9 relative z-10" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-gray-900 flex items-center justify-center gap-1.5">
                <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500 animate-pulse" /> Linked Successfully!
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed max-w-xs animate-fade-in">
                Your WhatsApp device has been fully authenticated. The Real-time Chat Inbox and customer automated response helpers are now fully operational.
              </p>
            </div>

            {connectionState.phone && (
              <div className="w-full bg-gray-50 rounded-xl py-2.5 px-4 border border-gray-100 flex items-center gap-2.5 justify-center">
                <Smartphone className="w-4 h-4 text-gray-400 animate-bounce" />
                <span className="text-xs font-semibold text-gray-500">Number:</span>
                <span className="text-xs font-bold text-emerald-600">+{connectionState.phone}</span>
              </div>
            )}

            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setActiveTab('inbox');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-indigo-100"
              >
                <MessageSquare className="w-4 h-4" /> Go to Real-time Inbox
              </button>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-2 px-4 rounded-xl text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
              >
                Stay Here
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
