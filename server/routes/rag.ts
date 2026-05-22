import { Router } from "express";
import { Pinecone } from '@pinecone-database/pinecone';

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

export default router;
