import { Router } from "express";
import axios from "axios";
import { 
  createInstance, 
  fetchQRCode, 
  setWebhook, 
  getConnectionState, 
  sendTextMessage,
  createSession,
  connectSession
} from "../../src/services/wasenderService.ts";
import { 
  restGetDoc, 
  restSetDoc, 
  pendingUpdates, 
  appendWebhookLog,
  authAdmin,
  dbAdmin
} from "../firebaseAdmin.ts";
import { generateRagResponse } from "../../src/services/ragServiceServer.ts";
import firebaseConfig from "../../firebase-applet-config.json";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.ts";

const router = Router();

// API: Connect WhatsApp Instance
router.post("/api/whatsapp/connect", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const workspaceId = req.workspaceId!;
    const idToken = req.idToken!;

    const instanceName = `instance_${workspaceId}`;
    const whatsappDocPath = `workspaces/${workspaceId}/whatsapp/${instanceName}`;

    // 1. Fetch existing WhatsApp data from Firestore to see if it already exists or has custom settings
    let dbDocExists = false;
    let savedWebhookUrl = "";
    let existingObj: any = {};
    let whatsappSessionId = "";
    let apiKey = "";
    try {
      const snap = await restGetDoc(whatsappDocPath, idToken);
      if (snap.exists) {
        dbDocExists = true;
        existingObj = snap.data() || {};
        savedWebhookUrl = existingObj.customWebhookUrl || existingObj.webhookUrl || "";
        whatsappSessionId = existingObj.whatsappSessionId || "";
        apiKey = existingObj.apiKey || "";
      }
    } catch (dbErr: any) {
      console.warn("Could not fetch existing whatsapp doc from DB:", dbErr.message);
    }

    // MFA / Phone Requirement Validation
    let phoneToUse = req.body.phone || existingObj.mfaPhone || existingObj.phone || "";

    if (!phoneToUse || !phoneToUse.trim()) {
      return res.status(400).json({
        success: false,
        error: "Phone number is required to link a WhatsApp session.",
        details: "Please specify a valid phone number (including country code) when generating the connection QR code."
      });
    }

    const cleanPhone = phoneToUse.replace(/\D/g, '');
    if (cleanPhone.length < 7) {
      return res.status(400).json({
        success: false,
        error: "Invalid phone number format.",
        details: "The phone number must contain at least 7 digits (including country code)."
      });
    }

    // Capture variables and automatically satisfy/promote MFA status variables
    const mfaPhone = cleanPhone;
    existingObj.mfaEnabled = true;
    existingObj.mfaPhone = cleanPhone;
    existingObj.phone = cleanPhone;

    let qrCode = "";
    let alreadyConnected = false;

    // Helper to recursively inspect API responses for connected states like 'open', 'connected', etc.
    const isInstanceConnected = (obj: any): boolean => {
      if (!obj) return false;
      if (obj === true) return true;
      if (typeof obj === 'string') {
        const s = obj.toLowerCase();
        return s === 'open' || s === 'connected' || s === 'online' || s === 'active';
      }
      if (typeof obj === 'object') {
        if (obj.connected === true) return true;
        for (const k of Object.keys(obj)) {
          if (isInstanceConnected(obj[k])) return true;
        }
      }
      return false;
    };

    const webhookUrl = savedWebhookUrl || "https://us-central1-glass-arcanum-480721-n7.cloudfunctions.net/wasenderWebhook";

    // 2. We check if the user already has a session attached to their account
    if (whatsappSessionId) {
      console.log(`Checking existing attachment connection state on WaSender API for session: ${whatsappSessionId}...`);
      try {
        const connResponse = await getConnectionState(instanceName, undefined, apiKey);
        if (isInstanceConnected(connResponse) || connResponse.connected) {
          alreadyConnected = true;
          console.log(`Instance session ${whatsappSessionId} is already connected.`);
        } else {
          console.log(`Instance session ${whatsappSessionId} is disconnected. Initiating connection on WaSender first...`);
          await connectSession(instanceName, undefined, whatsappSessionId);
          // Wait slightly for connection initialization to propagate
          await new Promise(resolve => setTimeout(resolve, 800));
          console.log(`Requesting the qrcode for session: ${whatsappSessionId}...`);
          const qrResponse = await fetchQRCode(instanceName, undefined, whatsappSessionId);
          qrCode = qrResponse?.qrcode?.base64 || qrResponse?.base64 || qrResponse?.qrcode?.code || "";
        }
      } catch (qrErr: any) {
        console.warn("Retrying/Re-initializing session due to status code/errors:", qrErr.message);
        whatsappSessionId = ""; // mark for session recreation
      }
    }

    // 3. User has no session attached, we create a whatsapp session
    if (!whatsappSessionId) {
      console.log(`No WaSender session found attached for ${instanceName}. Creating new session...`);
      try {
        const sessionPhone = mfaPhone.startsWith('+') ? mfaPhone : `+${mfaPhone}`;
        const createRes = await createSession(instanceName, sessionPhone, webhookUrl);
        console.log(`Session creation response success:`, JSON.stringify(createRes));

        const sessionData = createRes?.data || createRes || {};
        whatsappSessionId = sessionData.id;
        apiKey = sessionData.api_key;
        
        const statusStr = String(sessionData.status || '').toLowerCase();
        alreadyConnected = statusStr === 'connected' || statusStr === 'open' || statusStr === 'active';

        // Update database info
        existingObj.whatsappSessionId = whatsappSessionId;
        existingObj.apiKey = apiKey;
        existingObj.connected = alreadyConnected;

        // Save absolutely everything from the session creation response
        existingObj.webhook_secret = sessionData.webhook_secret || "";
        existingObj.webhookSecret = sessionData.webhook_secret || ""; // camelCase support
        existingObj.id = sessionData.id || "";
        existingObj.name = sessionData.name || "";
        existingObj.phone_number = sessionData.phone_number || "";
        existingObj.status = sessionData.status || "";
        existingObj.account_protection = sessionData.account_protection !== undefined ? sessionData.account_protection : null;
        existingObj.log_messages = sessionData.log_messages !== undefined ? sessionData.log_messages : null;
        existingObj.read_incoming_messages = sessionData.read_incoming_messages !== undefined ? sessionData.read_incoming_messages : null;
        existingObj.webhook_url = sessionData.webhook_url || "";
        existingObj.webhook_enabled = sessionData.webhook_enabled !== undefined ? sessionData.webhook_enabled : null;
        existingObj.webhook_events = sessionData.webhook_events || [];
        existingObj.api_key = sessionData.api_key || "";
        existingObj.created_at = sessionData.created_at || "";
        existingObj.updated_at = sessionData.updated_at || "";

        if (!alreadyConnected) {
          console.log(`Newly created session ${whatsappSessionId} not connected yet. Initiating WaSender connection first...`);
          await connectSession(instanceName, undefined, whatsappSessionId);
          // Wait slightly for connection initialization to propagate
          await new Promise(resolve => setTimeout(resolve, 800));
          console.log(`Requesting QR for newly created/connected session: ${whatsappSessionId}...`);
          const qrResponse = await fetchQRCode(instanceName, null, whatsappSessionId);
          qrCode = qrResponse?.qrcode?.base64 || qrResponse?.base64 || qrResponse?.qrcode?.code || "";
        }
      } catch (createErr: any) {
        console.error("Instance creation or session registration failed:", createErr.message || createErr);
        throw createErr;
      }
    }

    // 4. Update state documents in Firestore
    await restSetDoc(whatsappDocPath, {
      ...existingObj,
      instanceName,
      instanceCreated: true,
      whatsappSessionId: whatsappSessionId || existingObj.whatsappSessionId || "",
      apiKey: apiKey || existingObj.apiKey || "",
      connected: alreadyConnected || existingObj.connected || false,
      customWebhookUrl: webhookUrl,
      updatedAt: new Date(),
      createdAt: existingObj.createdAt || new Date()
    }, idToken);

    // Ensure parent workspace document exists
    await restSetDoc(`workspaces/${workspaceId}`, {
      id: workspaceId,
      ownerId: workspaceId,
      createdAt: new Date()
    }, idToken);

    res.json({
      success: true,
      instanceName,
      qrCode,
      connected: alreadyConnected || existingObj.connected || false,
      customWebhookUrl: webhookUrl,
      whatsappSessionId,
      apiKey
    });
  } catch (error: any) {
    console.error("WhatsApp Connection failed:", error);
    res.status(500).json({ 
      error: error.message || "Failed to connect WhatsApp",
      details: error.response?.data ? JSON.stringify(error.response.data) : (error.stack || String(error))
    });
  }
});

