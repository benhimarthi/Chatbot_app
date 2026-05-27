import { Router } from "express";
import axios from "axios";
import { 
  createInstance, 
  fetchQRCode, 
  setWebhook, 
  getConnectionState, 
  sendTextMessage 
} from "../../src/services/evolutionService.ts";
import { 
  restGetDoc, 
  restSetDoc, 
  pendingUpdates, 
  appendWebhookLog,
  authAdmin
} from "../firebaseAdmin.ts";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.ts";

const router = Router();

// API: Connect WhatsApp Instance
router.post("/api/whatsapp/connect", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const workspaceId = req.workspaceId!;
    const idToken = req.idToken!;

    const instanceName = `instance_${workspaceId}`;
    
    // 1. Create or ensure instance is registered
    try {
      await createInstance(instanceName);
    } catch (createErr: any) {
      console.warn("Instance creation warning, might exist:", createErr.message);
    }

    // 2. Retrieve QR Code
    const qrResponse = await fetchQRCode(instanceName);
    const qrCode = qrResponse?.qrcode?.base64 || qrResponse?.base64 || qrResponse?.qrcode?.code || "";

    // 3. Register Webhook Url (Dynamic based on APP_URL or request origin)
    let appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    // Enforce HTTPS for webhook callbacks on non-localhost/non-IP domain hosts
    if (!appUrl.startsWith('https://') && !appUrl.includes('localhost') && !appUrl.includes('127.0.0.1')) {
      appUrl = appUrl.replace(/^http:\/\//i, 'https://');
    }
    const webhookUrl = `${appUrl}/api/whatsapp/webhook`;
    try {
      await setWebhook(instanceName, webhookUrl);
    } catch (webhookErr: any) {
      console.error("Webhook auto-registration failed:", webhookErr.message);
    }

    // 4. Update states in Firestore for the workspace
    await restSetDoc(`workspaces/${workspaceId}/whatsapp/${instanceName}`, {
      instanceName,
      connected: false,
      phone: "",
      createdAt: new Date(),
      updatedAt: new Date()
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
      qrCode
    });
  } catch (error: any) {
    console.error("WhatsApp Connection failed:", error);
    res.status(500).json({ error: error.message || "Failed to connect WhatsApp" });
  }
});

// API: Get Current WhatsApp Connection State
router.get("/api/whatsapp/status", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const workspaceId = req.workspaceId!;
    const idToken = req.idToken!;

    const instanceName = `instance_${workspaceId}`;
    const connResponse = await getConnectionState(instanceName);
    
    // Deep structural and recursive checking helper for maximal robustness
    const isInstanceConnected = (obj: any): boolean => {
      if (!obj) return false;
      if (typeof obj === 'string') {
        const s = obj.toLowerCase();
        return s === 'open' || s === 'connected' || s === 'online' || s === 'active';
      }
      if (typeof obj === 'object') {
        for (const k of Object.keys(obj)) {
          if (isInstanceConnected(obj[k])) return true;
        }
      }
      return false;
    };

    const state = connResponse?.instance?.state || connResponse?.state || connResponse?.instance?.status || connResponse?.status || 'close';
    const connected = isInstanceConnected(connResponse);

    const whatsappDocPath = `workspaces/${workspaceId}/whatsapp/${instanceName}`;
    const snap = await restGetDoc(whatsappDocPath, idToken);
    let phone = "";
    let existingData: any = {};
    if (snap.exists) {
      existingData = snap.data() || {};
      phone = snap.data()?.phone || "";
    }

    // Try to capture phone number dynamically from connection state response if available
    if (connected) {
      const rawPhone = connResponse?.instance?.ownerJid || 
                       connResponse?.instance?.me?.id || 
                       connResponse?.instance?.me?.jid || 
                       connResponse?.instance?.me?.user ||
                       connResponse?.me?.id || 
                       connResponse?.me?.jid || 
                       connResponse?.me?.user;
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
      phone
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
    const sendResult = await sendTextMessage(instanceName, recipientPhone, messageText);

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
    const { webhookUrl } = req.body;
    if (!webhookUrl) {
      return res.status(400).json({ error: "webhookUrl is required" });
    }

    const instanceName = `instance_${workspaceId}`;
    await setWebhook(instanceName, webhookUrl);

    res.json({
      success: true,
      message: `Successfully set custom webhook URL on Evolution API: ${webhookUrl}`
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

    // Create a simulated payload matching Evolution API CONNECTION_UPDATE structure
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

// API: Evolution API incoming Webhook Endpoint callback
router.post("/api/whatsapp/webhook", async (req, res) => {
  try {
    const payload = req.body;
    const eventName = payload.event;
    const instanceName = payload.instance || payload.instanceName;

    console.log(`Received Webhook: Event = ${eventName}, Instance = ${instanceName}`);

    if (!instanceName) {
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
        `📡 Webhook Activation: Evolution API dispatched event "${eventName}" into our listener.`,
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
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(200).send("Error logged"); 
  }
});

export default router;
