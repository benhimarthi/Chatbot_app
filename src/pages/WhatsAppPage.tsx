import * as React from 'react';
import { 
  Loader2, Send, CheckCircle2, AlertCircle, RefreshCw, Smartphone, 
  QrCode, MessageSquare, Wifi, WifiOff, Check, CheckCheck, User, Reply,
  HelpCircle, Sparkles, Terminal, ChevronDown, ChevronRight, Play, Copy,
  Settings, ShieldAlert, ArrowRight
} from 'lucide-react';
import { auth, db } from '../firebase';
import { linkWithPhoneNumber, RecaptchaVerifier, unlink } from 'firebase/auth';
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

  // Phone MFA Configuration State and Methods
  const [mfaEnabled, setMfaEnabled] = React.useState<boolean>(false);
  const [mfaPhone, setMfaPhone] = React.useState<string>('');
  const [sessionPhoneInput, setSessionPhoneInput] = React.useState<string>('');
  const [lastSentPhone, setLastSentPhone] = React.useState<string>('');
  const [hasSession, setHasSession] = React.useState<boolean>(false);
  const [isAwaitingScan, setIsAwaitingScan] = React.useState<boolean>(false);
  const [qrCountdown, setQrCountdown] = React.useState<number>(60);
  const generateQRRef = React.useRef<any>(null);

  React.useEffect(() => {
    generateQRRef.current = generateQR;
  });

  React.useEffect(() => {
    if (!qrCode || connectionState.connected) {
      setQrCountdown(60);
      return;
    }

    setQrCountdown(60);

    const interval = setInterval(() => {
      setQrCountdown(prev => {
        if (prev <= 1) {
          console.log("[QR Timer] 60 seconds reached. Automatically regenerating QR code.");
          if (generateQRRef.current) {
            generateQRRef.current();
          }
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [qrCode, connectionState.connected]);

  React.useEffect(() => {
    if (mfaPhone && !sessionPhoneInput) {
      setSessionPhoneInput(mfaPhone);
    }
  }, [mfaPhone]);

  const [mfaPhoneInput, setMfaPhoneInput] = React.useState<string>('');
  const [mfaCodeInput, setMfaCodeInput] = React.useState<string>('');
  const [mfaStep, setMfaStep] = React.useState<'idle' | 'verifying'>('idle');
  const [isSendingMfaCode, setIsSendingMfaCode] = React.useState<boolean>(false);
  const [isVerifyingMfaCode, setIsVerifyingMfaCode] = React.useState<boolean>(false);
  const [isDisablingMfa, setIsDisablingMfa] = React.useState<boolean>(false);
  const [mfaSuccessMessage, setMfaSuccessMessage] = React.useState<string>('');
  const [mfaErrorMessage, setMfaErrorMessage] = React.useState<string>('');

  const confirmationResultRef = React.useRef<any>(null);
  const recaptchaVerifierRef = React.useRef<any>(null);

  const sendMfaCode = async () => {
    if (!currentUser || !mfaPhoneInput.trim()) return;
    try {
      setIsSendingMfaCode(true);
      setMfaErrorMessage('');
      setMfaSuccessMessage('');

      let formattedPhone = mfaPhoneInput.trim();
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }

      // Cleanup any stale recaptcha instance
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (e) {
          console.warn("Recaptcha cleanup nested error:", e);
        }
      }

      const container = document.getElementById('recaptcha-container');
      if (!container) {
        throw new Error("Unable to locate #recaptcha-container DOM anchor in active page view.");
      }

      // Instantiate client-side RecaptchaVerifier
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          // Solved
        }
      });
      recaptchaVerifierRef.current = verifier;

      // Link phone number to current logged in user via Firebase Auth API
      const confirmationResult = await linkWithPhoneNumber(currentUser, formattedPhone, verifier);
      confirmationResultRef.current = confirmationResult;

      setMfaStep('verifying');
      setMfaSuccessMessage(`A native Firebase Auth secure verification OTP has been dispatched to ${formattedPhone}`);
    } catch (err: any) {
      console.error("Firebase Auth trigger phone error:", err);
      if (err.code === 'auth/provider-already-linked') {
        setMfaErrorMessage("Your Firebase Auth profile already has a verified phone number attached. If you wish to use a different one, please unlink first.");
      } else if (err.code === 'auth/invalid-phone-number') {
        setMfaErrorMessage("Invalid format. Please make sure to include the country code (e.g. +14155552671).");
      } else {
        setMfaErrorMessage(err.message || "Failed to dispatch SMS verification key via Firebase provider.");
      }
    } finally {
      setIsSendingMfaCode(false);
    }
  };

  const verifyMfaCode = async () => {
    if (!currentUser || !mfaCodeInput.trim() || !confirmationResultRef.current) return;
    try {
      setIsVerifyingMfaCode(true);
      setMfaErrorMessage('');
      setMfaSuccessMessage('');

      // Confirm the OTP code in Firebase, linking the phone credential permanently to their active user profile
      await confirmationResultRef.current.confirm(mfaCodeInput.trim());

      // Force refresh user Auth token to include the newly linked phone number claim
      const idToken = await currentUser.getIdToken(true);

      // Tell backend to update DB document status
      const res = await axios.post('/api/whatsapp/mfa/verify-auth', {}, {
        headers: { Authorization: `Bearer ${idToken}` }
      });

      if (res.data?.success) {
        setMfaEnabled(true);
        setMfaPhone(res.data.mfaPhone);
        setMfaStep('idle');
        setMfaPhoneInput('');
        setMfaCodeInput('');
        setMfaSuccessMessage('Multi-Factor Authentication successfully enrolled and verified using standard Firebase Auth!');
        
        checkStatus(currentUser);
      }
    } catch (err: any) {
      console.error("Firebase verified OTP error:", err);
      setMfaErrorMessage(err.response?.data?.error || err.message || "Failed to verify current OTP code. Please enter the correct key.");
    } finally {
      setIsVerifyingMfaCode(false);
    }
  };

  const disableMfa = async () => {
    if (!currentUser) return;
    if (!window.confirm("Are you sure you want to disable Phone MFA? This will unlink the phone credential from your login profile and deactivate WhatsApp QR linking.")) return;
    try {
      setIsDisablingMfa(true);
      setMfaErrorMessage('');
      setMfaSuccessMessage('');

      // Unlink phone provider from direct Auth profile
      try {
        await unlink(currentUser, 'phone');
      } catch (unlinkErr) {
        console.warn("Unlinking phone failed (it might not be linked):", unlinkErr);
      }

      const idToken = await currentUser.getIdToken(true);
      const res = await axios.post('/api/whatsapp/mfa/disable', {}, {
        headers: { Authorization: `Bearer ${idToken}` }
      });

      if (res.data?.success) {
        setMfaEnabled(false);
        setMfaPhone('');
        setMfaSuccessMessage('Phone Multi-Factor Authentication successfully disabled and unlinked.');
        checkStatus(currentUser);
      }
    } catch (err: any) {
      setMfaErrorMessage(err.response?.data?.error || err.message || "Failed to disable MFA.");
    } finally {
      setIsDisablingMfa(false);
    }
  };

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
    if (!currentUser || isAwaitingScan) return;
    
    // Check status immediately
    checkStatus(currentUser);

    // Setup interval to poll status every 6 seconds to detect successful scan
    const interval = setInterval(() => {
      checkStatus(currentUser);
    }, 6000);

    return () => clearInterval(interval);
  }, [currentUser, isAwaitingScan]);

  // Sub-second Real-time listener for workspace connection state changes (instant scan detection)
  React.useEffect(() => {
    if (!currentUser) return;

    const instanceName = `instance_${currentUser.uid}`;
    const docRef = doc(db, 'workspaces', currentUser.uid, 'whatsapp', instanceName);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const isNowConnected = !!data.connected;
        
        if (data.mfaEnabled !== undefined) {
          setMfaEnabled(!!data.mfaEnabled);
        }
        if (data.mfaPhone !== undefined) {
          setMfaPhone(data.mfaPhone || '');
        }

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
          setIsAwaitingScan(false);
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

    // Use direct query filtering to completely bypass composite index requirements
    const q = query(
      collection(db, 'conversations'),
      where('workspaceId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Conversation }));
      // Sort client-side
      list.sort((a, b) => {
        const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return dateB - dateA; // Descending
      });
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

    // Use direct query filtering to completely bypass composite index requirements
    const q = query(
      collection(db, 'messages'),
      where('conversationId', '==', selectedConv.id),
      where('workspaceId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Message }));
      // Sort client-side
      list.sort((a, b) => {
        const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return dateA - dateB; // Ascending
      });
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
      
      const sessionExists = response.data?.whatsappSessionId || response.data?.sessionExists;
      if (sessionExists) {
        setHasSession(true);
      }

      if (response.data?.success) {
        const isNowConnected = response.data.connected;
        const registeredPhone = response.data.phone || '';
        
        if (sessionExists && !isNowConnected) {
          console.warn("[WhatsApp Status] Session exists but disconnected. Requesting QR code...");
          setIsAwaitingScan(true);
          generateQR(registeredPhone);
          return;
        }

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

        if (response.data?.customWebhookUrl) {
          setCustomWebhookUrl(response.data.customWebhookUrl);
        }

        if (response.data?.mfaEnabled !== undefined) {
          setMfaEnabled(!!response.data.mfaEnabled);
        }

        if (response.data?.mfaPhone !== undefined) {
          setMfaPhone(response.data.mfaPhone || '');
        }

        if (isNowConnected) {
          setQrCode(''); // Clear QR if connected successfully
          setIsAwaitingScan(false);
          setErrorMessage('');
        }
        
        isFirstCheckRef.current = false;
      } else {
        if (sessionExists) {
          const registeredPhone = response.data?.phone || '';
          console.warn("[WhatsApp Status Error Response] Checking status failed and session exists. Requesting QR code...");
          setIsAwaitingScan(true);
          generateQR(registeredPhone);
        }
      }
    } catch (err: any) {
      console.error("Error checking whatsapp status:", err);
      const sessionExists = hasSession || err?.response?.data?.sessionExists;
      const registeredPhone = err?.response?.data?.phone || mfaPhone || connectionState.phone || '';
      if (sessionExists) {
        console.warn("[WhatsApp Status Catch] Checking status threw error and session exists. Requesting QR code...");
        setIsAwaitingScan(true);
        generateQR(registeredPhone);
      }
    } finally {
      setIsCheckingState(false);
    }
  };

  const [errorLogDetails, setErrorLogDetails] = React.useState<string>('');

  const generateQR = async (specificPhone?: string) => {
    if (!currentUser) return;

    const targetPhone = (specificPhone || sessionPhoneInput || mfaPhone || connectionState.phone || '').trim();
    if (!targetPhone) {
      setErrorMessage("Please specify a valid phone number (including country code) in the dedicated connection field to link WhatsApp.");
      setErrorLogDetails("A phone number is required in order to register and provision your WhatsApp connection instance on the server.");
      return;
    }

    // Format target phone number
    const digits = targetPhone.replace(/\D/g, '');
    const formattedPhone = digits ? `+${digits}` : '';
    setLastSentPhone(formattedPhone);

    try {
      setIsGeneratingQR(true);
      setErrorMessage('');
      setErrorLogDetails('');
      setQrCode('');
      
      // Force first check check to false so pairing successfully triggers the success celebration modal
      isFirstCheckRef.current = false;

      const token = await currentUser.getIdToken();
      const response = await axios.post('/api/whatsapp/connect', { 
        phone: targetPhone 
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data?.success) {
        if (response.data.qrCode) {
          setQrCode(response.data.qrCode);
        } else if (response.data.connected) {
          setConnectionState(prev => ({ 
            ...prev, 
            connected: true, 
            instanceName: response.data.instanceName,
            phone: response.data.phone || prev.phone
          }));
          setQrCode('');
          setErrorMessage('Notice: This instance is already fully connected to a phone session.');
        } else {
          setErrorMessage('Failed to generate connection payload. Please try again.');
          setErrorLogDetails(`Server response headers / body indicating empty QR code: ${JSON.stringify(response.data)}`);
        }
        setConnectionState(prev => ({ ...prev, instanceName: response.data.instanceName }));
      }
    } catch (err: any) {
      console.error("Failed to generate QR Code:", err);
      const serverErrMsg = err?.response?.data?.error || err.message || 'Instance connection failed.';
      const serverErrDetails = err?.response?.data?.details || err?.response?.data?.trace || JSON.stringify(err?.response?.data || err.stack || err);
      setErrorMessage(serverErrMsg);
      setErrorLogDetails(serverErrDetails);
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const [isSimulating, setIsSimulating] = React.useState<boolean>(false);
  const [simulationSuccess, setSimulationSuccess] = React.useState<boolean>(false);
  const [isCopied, setIsCopied] = React.useState<boolean>(false);
  const [isFirebaseCopied, setIsFirebaseCopied] = React.useState<boolean>(false);

  // Custom Webhook Management State
  const [customWebhookUrl, setCustomWebhookUrl] = React.useState<string>('https://us-central1-glass-arcanum-480721-n7.cloudfunctions.net/wasenderWebhook');
  const [isUpdatingWebhook, setIsUpdatingWebhook] = React.useState<boolean>(false);
  const [webhookUpdateSuccess, setWebhookUpdateSuccess] = React.useState<boolean>(false);

  const updateWebhookOnServer = async (urlToSet: string) => {
    if (!currentUser || !urlToSet.trim()) return;
    try {
      setIsUpdatingWebhook(true);
      setWebhookUpdateSuccess(false);
      const token = await currentUser.getIdToken();
      await axios.post('/api/whatsapp/update-webhook', {
        webhookUrl: urlToSet.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWebhookUpdateSuccess(true);
      setTimeout(() => setWebhookUpdateSuccess(false), 3000);
    } catch (err: any) {
      console.error("Failed to update custom webhook url:", err);
      setErrorMessage(err?.response?.data?.error || "Failed to update custom webhook on WaSender API.");
    } finally {
      setIsUpdatingWebhook(false);
    }
  };

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
            Connect your Business WhatsApp via WaSender API to receive and send real-time customer conversations.
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

            <div className="flex flex-col gap-3">
              {/* Dedicated Phone Number Field for connecting session */}
              <div className="flex flex-col gap-1.5 max-w-sm">
                <label htmlFor="whatsapp-session-phone-input" className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-indigo-500 animate-pulse" /> Connecting Phone Number:
                </label>
                <input
                  type="tel"
                  id="whatsapp-session-phone-input"
                  placeholder="Enter number with country code (e.g. +14155552671)"
                  value={sessionPhoneInput}
                  onChange={(e) => setSessionPhoneInput(e.target.value)}
                  disabled={isGeneratingQR || connectionState.connected}
                  className="w-full px-3 py-2 border border-blue-200 focus:border-indigo-500 bg-white rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-gray-400 font-mono text-gray-900"
                />
                <p className="text-[10px] text-gray-500 leading-normal">
                  Specify the phone number corresponding to the WhatsApp account you are connecting.
                </p>
                {sessionPhoneInput && (
                  <div className="mt-1.5 text-[11px] font-mono font-medium text-indigo-600 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100/50 flex items-center gap-1.5 animate-fade-in">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    Pending WaSender API Target format: <strong className="text-gray-950">+{sessionPhoneInput.replace(/\D/g, '')}</strong>
                  </div>
                )}
                {lastSentPhone && (
                  <div className="mt-1.5 text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50/80 p-2 rounded-lg border border-emerald-100 flex items-center gap-1.5 animate-fade-in">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Last phone sent to WaSender API: <span className="underline select-all text-emerald-900">{lastSentPhone}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-1">
                <button
                  type="button"
                  id="whatsapp-generate-qr-btn"
                  onClick={() => generateQR()}
                  disabled={isGeneratingQR || connectionState.connected}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 font-medium text-sm text-white hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors flex items-center gap-2"
                >
                  {isGeneratingQR && <Loader2 className="w-4 h-4 animate-spin" />}
                  {connectionState.connected ? 'WhatsApp Linked' : 'Generate Connection QR Code'}
                </button>

                <button
                  type="button"
                  onClick={() => checkStatus()}
                  disabled={isCheckingState}
                  className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  title="Sync and Refresh connection"
                >
                  <RefreshCw className={`w-4 h-4 ${isCheckingState ? 'animate-spin text-indigo-600' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center justify-center text-center">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-2">
                <QrCode className="w-4 h-4 text-indigo-600" /> Link QR QR-Scan Stage
              </h3>

              {isAwaitingScan && !connectionState.connected && (
                <div className="w-full max-w-xs mb-3 text-[11px] leading-normal font-sans text-amber-800 bg-amber-50 rounded-xl p-3 border border-amber-200/50 flex flex-col gap-1 text-left animate-pulse">
                  <div className="font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    Disconnected Session Detected
                  </div>
                  <span>Status checking was paused to avoid conflicts. Please scan this auto-requested QR code to link your account.</span>
                </div>
              )}
            
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
                    <div className="flex flex-col items-center gap-2 p-2">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`} 
                        alt="WhatsApp QR Code" 
                        className="w-48 h-48 object-contain" 
                        referrerPolicy="no-referrer" 
                      />
                      <div className="text-[10px] text-gray-500 text-center font-medium mt-1">
                        Scan to link WhatsApp
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center p-4">
                  <Smartphone className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <span className="text-xs text-gray-400">Click Generate button to assemble new token code</span>
                </div>
              )}
            </div>

            {qrCode && !connectionState.connected && !isGeneratingQR && (
              <div className="w-64 flex flex-col gap-1.5 mb-4 animate-fade-in">
                <div className="flex justify-between items-center text-[11px] text-gray-500 font-medium">
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" /> Auto-refreshing QR
                  </span>
                  <span className="font-mono text-indigo-600 font-bold">Expires in {qrCountdown}s</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${(qrCountdown / 60) * 100}%` }}
                  />
                </div>
                <p className="text-[9px] text-gray-400 text-center leading-normal">
                  The session QR code expires every 60 seconds automatically. It will regenerate dynamically without any manual action needed.
                </p>
              </div>
            )}

            {errorMessage && (
              <div className="text-xs text-red-750 mt-3 p-3 bg-red-50 border border-red-100 rounded-xl flex flex-col gap-2 max-w-full text-left">
                <div className="flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="font-semibold break-words leading-tight">{errorMessage}</span>
                </div>
                {errorLogDetails && (
                  <div className="mt-1">
                    <span className="text-[9px] text-red-450 font-bold uppercase tracking-wider block mb-1 font-mono">Detailed Backend Log Details:</span>
                    <pre className="text-[10px] font-mono p-2 bg-slate-900 text-slate-200 rounded-lg select-all overflow-auto max-h-40 break-all whitespace-pre-wrap">
                      {errorLogDetails}
                    </pre>
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-gray-400 mt-2">
              System uses real-time event socket sync. Scan takes effect immediately.
            </p>
          </div>
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

            <div className="flex flex-col gap-2 w-full font-sans">
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