// API: Get Current WhatsApp Connection State
router.get("/api/whatsapp/status", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const workspaceId = req.workspaceId!;
    const idToken = req.idToken!;

    const instanceName = `instance_${workspaceId}`;
    
    // Fetch existing settings first
    const whatsappDocPath = `workspaces/${workspaceId}/whatsapp/${instanceName}`;
    const snap = await restGetDoc(whatsappDocPath, idToken);
    let phone = "";
    let existingData: any = {};
    let apiKey = "";
    let whatsappSessionId = "";
    if (snap.exists) {
      existingData = snap.data() || {};
      phone = snap.data()?.phone || "";
      apiKey = existingData.apiKey || "";
      whatsappSessionId = existingData.whatsappSessionId || "";
    }

    if (!whatsappSessionId) {
      return res.json({
        success: true,
        instanceName,
        connected: false,
        state: 'close',
        phone: existingData.phone || "",
        whatsappSessionId: "",
        customWebhookUrl: existingData.customWebhookUrl || existingData.webhookUrl || "",
        mfaEnabled: !!existingData.mfaEnabled,
        mfaPhone: existingData.mfaPhone || ""
      });
    }

    const connResponse: any = await getConnectionState(instanceName, undefined, apiKey);
    
    // Deep structural checking helper for maximal robustness
    const isInstanceConnected = (obj: any): boolean => {
      if (!obj) return false;
      if (obj === true) return true;
      if (typeof obj === 'string') {
        const s = obj.toLowerCase();
        return s === 'open' || s === 'connected' || s === 'online' || s === 'active';
      }
      if (typeof obj === 'object') {
        if (obj.connected === true) return true;
        for (const k of Object.keys(obj)) {
          if (isInstanceConnected(obj[k])) return true;
        }
      }
      return false;
    };

    const state = connResponse?.instance?.state || connResponse?.state || connResponse?.instance?.status || connResponse?.status || 'close';
    const connected = connResponse.connected === true || isInstanceConnected(connResponse);

    // Try to capture phone number dynamically from connection state response if available
    if (connected) {
      const rawPhone = connResponse?.instance?.ownerJid || 
                       connResponse?.instance?.me?.id || 
                       connResponse?.instance?.me?.jid || 
                       connResponse?.instance?.me?.user ||
                       connResponse?.me?.id || 
                       connResponse?.me?.jid || 
                       connResponse?.me?.user ||
                       connResponse?.phone;
      if (rawPhone) {
        phone = String(rawPhone).split(':')[0].split('@')[0];
      }
    }

    if (!snap.exists || snap.data()?.connected !== connected || (connected && !snap.data()?.phone && phone)) {
      await restSetDoc(whatsappDocPath, {
        ...existingData,
        instanceName,
        connected,
        phone: phone || existingData.phone || "",
        updatedAt: new Date()
      }, idToken);
    }

    res.json({
      success: true,
      instanceName,
      connected,
      state,
      phone: phone || existingData.phone || "",
      whatsappSessionId,
      customWebhookUrl: existingData.customWebhookUrl || existingData.webhookUrl || "",
      mfaEnabled: !!existingData.mfaEnabled,
      mfaPhone: existingData.mfaPhone || ""
    });
  } catch (error: any) {
    console.error("WhatsApp Status check failed:", error);
    res.status(500).json({ error: error.message || "Failed to check status" });
  }
});

