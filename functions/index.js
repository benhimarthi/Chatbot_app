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
 * HTTPS Cloud Function: handles inbound webhooks from Evolution API
 */
exports.evolutionWebhook = functions.https.onRequest(async (req, res) => {
  // Enforce POST method for receiving callbacks
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const payload = req.body || {};
    const eventName = payload.event;
    const instanceName = payload.instance || payload.instanceName;

    console.log(`Evolution Webhook Event: "${eventName}" | Instance: "${instanceName}"`);

    if (!instanceName) {
      return res.status(200).send("No instance target specified");
    }

    // Extract workspace ID from naming schema: instance_WORKSPACE_ID
    const workspaceId = instanceName.replace(/^instance_/, "");

    // 1. WhatsApp Connection Status Update Callback
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
        `📡 Webhook Activation: Evolution API dispatched event "${eventName}" into Firebase Cloud Function.`,
        `🔍 Payload Analysis: Parsed connection status is "${state || 'unknown'}" (${connected ? 'CONNECTED' : 'DISCONNECTED'}).`,
        `📱 Metadata Extraction: Screened identifiers. Extracted phone: "${phone || 'N/A'}".`,
        `💾 Firestore Storage Sync: Synchronizing state to workspaces/${workspaceId}/whatsapp/${instanceName}...`,
        `🔔 State Propagation: Success! Changes are live on Dashboard client subscribers.`
      ];

      // Re-use logs schema to align perfectly with operator page visualization
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

      // Synchronize in Firestore
      await db.collection("workspaces")
        .doc(workspaceId)
        .collection("whatsapp")
        .doc(instanceName)
        .set({
          instanceName,
          connected,
          phone,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }

    // 2. Incoming or Outgoing Messaging Event Callback
    if (eventName === 'messages.upsert' || eventName === 'MESSAGES_UPSERT') {
      const msgData = payload.data || {};
      const key = msgData.key || {};
      const fromMe = key.fromMe || false;
      const remoteJid = key.remoteJid || '';

      if (remoteJid) {
        const contactPhone = remoteJid.split('@')[0];
        const conversationId = `conv_${contactPhone}`;
        const messageId = key.id || `msg_${Date.now()}`;

        let content = '';
        if (msgData.message?.conversation) {
          content = msgData.message.conversation;
        } else if (msgData.message?.extendedTextMessage?.text) {
          content = msgData.message.extendedTextMessage.text;
        } else if (typeof msgData.message === 'string') {
          content = msgData.message;
        } else if (msgData.message?.imageMessage?.caption) {
          content = msgData.message.imageMessage.caption;
        } else {
          content = '[Media Message]';
        }

        const type = msgData.messageType || 'text';
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
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
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
          lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          unreadCount: fromMe ? 0 : 1
        };

        const steps = [
          `📡 Webhook Activation: Incoming chat event "${eventName}" resolved in Cloud Function.`,
          `💬 Content Verification: Decoded message content: "${content.substr(0, 60)}${content.length > 60 ? '...' : ''}"`,
          `💾 Persistence Pipeline: Storing message and updating active conversation header.`,
          `📢 Chat Dispatch: Automatically propagated thread changes to operator UI screens.`
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

        // Store messages and update conversation
        await db.collection("messages").doc(messageId).set(normalizedMessage, { merge: true });
        await db.collection("conversations").doc(conversationId).set(normalizedConversation, { merge: true });

        // 3. Automated AI Chatbot Respond Trigger Triggering Flow
        if (!fromMe) {
          try {
            // Fetch the business settings profile
            const userSnap = await db.collection("users").doc(workspaceId).get();
            if (userSnap.exists && userSnap.data().chatbotEnabled === true) {
              console.log(`AI Chatbot trigger matching workspace ${workspaceId} initialized!`);

              // Assemble Context via Document RAG Ingestion
              const docsSnap = await db.collection("users")
                .doc(workspaceId)
                .collection("documents")
                .where("status", "==", "Processed")
                .get();

              let businessDossier = "";
              docsSnap.forEach(docObj => {
                const d = docObj.data();
                businessDossier += `Document name: ${d.name}\nContent:\n${d.content || ""}\n\n---\n\n`;
              });

              // Retrieve recent back-and-forth messages for conversation history/context
              const historySnap = await db.collection("messages")
                .where("conversationId", "==", conversationId)
                .orderBy("timestamp", "desc")
                .limit(6)
                .get();

              const recentThreads = [];
              historySnap.forEach(h => recentThreads.push(h.data()));
              recentThreads.reverse();

              const threadLogs = recentThreads
                .map(t => `${t.from === "me" ? "Business Assistant" : "Customer"}: ${t.content}`)
                .join("\n");

              // Formulate system guidelines integrating custom instructions and booking parameters
              const systemInstruction = `
                You are a professional, friendly, and efficient AI support assistant representing ${userSnap.data().businessName || "our business"}.
                
                Custom Core Rules & Instructions:
                ${userSnap.data().customInstructions || "Answer customers politely. Be very natural and brief."}
                
                Reference Material & Business Dossier:
                ${businessDossier || "No special articles available. Use generic polite service rules."}
                
                Booking / Reservation Capability:
                ${userSnap.data().bookingEnabled ? `Table table booking and reservations are ACTIVE. When a user wishes to make a reservation, collect their: number of guests, date, time, customer name, and customer phone number in a smooth, human conversation.` : `Table table booking is not configured.`}
                
                Important Operational mandates:
                1. Keep your reply brief, natural, and friendly. Avoid excessive jargon.
                2. If the user asks a question that absolute is not referenced in the reference documents, politely note that you can provide standard help or that a human manager will be in touch shortly.
                3. Structure your response with line breaks for optimal readability on mobile screens.
              `;

              const promptMessage = `
                Communication History:
                ${threadLogs}
                
                New Inbound Message from Customer:
                "${content}"
                
                Please generate the next natural response:
              `;

              const geminiApiKey = process.env.GEMINI_API_KEY || userSnap.data().apiKey;
              if (geminiApiKey) {
                const ai = new GoogleGenAI({ apiKey: geminiApiKey });
                const result = await ai.models.generateContent({
                  model: "gemini-3.5-flash",
                  contents: [{ role: 'user', parts: [{ text: promptMessage }] }],
                  config: { systemInstruction },
                });

                const replyText = result.text || "";

                if (replyText.trim()) {
                  // Forward message payload via Evolution API to the WhatsApp recipient
                  // We extract API connections from environment variables usually deployed with functions
                  const apiBaseUrl = process.env.EVOLUTION_API_URL;
                  const apiKeyHeaders = process.env.EVOLUTION_API_KEY;

                  if (apiBaseUrl && apiKeyHeaders) {
                    const formattedBaseUrl = apiBaseUrl.endsWith("/") ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
                    await axios.post(
                      `${formattedBaseUrl}/message/sendText/${instanceName}`,
                      {
                        number: contactPhone,
                        text: replyText
                      },
                      {
                        headers: {
                          "Content-Type": "application/json",
                          "apikey": apiKeyHeaders,
                          "apiKey": apiKeyHeaders
                        }
                      }
                    );

                    // Write out the reply message to document and conversation log matching realtime expectations
                    const replyMessageId = `reply_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                    const outboundMessage = {
                      id: replyMessageId,
                      workspaceId,
                      conversationId,
                      from: "me",
                      to: contactPhone,
                      content: replyText,
                      type: "text",
                      direction: "outgoing",
                      timestamp: admin.firestore.FieldValue.serverTimestamp(),
                      status: "sent"
                    };

                    await db.collection("messages").doc(replyMessageId).set(outboundMessage, { merge: true });
                    await db.collection("conversations").doc(conversationId).set({
                      lastMessage: replyText,
                      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
                      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                      unreadCount: 0
                    }, { merge: true });

                    console.log(`Success! Automatized response sent for conversationId: ${conversationId}`);
                  } else {
                    console.warn("Evolution API configuration keys are not set in the active Cloud Functions environment schema.");
                  }
                }
              } else {
                console.warn(`Did not trigger AI assistant generation: GEMINI API key is missing for workspaceId: ${workspaceId}.`);
              }
            }
          } catch (aiErr) {
            console.error("Failed executing automated AI reply steps:", aiErr.message);
          }
        }
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Fatal Error inside evolutionWebhook function:", err);
    res.status(200).send("Error successfully caught and logged");
  }
});
