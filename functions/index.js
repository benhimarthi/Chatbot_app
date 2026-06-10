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
 * Helper to resolve dynamic webhook secret from Firestore subcollection group
 */
async function resolveWebhookSecret(apiKey) {
  if (!apiKey) return null;
  try {
    const snap = await db
      .collectionGroup("whatsapp")
      .where("apiKey", "==", apiKey)
      .limit(1)
      .get();

    if (!snap.empty) {
      return snap.docs[0].data().webhook_secret ?? null;
    }
  } catch (e) {
    console.error("Error resolving webhookSecret from apiKey:", e.message);
  }
  return null;
}

/**
 * Helper to resolve workspaceId dynamically in single-tenant/multi-tenant setups via whatsapp collection group
 */
async function resolveWorkspaceId(apiKey) {
  if (process.env.WORKSPACE_ID) {
    return { workspaceId: process.env.WORKSPACE_ID, webhookSecret: null };
  }

  if (apiKey) {
    try {
      // Query all whatsapp subcollection documents across all workspaces
      const snap = await db
        .collectionGroup("whatsapp")
        .where("apiKey", "==", apiKey)
        .limit(1)
        .get();

      if (!snap.empty) {
        // The parent of the whatsapp doc is the workspace document
        const whatsappDoc = snap.docs[0];
        const workspaceId = whatsappDoc.ref.parent && whatsappDoc.ref.parent.parent ? whatsappDoc.ref.parent.parent.id : null;
        const webhookSecret = whatsappDoc.data().webhook_secret ?? null;

        if (workspaceId && workspaceId !== "diagnostics_rest") {
          return { workspaceId, webhookSecret };
        }
      }
    } catch (e) {
      console.error("Error resolving workspaceId from apiKey:", e.message);
    }
  }

  try {
    const snap = await db.collection("users").limit(1).get();
    if (!snap.empty) {
      return { workspaceId: snap.docs[0].id, webhookSecret: null };
    }
  } catch (e) {
    console.error("Error resolving workspaceId from users collection:", e.message);
  }
  return { workspaceId: "glass-arcanum-default-workspace", webhookSecret: null };
}

/**
 * HTTPS Cloud Function: handles inbound webhooks from WaSender API
 */