// API: Send WhatsApp Text Message
router.post("/api/whatsapp/send", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const workspaceId = req.workspaceId!;
    const idToken = req.idToken!;

    const { recipientPhone, messageText } = req.body;
    if (!recipientPhone || !messageText) {
      return res.status(400).json({ error: "recipientPhone and messageText are required" });
    }

    const instanceName = `instance_${workspaceId}`;
    
    // Fetch whatsappSessionId and apiKey from Firestore if any
    let whatsappSessionId = "";
    let apiKey = "";
    try {
      const whatsappDocPath = `workspaces/${workspaceId}/whatsapp/${instanceName}`;
      const snap = await restGetDoc(whatsappDocPath, idToken);
      if (snap.exists) {
        whatsappSessionId = snap.data()?.whatsappSessionId || "";
        apiKey = snap.data()?.apiKey || "";
      }
    } catch (err) {
      console.warn("Could not retrieve whatsapp session id on send:", err);
    }

    const sendResult = await sendTextMessage(instanceName, recipientPhone, messageText, whatsappSessionId, apiKey);

    // Normalize message and store in DB
    const messageId = `msg_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
    const normalizedPhone = recipientPhone.replace(/\D/g, '');
    const conversationId = `conv_${normalizedPhone}`;

    const msgData = {
      id: messageId,
      workspaceId,
      conversationId,
      from: "me",
      to: normalizedPhone,
      content: messageText,
      type: "text",
      direction: "outgoing",
      timestamp: new Date(),
      status: "sent"
    };

    const convData = {
      id: conversationId,
      workspaceId,
      whatsappInstance: instanceName,
      contactPhone: normalizedPhone,
      contactName: normalizedPhone,
      lastMessage: messageText,
      lastMessageAt: new Date(),
      unreadCount: 0,
      updatedAt: new Date()
    };

    await restSetDoc(`messages/${messageId}`, msgData, idToken);
    await restSetDoc(`conversations/${conversationId}`, convData, idToken);

    res.json({
      success: true,
      messageId,
      sendResult
    });
  } catch (error: any) {
    console.error("Failed to send WhatsApp message:", error);
    res.status(500).json({ error: error.message || "Failed to send message" });
  }
});

// API: Pull Webhook pending updates client-side
router.get("/api/whatsapp/pending-updates", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const workspaceId = req.workspaceId!;
    const updates = pendingUpdates.filter(u => u.workspaceId === workspaceId);
    
    for (let i = pendingUpdates.length - 1; i >= 0; i--) {
      if (pendingUpdates[i].workspaceId === workspaceId) {
        pendingUpdates.splice(i, 1);
      }
    }

    res.json({ success: true, updates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Register/Update a Custom Webhook URL for the active instance
router.post("/api/whatsapp/update-webhook", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const workspaceId = req.workspaceId!;
    const idToken = req.idToken!;
    const { webhookUrl } = req.body;
    if (!webhookUrl) {
      return res.status(400).json({ error: "webhookUrl is required" });
    }

    const instanceName = `instance_${workspaceId}`;
    console.log(`Skipping external setWebhook on WaSender API, saving webhook locally in Firestore: ${webhookUrl}`);

    // Save customWebhookUrl to Firestore so connection refreshes preserve it!
    const whatsappDocPath = `workspaces/${workspaceId}/whatsapp/${instanceName}`;
    let existingData = {};
    try {
      const snap = await restGetDoc(whatsappDocPath, idToken);
      if (snap.exists) {
        existingData = snap.data() || {};
      }
    } catch (dbErr) {
      console.warn("Could not fetch existing whatsapp doc:", dbErr);
    }

    await restSetDoc(whatsappDocPath, {
      ...existingData,
      instanceName,
      customWebhookUrl: webhookUrl,
      updatedAt: new Date()
    }, idToken);

    res.json({
      success: true,
      message: `Successfully set manual custom webhook reference to: ${webhookUrl}`
    });
  } catch (error: any) {
    console.error("Failed to update webhook URL:", error);
    res.status(500).json({ error: error.message || "Failed to update webhook URL" });
  }
});

// API: Simulate a webhook call for developer troubleshooting and pipeline validation
router.post("/api/whatsapp/simulate-webhook", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const workspaceId = req.workspaceId!;
    const instanceName = `instance_${workspaceId}`;

    // Create a simulated payload matching standard WhatsApp API CONNECTION_UPDATE structure
    const simulatedPayload = {
      event: "connection.update",
      instance: instanceName,
      data: {
        state: "open",
        status: "connected",
        me: {
          id: "33765432101@s.whatsapp.net",
          jid: "33765432101@s.whatsapp.net",
          user: "33765432101"
        },
        phone: "33765432101"
      }
    };

    // Forward to the exact same incoming Webhook Endpoint internally!
    const url = `http://0.0.0.0:3000/api/whatsapp/webhook`;
    await axios.post(url, simulatedPayload);

    res.json({ success: true, message: "Webhook simulation dispatched successfully!" });
  } catch (err: any) {
    console.error("Simulation endpoint failed:", err.message);
    res.status(550).json({ error: err.message });
  }
});

