import { Router } from "express";
import { Pinecone } from '@pinecone-database/pinecone';
import { 
  upsertDocumentToPinecone, 
  deleteDocumentFromPinecone, 
  prioritizeUrlLinks,
  generateRagResponse
} from "../../src/services/ragServiceServer";

const router = Router();

const pinecone = process.env.PINECONE_API_KEY ? new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
}) : null;

const getPineconeIndex = () => {
  if (!pinecone || !process.env.PINECONE_INDEX) return null;
  return pinecone.index(process.env.PINECONE_INDEX);
};

// API: Pinecone Upsert
router.post("/api/rag/upsert", async (req, res) => {
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.json({ success: true, message: "No records to upsert" });
    }
    
    const index = getPineconeIndex();
    if (!index) return res.status(500).json({ error: "Pinecone not configured" });
    
    await index.upsert({ records });
    res.json({ success: true });
  } catch (error) {
    console.error("Pinecone Upsert Error:", error);
    res.status(500).json({ error: "Failed to upsert to Pinecone" });
  }
});

// API: Pinecone Query
router.post("/api/rag/query", async (req, res) => {
  try {
    const { vector, topK, filter } = req.body;
    const index = getPineconeIndex();
    if (!index) return res.status(500).json({ error: "Pinecone not configured" });
    
    const queryResponse = await index.query({
      vector,
      topK,
      filter,
      includeMetadata: true
    });
    
    res.json(queryResponse);
  } catch (error) {
    console.error("Pinecone Query Error:", error);
    res.status(500).json({ error: "Failed to query Pinecone" });
  }
});

// API: Pinecone Delete
router.post("/api/rag/delete", async (req, res) => {
  try {
    const { filter } = req.body;
    const index = getPineconeIndex();
    if (!index) return res.status(500).json({ error: "Pinecone not configured" });
    
    await index.deleteMany({ filter });
    res.json({ success: true });
  } catch (error) {
    console.error("Pinecone Delete Error:", error);
    res.status(500).json({ error: "Failed to delete from Pinecone" });
  }
});

// Secure API: Document Upsert to Pinecone
router.post("/api/rag/upsert-document", async (req, res) => {
  try {
    const { userId, content, name, docId, contentItems } = req.body;
    if (!userId || !content || !name) {
      return res.status(400).json({ error: "userId, content, and name are required" });
    }
    await upsertDocumentToPinecone(userId, content, name, docId, contentItems);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Secure Document Upsert Error:", error);
    res.status(500).json({ error: error.message || "Failed to upsert document to Pinecone" });
  }
});

// Secure API: Document Delete from Pinecone
router.post("/api/rag/delete-document", async (req, res) => {
  try {
    const { userId, docId } = req.body;
    if (!userId || !docId) {
      return res.status(400).json({ error: "userId and docId are required" });
    }
    await deleteDocumentFromPinecone(userId, docId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Secure Document Delete Error:", error);
    res.status(500).json({ error: error.message || "Failed to delete document from Pinecone" });
  }
});

// Secure API: Prioritize Links using AI
router.post("/api/rag/prioritize-links", async (req, res) => {
  try {
    const { homepageTitle, candidates } = req.body;
    if (!homepageTitle || !candidates) {
      return res.status(400).json({ error: "homepageTitle and candidates are required" });
    }
    const topUrls = await prioritizeUrlLinks(homepageTitle, candidates);
    res.json({ topUrls });
  } catch (error: any) {
    console.error("Secure Prioritize Links Error:", error);
    res.status(500).json({ error: error.message || "Failed to prioritize links" });
  }
});

// Secure API: Run Complete RAG Pipeline on-demand from External Cloud Functions (e.g. Firebase, custom microservices)
router.post("/api/rag/generate-response", async (req, res) => {
  try {
    const { workspaceId, userId, messageText, question, apiKey } = req.body;
    
    // Support multiple field names to maximize developer ease-of-use
    const targetWorkspaceId = workspaceId || userId;
    const targetQuestion = messageText || question;

    if (!targetWorkspaceId || !targetQuestion) {
      return res.status(400).json({ 
        error: "Missing required params: workspaceId (or userId) and messageText (or question) are required." 
      });
    }

    // Optional Security verification if RAG_API_KEY is placed in your environment variables (.env)
    const localRagKey = process.env.RAG_API_KEY;
    const requestApiKey = apiKey || req.headers["x-api-key"] || (req.headers["authorization"] ? req.headers["authorization"].toString().replace("Bearer ", "") : null);
    
    if (localRagKey && requestApiKey !== localRagKey) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing RAG_API_KEY authentication." });
    }

    console.log(`[RAG Public Endpoint] Received external request for workspaceId: "${targetWorkspaceId}". Question: "${targetQuestion}"`);

    // Execute the complete background server RAG pipeline
    const result = await generateRagResponse(targetWorkspaceId, targetQuestion);

    res.json({
      success: true,
      text: result.text,
      images: result.images || []
    });
  } catch (error: any) {
    console.error("[RAG Public Endpoint] Error executing RAG pipeline:", error);
    res.status(500).json({ 
      error: error.message || "Failed to execute complete RAG pipeline." 
    });
  }
});

export default router;
