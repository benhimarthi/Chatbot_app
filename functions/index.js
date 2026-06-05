const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");

// Read local firebase configuration parameters
let firebaseConfig = {};
try {
  const configPath = path.join(__dirname, "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
} catch (e) {
  console.warn("Failed to load firebase-applet-config.json:", e.message);
}

const adminConfig = {
  projectId: firebaseConfig.projectId
};

if (admin.apps.length === 0) {
  admin.initializeApp(adminConfig);
}

// Target the workspace's specific Firestore database (Standard or Custom Enterprise)
const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
const db = admin.firestore(databaseId);

/**
 * Appends a telemetry log item to the historical array in workspaces/{id}/whatsapp/logs_history
 */
async function appendWebhookLog(workspaceId, logEntry) {
  try {
    const logsDocRef = db.collection("workspaces")
      .doc(workspaceId)
      .collection("whatsapp")
      .doc("logs_history");

    let currentLogs = [];
    try {
      const snap = await logsDocRef.get();
      if (snap.exists) {
        currentLogs = snap.data().logs || [];
      }
    } catch (e) {
      // Document might not exist yet
    }

    currentLogs.unshift(logEntry);
    if (currentLogs.length > 25) {
      currentLogs = currentLogs.slice(0, 25);
    }

    await logsDocRef.set({
      logs: currentLogs,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.error("Failed to append webhook telemetry log:", err.message);
  }
}

/**
 * HTTPS Cloud Function: handles inbound webhooks from Evolution API (Temporarily Disabled)
 */
exports.evolutionWebhook = functions.https.onRequest(async (req, res) => {
  return res.status(404).send("Evolution API support is temporarily disabled of this workspace.");
});
    // Legacy messages.upsert processing removed "for the moment".

/**
 * Helper to resolve workspaceId dynamically in single-tenant applications
 */
async function resolveWorkspaceId() {
  if (process.env.WORKSPACE_ID) {
    return process.env.WORKSPACE_ID;
  }
  try {
    const snap = await db.collection("users").limit(1).get();
    if (!snap.empty) {
      return snap.docs[0].id;
    }
  } catch (e) {
    console.error("Error resolving workspaceId from users collection:", e.message);
  }
  return "glass-arcanum-default-workspace";
}

/**
 * HTTPS Cloud Function: handles inbound webhooks from WaSender API
 */
exports.wasenderWebhook = functions.https.onRequest(async (req, res) => {
  // Enforce POST method
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  // 1. Verify signature if WEBHOOK_SECRET is configured
  const webhookSecret = process.env.WEBHOOK_SECRET || "your_webhook_secret";
  if (webhookSecret && webhookSecret !== "your_webhook_secret") {
    const signature = req.headers["x-webhook-signature"];
    if (signature !== webhookSecret) {
      console.warn("Invalid signature from WaSender callback:", signature);
      return res.status(401).json({ error: "Invalid signature" });
    }
  }

  // 2. Respond 200 immediately per WaSender requirements
  res.status(200).send("OK");

  try {
    const payload = req.body || {};
    const { type, data } = payload;
    
    console.log(`WaSender Webhook Event type: "${type}"`);

    // Only handle incoming messages upsert events
    if (type !== "messages.upsert") return;
    if (data?.fromMe) return; // ignore your own sent messages

    const customerPhone = data.from;       // e.g. "212600000000@s.whatsapp.net"
    const messageText = data.messageBody || "";  // unified field in WasenderAPI

    if (!customerPhone) {
      console.warn("No sender (from) number indicated in WaSender payload:", JSON.stringify(payload));
      return;
    }

    const contactPhone = customerPhone.split('@')[0];
    const conversationId = `conv_${contactPhone}`;
    const messageId = data.id || `msg_was_${Date.now()}`;

    // Resolve the workspaceId dynamically
    const workspaceId = await resolveWorkspaceId();
    const sessionId = process.env.SESSION_ID || "your_session_id";

    console.log(`WaSender processing inbound chat for conversationId: ${conversationId} on workspaceId: ${workspaceId}`);

    const normalizedMessage = {
      id: messageId,
      workspaceId,
      conversationId,
      from: contactPhone,
      to: 'me',
      content: messageText,
      type: 'text',
      direction: 'incoming',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: 'received'
    };

    const contactName = data.pushName || contactPhone;

    const normalizedConversation = {
      id: conversationId,
      workspaceId,
      whatsappInstance: sessionId,
      contactPhone,
      contactName,
      lastMessage: messageText,
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      unreadCount: 1
    };

    // Telemetry logs matching the developer screen's stream
    const steps = [
      `📡 Webhook Activation: Inbound WaSender chat event "${type}" resolved in Serverless Cloud Function.`,
      `💬 Content Verification: Decoded message content: "${messageText.substr(0, 60)}${messageText.length > 60 ? '...' : ''}"`,
      `💾 Persistence Pipeline: Enqueuing record to "messages/${messageId}" and updating conversation headers.`,
      `📢 Operator Dispatch: Dynamic dashboard notifications dispatched instantly to operators.`
    ];

    await appendWebhookLog(workspaceId, {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      event: type,
      connected: true,
      phone: contactPhone,
      steps,
      payloadReceived: {
        event: type,
        instance: sessionId,
        data: {
          messageType: "text",
          fromMe: false,
          remoteJid: customerPhone,
          pushName: contactName,
          messageLength: messageText.length
        }
      }
    });

    // Write message & update conversation in Firestore
    await db.collection("messages").doc(messageId).set(normalizedMessage, { merge: true });
    await db.collection("conversations").doc(conversationId).set(normalizedConversation, { merge: true });

    console.log(`Successfully persisted inbound WaSender message from ${contactPhone}`);
  } catch (err) {
    console.error("Fatal Error inside wasenderWebhook function:", err);
  }
});