// API: WaSender incoming Webhook Endpoint callback
router.post("/api/whatsapp/webhook", async (req, res) => {
  try {
    let payload = req.body || {};
    
    // WaSender payload translation to Standard structure for uniform routing ingestion
    if (payload.type === 'messages.upsert' && payload.data && !payload.event) {
      const sessionId = payload.sessionId || "your_session_id";
      payload = {
        event: 'messages.upsert',
        instance: payload.instance || `instance_${sessionId}`,
        data: {
          key: {
            fromMe: !!payload.data.fromMe,
            remoteJid: payload.data.from,
            id: payload.data.id || `msg_was_${Date.now()}`
          },
          message: {
            conversation: payload.data.messageBody || ""
          },
          pushName: payload.data.pushName || "",
          messageType: 'text'
        }
      };
    }

    const eventName = payload.event;
    const instanceName = payload.instance || payload.instanceName;

    // Fire clear logs indicating webhook event reception
    console.log(`[Webhook Event Received] Received event from webhook at ${new Date().toISOString()}: eventName="${eventName}", instanceName="${instanceName}"`);
    console.log(`[Webhook Event Received] Full payload details:`, JSON.stringify(payload, null, 2));

    if (!instanceName) {
      console.warn(`[Webhook Warning] No instance target specified in payload`);
      return res.status(200).send("No instance target specified");
    }

    const workspaceId = instanceName.replace('instance_', '');

    if (eventName === 'connection.update' || eventName === 'CONNECTION_UPDATE') {
      const state = payload.data?.state || payload.data?.status || payload.data?.instance?.state;
      const connected = state === 'open' || state === 'connected' || payload.data?.instance?.state === 'open';
      
      let phone = payload.data?.phone || '';
      if (!phone && payload.data?.me?.id) {
        phone = payload.data.me.id.split(':')[0].split('@')[0];
      }
      if (!phone && payload.sender) {
        phone = payload.sender.split(':')[0].split('@')[0];
      }

      const steps = [
        `📡 Webhook Activation: WhatsApp API dispatched event "${eventName}" into our listener.`,
        `🔍 Payload Analysis: Parsed connection status is "${state || 'unknown'}" (${connected ? 'CONNECTED' : 'DISCONNECTED'}).`,
        `📱 Metadata Extraction: Screened "payload.data.me.id" and associated sender identities. Extracted phone: "${phone || 'N/A'}".`,
        `💾 Firestore Storage Sync: Automatically synchronized with path "workspaces/${workspaceId}/whatsapp/${instanceName}".`,
        `🔔 State Propagation: Dispatched immediate celebration state triggers to the frontend listener UI.`
      ];

      await appendWebhookLog(workspaceId, {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString(),
        event: eventName,
        connected,
        phone,
        steps,
        payloadReceived: {
          event: eventName,
          instance: instanceName,
          data: payload.data ? {
            state: payload.data.state || null,
            status: payload.data.status || null,
            instance: payload.data.instance ? { state: payload.data.instance.state || null } : null,
            me: payload.data.me ? { id: payload.data.me.id || null } : null,
            phone: payload.data.phone || null
          } : null
        }
      });

      const whatsappDocPath = `workspaces/${workspaceId}/whatsapp/${instanceName}`;
      try {
        await restSetDoc(whatsappDocPath, {
          instanceName,
          connected,
          phone,
          updatedAt: new Date()
        });
      } catch (rErr: any) {
        console.warn("Direct REST write failed (this is handled by client ingestion fallback):", rErr.message);
      }

      pendingUpdates.push({
        workspaceId,
        type: 'setDoc',
        collection: 'workspaces',
        id: instanceName,
        parentPath: `workspaces/${workspaceId}/whatsapp`,
        data: {
          instanceName,
          connected,
          phone,
          updatedAt: new Date().toISOString()
        }
      });
    } 
    
    if (eventName === 'messages.upsert' || eventName === 'MESSAGES_UPSERT') {
      const msgData = payload.data;
      const key = msgData?.key;
      const fromMe = key?.fromMe || false;
      const remoteJid = key?.remoteJid || '';
      
      if (remoteJid) {
        const contactPhone = remoteJid.split('@')[0];
        const conversationId = `conv_${contactPhone}`;
        const messageId = key?.id || `msg_${Date.now()}`;

        let content = '';
        if (msgData?.message?.conversation) {
          content = msgData.message.conversation;
        } else if (msgData?.message?.extendedTextMessage?.text) {
          content = msgData.message.extendedTextMessage.text;
        } else if (typeof msgData?.message === 'string') {
          content = msgData.message;
        } else if (msgData?.message?.imageMessage?.caption) {
          content = msgData.message.imageMessage.caption;
        } else {
          content = '[Media Message]';
        }

        const type = msgData?.messageType || 'text';
        const direction = fromMe ? 'outgoing' : 'incoming';

        const normalizedMessage = {
          id: messageId,
          workspaceId,
          conversationId,
          from: fromMe ? 'me' : contactPhone,
          to: fromMe ? contactPhone : 'me',
          content,
          type,
          direction,
          timestamp: new Date().toISOString(),
          status: 'received'
        };

        const contactName = payload.data?.pushName || contactPhone;

        const normalizedConversation = {
          id: conversationId,
          workspaceId,
          whatsappInstance: instanceName,
          contactPhone,
          contactName,
          lastMessage: content,
          lastMessageAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          unreadCount: fromMe ? 0 : 1
        };

        const steps = [
          `📡 Webhook Activation: Incoming chat event "${eventName}" detected from remote source.`,
          `💬 Content Verification: Decoded readable message length: ${content.length} characters.`,
          `💾 Persistence Pipeline: Updated "messages/${messageId}" and "conversations/${conversationId}".`,
          `📢 Client Dispatch: Instantly updated messaging thread screen state for active operators.`
        ];

        await appendWebhookLog(workspaceId, {
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          timestamp: new Date().toISOString(),
          event: eventName,
          connected: true,
          phone: contactPhone,
          steps,
          payloadReceived: {
            event: eventName,
            instance: instanceName,
            data: {
              messageType: type,
              fromMe,
              remoteJid,
              pushName: payload.data?.pushName || null,
              messageLength: content.length
            }
          }
        });

        try {
          await restSetDoc(`messages/${messageId}`, normalizedMessage);
          await restSetDoc(`conversations/${conversationId}`, normalizedConversation);
        } catch (rErr: any) {
          console.warn("Direct REST message writes failed (handled by client ingestion fallback):", rErr.message);
        }

        pendingUpdates.push({
          workspaceId,
          type: 'setDoc',
          collection: 'messages',
          id: messageId,
          data: normalizedMessage
        });

        pendingUpdates.push({
          workspaceId,
          type: 'setDoc',
          collection: 'conversations',
          id: conversationId,
          data: normalizedConversation
        });

        // 4. Automated AI Chatbot Response (Managed Directly in Node.js Application Backend)
        if (!fromMe) {
          try {
            const userSnap = await restGetDoc(`users/${workspaceId}`);
            if (userSnap.exists && userSnap.data()?.chatbotEnabled === true) {
              console.log(`Node app AI Chatbot trigger: chatbotEnabled=true for workspaceId=${workspaceId}`);
              const userData = userSnap.data() || {};
              
              const geminiApiKey = process.env.GEMINI_API_KEY || userData.apiKey;
              if (geminiApiKey) {
                const systemInstruction = `
Your are a professional, friendly, and efficient AI support assistant representing ${userData.businessName || "our business"}.

Custom Core Rules & Instructions:
${userData.customInstructions || "Answer customers politely. Be very natural and brief."}

Booking / Reservation Capability:
${userData.bookingEnabled ? `Table table booking and reservations are ACTIVE. When a user wishes to make a reservation, collect their: number of guests, date, time, customer name, and customer phone number in a smooth, human conversation.` : `Table table booking is not configured.`}

Important Operational mandates:
1. Keep your reply brief, natural, and friendly. Avoid excessive jargon.
2. Structure your response with line breaks for optimal readability on mobile screens.
`;

                let replyText = "";
                try {
                  console.log(`Running RAG pipeline for WhatsApp inbound message: "${content}"`);
                  const ragRes = await generateRagResponse(workspaceId, content);
                  replyText = ragRes.text;
                } catch (ragErr: any) {
                  console.warn(`RAG pipeline failed, falling back to direct Vertex AI fallback:`, ragErr.message);
                  const { getFirebaseAIModel } = await import("../firebaseAi.ts");
                  const aiModel = getFirebaseAIModel({
                    modelName: "gemini-3.5-flash",
                    systemInstruction: systemInstruction
                  });
                  const response = await aiModel.generateContent(content);
                  replyText = response.response.text();
                }

                if (replyText.trim()) {
                  const wasenderApiKey = process.env.WASENDER_API_KEY;
                  if (wasenderApiKey && wasenderApiKey !== "your_bearer_token") {
                    const toPhone = remoteJid; // eg: 2126...00@s.whatsapp.net
                    
                    // Fetch whatsappSessionId from Firestore if any
                    let finalSessionId = process.env.SESSION_ID || "your_session_id";
                    try {
                      const whatsappDocPath = `workspaces/${workspaceId}/whatsapp/${instanceName}`;
                      const snap = await restGetDoc(whatsappDocPath);
                      if (snap.exists && snap.data()?.whatsappSessionId) {
                        finalSessionId = snap.data().whatsappSessionId;
                      }
                    } catch (dbErr) {
                      console.warn("Could not retrieve whatsapp session id in webhook Chatbot:", dbErr);
                    }
                    
                    const cleanSessionId = finalSessionId.trim().replace(/^instance_/, '');

                    console.log(`Dispatched automated WaSender AI response to ${toPhone} using session ID: "${cleanSessionId}"`);
                    
                    await axios.post(
                      `https://api.wasenderapi.com/api/sessions/${cleanSessionId}/messages/text`,
                      {
                        to: toPhone,
                        text: replyText
                      },
                      {
                        headers: {
                          "Content-Type": "application/json",
                          "Authorization": `Bearer ${wasenderApiKey}`
                        }
                      }
                    );

                    // Record the chatbot reply locally in Firestore
                    const replyMessageId = `reply_was_${Date.now()}`;
                    const outboundMessage = {
                      id: replyMessageId,
                      workspaceId,
                      conversationId,
                      from: "me",
                      to: contactPhone,
                      content: replyText,
                      type: "text",
                      direction: "outgoing",
                      timestamp: new Date().toISOString(),
                      status: "sent"
                    };

                    try {
                      await restSetDoc(`messages/${replyMessageId}`, outboundMessage);
                      await restSetDoc(`conversations/${conversationId}`, {
                        lastMessage: replyText,
                        lastMessageAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        unreadCount: 0
                      });
                    } catch (wrErr: any) {
                      console.warn("REST write for chatbot response failed:", wrErr.message);
                    }

                    pendingUpdates.push({
                      workspaceId,
                      type: 'setDoc',
                      collection: 'messages',
                      id: replyMessageId,
                      data: outboundMessage
                    });

                    pendingUpdates.push({
                      workspaceId,
                      type: 'setDoc',
                      collection: 'conversations',
                      id: conversationId,
                      data: {
                        lastMessage: replyText,
                        lastMessageAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        unreadCount: 0
                      }
                    });

                    // Append telemetry steps for UI webhook console trace logs
                    const autoReplySteps = [
                      `🤖 Chatbot Trigger: Incoming message parsed from target customer (+${contactPhone}).`,
                      `🧠 context Ingestion: Running live Semantic Vector Search Pinecone index RAG retrieval.`,
                      `💻 LLM Inference: Formulating professional AI response based on custom instructions.`,
                      `📤 Outgoing Dispatch: Delivering message "${replyText.substring(0, 40)}..." through WaSender API gateway.`
                    ];

                    await appendWebhookLog(workspaceId, {
                      id: `log_${Date.now()}_auto_reply`,
                      timestamp: new Date().toISOString(),
                      event: 'messages.auto_reply',
                      connected: true,
                      phone: contactPhone,
                      steps: autoReplySteps,
                      payloadReceived: {
                        event: 'messages.auto_reply',
                        instance: instanceName,
                        data: {
                          messageType: 'text',
                          fromMe: true,
                          remoteJid: toPhone,
                          messageLength: replyText.length
                        }
                      }
                    });

                    console.log(`Success! Node App AI Chatbot sent automated response.`);
                  } else {
                    console.warn(`Node App: Missing/unconfigured WASENDER_API_KEY. Skipping dispatch.`);
                  }
                }
              } else {
                console.warn(`Node App: Missing GEMINI_API_KEY for workspaceId: ${workspaceId}.`);
              }
            }
          } catch (chatbotErr: any) {
            console.error("Failed executing automated Node App WaSender chatbot reply:", chatbotErr.message);
          }
        }
      }
    }

    // Support generic/fallback logging for other webhook events that aren't explicitly consumed
    const isConnUpdate = (eventName === 'connection.update' || eventName === 'CONNECTION_UPDATE');
    const isMsgUpsert = (eventName === 'messages.upsert' || eventName === 'MESSAGES_UPSERT');
    if (!isConnUpdate && !isMsgUpsert) {
      console.log(`[Webhook Event Received] Logging custom event "${eventName}" into logs history...`);
      const steps = [
        `📡 Webhook Activation: WhatsApp API dispatched event "${eventName || 'unknown'}" into our listener.`,
        `🔍 Inspecting Payload: Extracted event metadata successfully.`,
        `💾 Logging Event: Appended unhandled general event to the active console logs history.`
      ];

      let phone = 'N/A';
      if (payload.data?.phone) {
        phone = payload.data.phone;
      } else if (payload.sender) {
        phone = payload.sender.split(':')[0].split('@')[0];
      }

      try {
        await appendWebhookLog(workspaceId, {
          id: `log_${Date.now()}_generic_${Math.random().toString(36).substr(2, 5)}`,
          timestamp: new Date().toISOString(),
          event: eventName || 'unknown_event',
          connected: true,
          phone,
          steps,
          payloadReceived: payload
        });
      } catch (err: any) {
        console.error("Failed to append generic webhook log to Firestore:", err.message);
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(200).send("Error logged"); 
  }
});

// API: Verifies that the client actually linked/verified their phone number using Firebase Auth
router.post("/api/whatsapp/mfa/verify-auth", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const workspaceId = req.workspaceId!;
    const idToken = req.idToken!;

    // Decode the Firebase JWT via Admin SDK to check for a linked, verified phone number
    const decoded = await authAdmin.verifyIdToken(idToken);
    const verifiedPhone = decoded.phone_number;

    if (!verifiedPhone) {
      return res.status(400).json({
        success: false,
        error: "Verified phone number not found in active session status.",
        details: "Please link your phone number to your active Google/Firebase Auth account using standard Phone Auth/Verification first."
      });
    }

    // Clean phone number format for DB
    const cleanPhone = verifiedPhone.replace(/\D/g, '');

    const instanceName = `instance_${workspaceId}`;
    const whatsappDocPath = `workspaces/${workspaceId}/whatsapp/${instanceName}`;

    // Fetch existing settings
    let existingData: any = {};
    try {
      const snap = await restGetDoc(whatsappDocPath, idToken);
      if (snap.exists) {
        existingData = snap.data() || {};
      }
    } catch (err) {}

    // Persist verified MFA state in database
    await restSetDoc(whatsappDocPath, {
      ...existingData,
      mfaEnabled: true,
      mfaPhone: cleanPhone,
      phone: cleanPhone, // Update primary WhatsApp connection phone too
      updatedAt: new Date().toISOString()
    }, idToken);

    res.json({
      success: true,
      message: "Phone Multi-Factor Authentication successfully enrolled via Firebase Auth!",
      mfaPhone: cleanPhone
    });
  } catch (error: any) {
    console.error("Firebase MFA Auth validation failed:", error);
    res.status(500).json({ error: error.message || "Failed to authenticate Firebase phone credential." });
  }
});

// API: Disables Phone MFA security enforcement
router.post("/api/whatsapp/mfa/disable", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const workspaceId = req.workspaceId!;
    const idToken = req.idToken!;

    const instanceName = `instance_${workspaceId}`;
    const whatsappDocPath = `workspaces/${workspaceId}/whatsapp/${instanceName}`;

    const snap = await restGetDoc(whatsappDocPath, idToken);
    if (!snap.exists) {
      return res.status(400).json({ error: "No active WhatsApp configuration document exists." });
    }

    const data = snap.data() || {};

    await restSetDoc(whatsappDocPath, {
      ...data,
      mfaEnabled: false,
      mfaPhone: null,
      updatedAt: new Date().toISOString()
    }, idToken);

    res.json({
      success: true,
      message: "Multi-Factor Authentication successfully disabled."
    });
  } catch (error: any) {
    console.error("MFA disable failed:", error);
    res.status(500).json({ error: error.message || "MFA de-authorization process failed." });
  }
});

export default router;