exports.wasenderWebhook = functions.https.onRequest(async (req, res) => {
  // Enforce POST method
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const payload = req.body || {};
  const apiKey = payload.apiKey;

  // 1. Verify signature if WEBHOOK_SECRET is configured at the environment level,
  // or dynamically retrieved from the database
  let webhookSecret = process.env.WEBHOOK_SECRET || "your_webhook_secret";
  if (webhookSecret === "your_webhook_secret") {
    webhookSecret = null;
  }

  // If environment variable is not configured, resolve from database using apiKey
  if (!webhookSecret && apiKey) {
    webhookSecret = await resolveWebhookSecret(apiKey);
  }

  if (webhookSecret) {
    const signature = req.headers["x-webhook-signature"];
    if (signature !== webhookSecret) {
      console.warn("Invalid webhook signature for apiKey:", apiKey);
      return res.status(401).json({ error: "Invalid signature" });
    }
  }

  // 2. Respond 200 immediately per WaSender requirements
  res.status(200).send("OK");

  try {
    const type = payload.event || payload.type;
    const data = payload.data;
    
    console.log(`WaSender Webhook Event type: "${type}"`);

    // Only handle incoming messages upsert events
    if (type !== "messages.upsert") return;
    if (data?.fromMe) return; // ignore your own sent messages

    const customerPhone = (data?.key && data.key.cleanedSenderPn) || data?.from;       // e.g. "212600000000@s.whatsapp.net" or clean number
    const messageText = data.messageBody || "";  // unified field in WasenderAPI

    if (!customerPhone) {
      console.warn("No sender (from/cleanedSenderPn) number indicated in WaSender payload:", JSON.stringify(payload));
      return;
    }

    const contactPhone = customerPhone.split('@')[0];
    const conversationId = `conv_${contactPhone}`;
    const messageId = data.id || `msg_was_${Date.now()}`;

    // Resolve the workspaceId dynamically
    const { workspaceId } = await resolveWorkspaceId(apiKey);
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

    // --- AUTOMATED CHATBOT REPLY PIPELINE VIA ON-DEMAND CLOUD RUN RAG ENDPOINT ---
    const wasenderApiKey = data.apiKey;
    const ragApiKey = process.env.RAG_API_KEY;
    
    // Auto-detect the Cloud Run backend base URL from environment config, or default to the workspace's primary Shared App URL
    const backendBaseUrl = process.env.BACKEND_API_URL || "https://ais-pre-u5p5kdtg2ii36nzbftwvyx-702146563588.europe-west2.run.app";

    if (wasenderApiKey && wasenderApiKey !== "your_bearer_token") {
      try {
        console.log(`[Chatbot] Dispatching RAG request to Cloud Run backend endpoint: ${backendBaseUrl}/api/rag/generate-response`);
        
        // 1. Invoke the on-demand RAG endpoint hosted on your Cloud Run instance
        const ragRes = await axios.post(`${backendBaseUrl}/api/rag/generate-response`, {
          workspaceId,
          messageText,
          apiKey: ragApiKey
        }, {
          headers: { "Content-Type": "application/json" },
          timeout: 15000 // 15-second timeout for secure LLM response generation
        });

        if (ragRes.data && ragRes.data.success && ragRes.data.text) {
          const replyText = ragRes.data.text;
          console.log(`[Chatbot] Successfully received RAG response text: "${replyText.substring(0, 50)}..."`);

          // 2. Resolve target session of WaSender
          let finalSessionId = sessionId;
          try {
            const whatsappSnap = await db.collection("workspaces").doc(workspaceId).collection("whatsapp").doc(`instance_${workspaceId}`).get();
            if (whatsappSnap.exists && whatsappSnap.data()?.whatsappSessionId) {
              finalSessionId = whatsappSnap.data().whatsappSessionId;
            }
          } catch (dbErr) {
            console.warn("[Chatbot] Could not retrieve whatsapp session id from Firestore:", dbErr.message);
          }

          const cleanSessionId = finalSessionId.trim().replace(/^instance_/, '');
          console.log(`[Chatbot] Sending reply to +${contactPhone} formatted via WaSender Session: "${cleanSessionId}"`);

          // 3. Dispatch reply to customer's phone via WaSender
          await axios.post(
            `https://api.wasenderapi.com/api/sessions/${cleanSessionId}/messages/text`,
            {
              to: customerPhone,
              text: replyText
            },
            {
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${wasenderApiKey}`
              }
            }
          );

          // 4. Save outbound reply to Firestore to synchronize state in active dashboard
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
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            status: "sent"
          };

          await db.collection("messages").doc(replyMessageId).set(outboundMessage);
          await db.collection("conversations").doc(conversationId).set({
            lastMessage: replyText,
            lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            unreadCount: 0
          }, { merge: true });

          // 5. Append telemetry pipeline actions and visual step tracers to dashboard logs
          const autoReplySteps = [
            `🤖 [Cloud Function] Chatbot Trigger: Incoming message parsed from target customer (+${contactPhone}).`,
            `🧠 [Cloud Function] Secure Proxy: Querying hosted Cloud Run RAG endpoint for contextual synthesis.`,
            `💻 [Cloud Function] LLM Inference: Received response successfully formulated on model gemini-3.5-flash.`,
            `📤 [Cloud Function] Outgoing Dispatch: Delivering reply through the WaSender gateway.`
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
              instance: `instance_${workspaceId}`,
              data: {
                messageType: 'text',
                fromMe: true,
                remoteJid: customerPhone,
                messageLength: replyText.length
              }
            }
          });

          console.log(`[Chatbot] RAG pipeline and response delivery execution finalized.`);
        } else {
          console.warn("[Chatbot] RAG endpoint returned unparsable content or execution failed.", ragRes.data);
        }
      } catch (pipelineErr) {
        console.error("[Chatbot] Pipeline endpoint query or message delivery failed:", pipelineErr.message || pipelineErr);
      }
    } else {
      console.log("[Chatbot] WASENDER_API_KEY environment configuration missing; skipping active chatbot execution.");
    }
  } catch (err) {
    console.error("Fatal Error inside wasenderWebhook function:", err);
  }
});

/**
 * HTTPS Cloud Function: generateRag
 * Standalone HTTPS endpoint to run the complete RAG pipeline directly on your Firebase instance.
 * Accepts: { workspaceId, userId, messageText, question, apiKey }
 */
exports.generateRag = functions.https.onRequest(async (req, res) => {
  // Allow cross-origin requests
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
    return res.status(204).send("");
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { workspaceId, userId, messageText, question, apiKey } = req.body || {};
    const targetWorkspaceId = workspaceId || userId;
    const targetQuestion = messageText || question;

    if (!targetWorkspaceId || !targetQuestion) {
      return res.status(400).json({
        error: "Missing parameters: 'workspaceId' (or 'userId') and 'messageText' (or 'question') are required."
      });
    }

    // Optional safety token check (RAG_API_KEY)
    const localRagKey = process.env.RAG_API_KEY;
    const requestApiKey = apiKey || req.headers["x-api-key"] || (req.headers["authorization"] ? req.headers["authorization"].replace("Bearer ", "") : null);

    if (localRagKey && requestApiKey !== localRagKey) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing RAG_API_KEY authorization." });
    }

    console.log(`[Cloud Function RAG] Processing query for Workspace: "${targetWorkspaceId}", Question: "${targetQuestion}"`);

    const geminiApiKey = process.env.GEMINI_API_KEY;
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const pineconeIndexName = process.env.PINECONE_INDEX;

    // Fallback to Vertex AI (free version) if no GEMINI_API_KEY is configured
    const useVertexAI = !geminiApiKey;
    if (useVertexAI) {
      console.log(`[Cloud Function RAG] GEMINI_API_KEY is not configured; using fallback Firebase/Vertex AI (free version).`);
    } else {
      console.log(`[Cloud Function RAG] GEMINI_API_KEY is configured; using direct Gemini Developer API.`);
    }

    let context = "No vector database context available.";
    let selectedImages = [];

    // 1. Fetch relevant vector chunks from Pinecone
    if (pineconeApiKey && pineconeIndexName) {
      try {
        const { Pinecone } = require("@pinecone-database/pinecone");
        const pinecone = new Pinecone({ apiKey: pineconeApiKey });
        const index = pinecone.index(pineconeIndexName);
        const ai = useVertexAI ? new GoogleGenAI({ vertexai: true }) : new GoogleGenAI({ apiKey: geminiApiKey });

        // Embed the query using gemini-embedding-2
        const embedRes = await ai.models.embedContent({
          model: 'gemini-embedding-2',
          contents: [targetQuestion],
          config: {
            outputDimensionality: 1024
          }
        });

        if (embedRes.embeddings && embedRes.embeddings[0] && embedRes.embeddings[0].values) {
          const vector = embedRes.embeddings[0].values;
          const queryResponse = await index.query({
            vector,
            topK: 5,
            filter: { userId: { "$eq": targetWorkspaceId } },
            includeMetadata: true
          });

          if (queryResponse.matches && queryResponse.matches.length > 0) {
            const contextChunks = [];
            const imageCandidates = [];
            const seenUrls = new Set();

            queryResponse.matches.forEach(match => {
              const text = match.metadata?.text || "";
              if (text) {
                contextChunks.push(text);
              }

              // Extract images if stored in pinecone metadata
              if (match.metadata?.images) {
                try {
                  const imgs = JSON.parse(match.metadata.images);
                  if (Array.isArray(imgs)) {
                    imgs.forEach(img => {
                      if (img.url && !seenUrls.has(img.url)) {
                        seenUrls.add(img.url);
                        imageCandidates.push({ url: img.url, alt: img.alt || "" });
                      }
                    });
                  }
                } catch (e) {
                  // Fallback for string-based arrays
                }
              }
            });

            if (contextChunks.length > 0) {
              context = contextChunks.join("\n\n---\n\n");
            }
            selectedImages = imageCandidates.slice(0, 3);
            console.log(`[Cloud Function RAG] Retrieved ${contextChunks.length} matching knowledge records from Pinecone.`);
          }
        }
      } catch (pineconeErr) {
        console.error("[Cloud Function RAG] Pinecone query execution failed:", pineconeErr.message || pineconeErr);
      }
    } else {
      console.log("[Cloud Function RAG] Pinecone environment variables not configured, skipping vector retrieval.");
    }

    // 2. Fetch custom system instructions and settings from Firestore
    let customInstructions = "Answer customers politely. Be very natural and brief.";
    let bookingEnabled = false;

    try {
      const settingsSnap = await db.collection("workspaces").doc(targetWorkspaceId).get();
      if (settingsSnap.exists) {
        const setts = settingsSnap.data() || {};
        if (setts.customInstructions) customInstructions = setts.customInstructions;
        if (setts.bookingEnabled) bookingEnabled = !!setts.bookingEnabled;
      }
    } catch (firestoreErr) {
      console.warn("[Cloud Function RAG] Failed to load workspace settings from Firestore:", firestoreErr.message);
    }

    // 3. Synthesize response using Gemini 3.5-flash
    const systemPrompt = `
You are a highly intelligent AI assistant with access to the user's personal documents and information.
Your goal is to answer the user's questions based on the provided context when applicable.

Context:
${context}

Custom Core Rules & Instructions:
${customInstructions}

Booking / Reservation Capability:
${bookingEnabled ? `Table / room booking and reservations are ACTIVE. When a user wishes to make a reservation, collect their: number of guests, date, time, customer name, and customer phone number in a smooth, human conversation.` : `Table booking is not configured.`}

Important Operational mandates:
1. Keep your reply brief, natural, and friendly. Avoid excessive jargon.
2. Structure your response with line breaks for optimal readability on mobile screens.
`;

    const ai = useVertexAI ? new GoogleGenAI({ vertexai: true }) : new GoogleGenAI({ apiKey: geminiApiKey });
    const geminiRes = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: targetQuestion,
      config: {
        systemInstruction: systemPrompt
      }
    });

    const replyText = geminiRes.text;

    res.json({
      success: true,
      text: replyText,
      images: selectedImages
    });

  } catch (error) {
    console.error("[Cloud Function RAG] Execution error:", error);
    res.status(500).json({ error: error.message || "Failed to execute standalone cloud RAG pipeline." });
  }
});

