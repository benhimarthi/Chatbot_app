import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenAI } from "@google/genai";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";
import { v4 as uuidv4 } from 'uuid';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let pdfParseFunc: any;
try {
  const imported = require('pdf-parse');
  // Handle various export patterns
  if (typeof imported === 'function') {
    pdfParseFunc = imported;
  } else if (imported && typeof imported.default === 'function') {
    pdfParseFunc = imported.default;
  } else if (imported && typeof imported.pdf === 'function') {
    pdfParseFunc = imported.pdf;
  } else if (typeof imported === 'object') {
    // Some versions might export it as a property with the same name or similar
    const possibleFunc = Object.values(imported).find(v => typeof v === 'function');
    if (possibleFunc) {
      pdfParseFunc = possibleFunc;
    }
  }
} catch (e) {
  console.error('[Server] Failed to require pdf-parse:', e);
}

// Final fallback/check
if (typeof pdfParseFunc !== 'function') {
  console.error('[Server] pdf-parse import failed to resolve to a function. Final Type:', typeof pdfParseFunc);
}

/**
 * STEP 1 — Extract text from PDF
 */
async function extractPdfText(input: string | Buffer, pdfParse: any) {
  const buffer = Buffer.isBuffer(input) ? input : fs.readFileSync(input);

  if (!buffer || buffer.length === 0) {
    throw new Error("Invalid PDF buffer");
  }

  if (typeof pdfParse !== 'function') {
    console.error('[Server] pdfParse is not a function. Type:', typeof pdfParse);
    throw new Error(`PDF parser is not a function (Type: ${typeof pdfParse}). This is likely an import issue.`);
  }

  const data = await pdfParse(buffer);

  if (!data.text) {
    throw new Error("No text extracted from PDF");
  }

  return data.text;
}

/**
 * STEP 2 — Clean text
 */
function cleanText(rawText: string) {
  return rawText
    .replace(/\s+/g, " ")     // remove excessive whitespace
    .replace(/[^\x20-\x7E\n]/g, "") // remove weird characters
    .trim();
}

/**
 * STEP 3 — Semantic-friendly chunking
 */
function chunkText(text: string, options: any = {}) {
  const {
    chunkSize = 300,   // approx tokens (safe range)
    overlap = 50       // overlap for context
  } = options;

  if (!text || text.length < 50) {
    throw new Error("Text too short to chunk");
  }

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = start + chunkSize;

    let chunk = text.slice(start, end);

    // Try to end on sentence boundary (better quality)
    const lastPeriod = chunk.lastIndexOf(".");
    if (lastPeriod > chunkSize * 0.5) {
      chunk = chunk.slice(0, lastPeriod + 1);
    }

    chunks.push(chunk.trim());

    start += chunkSize - overlap;
  }

  return chunks.filter(c => c.length > 0);
}

/**
 * STEP 4 — Full pipeline
 */
async function processPdf(input: string | Buffer, pdfParse: any) {
  console.log("📄 Processing PDF...");

  // Extract
  const rawText = await extractPdfText(input, pdfParse);
  console.log("Raw length:", rawText.length);

  // Clean
  const cleaned = cleanText(rawText);
  console.log("Cleaned length:", cleaned.length);

  if (cleaned.length < 200) {
    throw new Error("PDF content too small after cleaning");
  }

  // Chunk
  const chunks = chunkText(cleaned);
  console.log("Chunks created:", chunks.length);

  if (chunks.length === 0) {
    throw new Error("No chunks generated");
  }

  return chunks.map((chunk, index) => ({
    id: `chunk_${index}`,
    text: chunk
  }));
}

// Multer setup
const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Deferred Initializations
  let firebaseApp: App | null = null;
  let firestoreDatabaseId: string | undefined = undefined;
  let pinecone: Pinecone | null = null;
  let genAI: GoogleGenAI | null = null;

  const initServices = async () => {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    let config: any = null;
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        firestoreDatabaseId = config.firestoreDatabaseId;
      } catch (e) {
        console.error("Config Parse Error:", e);
      }
    }

    if (!firebaseApp) {
      if (config) {
        try {
          const apps = getApps();
          if (apps.length === 0) {
            console.log(`[Server] Initializing Firebase Admin for project: ${config.projectId}`);
            firebaseApp = initializeApp({
              projectId: config.projectId,
            });
          } else {
            console.log(`[Server] Using existing Firebase Admin app for project: ${apps[0].options.projectId}`);
            firebaseApp = apps[0];
          }

          console.log(`[Server] Firebase Project: ${config.projectId}`);
          console.log(`[Server] Firestore Database ID: ${firestoreDatabaseId || '(default)'}`);
          console.log(`[Server] Pinecone Index: ${process.env.PINECONE_INDEX || 'NOT SET'}`);
          console.log(`[Server] Pinecone API Key: ${process.env.PINECONE_API_KEY ? 'SET' : 'NOT SET'}`);
          console.log(`[Server] Gemini API Key: ${process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET'}`);

          // Connection Test
          let db = getFirestore(firebaseApp, firestoreDatabaseId);
          try {
            console.log(`[Server] Testing Firestore connection (DB: ${firestoreDatabaseId || 'default'})...`);
            await db.collection('_connection_test').doc('ping').set({ 
              timestamp: FieldValue.serverTimestamp(),
              message: 'Server connection test'
            });
            console.log(`[Server] Firestore connection successful.`);
          } catch (error: any) {
            console.error(`[Server] Firestore connection test failed for DB ${firestoreDatabaseId}:`, error.message);
            
            if (firestoreDatabaseId && (error.message.includes('PERMISSION_DENIED') || error.message.includes('NOT_FOUND'))) {
              console.log(`[Server] Attempting fallback to (default) database...`);
              try {
                const defaultDb = getFirestore(firebaseApp);
                await defaultDb.collection('_connection_test').doc('ping').set({ 
                  timestamp: FieldValue.serverTimestamp(),
                  message: 'Fallback connection test'
                });
                console.log(`[Server] Fallback to (default) database successful.`);
                firestoreDatabaseId = undefined; // Use default from now on
              } catch (fallbackError: any) {
                console.error(`[Server] Fallback to (default) database also failed:`, fallbackError.message);
              }
            }
          }
        } catch (e) {
          console.error("Firebase Admin Init Error:", e);
        }
      }
    }

    if (!pinecone && process.env.PINECONE_API_KEY) {
      pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
      });
    }

    if (!genAI && process.env.GEMINI_API_KEY) {
      genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
  };

  // Middleware to verify Firebase ID Token
  const verifyToken = async (req: any, res: any, next: any) => {
    await initServices();
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }
    const token = authHeader.split(" ")[1];
    try {
      if (!firebaseApp) throw new Error("Firebase Admin not initialized");
      const decodedToken = await getAuth(firebaseApp).verifyIdToken(token);
      req.user = decodedToken;
      next();
    } catch (error: any) {
      console.error("Token Verification Error:", error.message);
      res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
  };

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/process/pdf", verifyToken, upload.single("file"), async (req: any, res: any) => {
    let docRef: any = null;
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      
      await initServices();
      
      if (!pdfParseFunc) throw new Error("PDF parser not available. Please check server logs for import errors.");
      if (!pinecone) throw new Error("Pinecone not initialized. Check if PINECONE_API_KEY is set in Secrets.");
      if (!genAI) throw new Error("Gemini AI not initialized. Check if GEMINI_API_KEY is set in Secrets.");
      if (!firebaseApp) throw new Error("Firebase Admin not initialized. Check firebase-applet-config.json.");
      if (!process.env.PINECONE_INDEX) throw new Error("PINECONE_INDEX environment variable is missing.");

      const userId = req.user.uid;
      const fileName = req.file.originalname;

      console.log(`[Server] Starting processing for ${fileName} (User: ${userId})`);

      // 1. Create document in Firestore
      const db = getFirestore(firebaseApp, firestoreDatabaseId);
      docRef = db.collection("users")
        .doc(userId)
        .collection("documents")
        .doc();
      
      console.log(`[Server] Creating Firestore record: ${docRef.id} in DB: ${firestoreDatabaseId || 'default'}`);
      await docRef.set({
        title: fileName,
        status: 'processing',
        fileType: 'PDF',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        userId: userId
      });

      console.log(`[Server] Extracting text from PDF...`);
      const chunksData = await processPdf(req.file.buffer, pdfParseFunc);
      console.log(`[Server] Extracted ${chunksData.length} chunks.`);
      
      const index = pinecone.index(process.env.PINECONE_INDEX!);
      
      console.log(`[Server] Generating embeddings and preparing Pinecone records...`);
      const processedChunks = await Promise.all(chunksData.map(async (chunkObj: any, i: number) => {
        try {
          const embeddingResponse = await genAI!.models.embedContent({
            model: "gemini-embedding-2-preview",
            contents: [{ parts: [{ text: chunkObj.text }] }],
            config: { outputDimensionality: 1024 }
          });

          return {
            id: uuidv4(),
            values: embeddingResponse.embeddings[0].values,
            metadata: {
              userId: userId,
              docId: docRef.id,
              text: chunkObj.text,
              documentTitle: fileName,
              timestamp: new Date().toISOString(),
              dataType: 'document'
            }
          };
        } catch (embedError: any) {
          console.error(`[Server] Embedding error for chunk ${i}:`, embedError.message);
          throw new Error(`Embedding failed: ${embedError.message}`);
        }
      }));

      console.log(`[Server] Upserting ${processedChunks.length} records to Pinecone index: ${process.env.PINECONE_INDEX}...`);
      await index.upsert({ records: processedChunks });
      
      // 2. Update document status in Firestore
      console.log(`[Server] Updating Firestore record to 'processed'...`);
      await docRef.update({
        status: 'processed',
        chunkCount: chunksData.length,
        updatedAt: FieldValue.serverTimestamp()
      });

      console.log(`[Server] Processing complete for ${docRef.id}`);

      res.json({ 
        success: true, 
        docId: docRef.id, 
        chunks: chunksData,
        message: "Document processed and saved to Firebase and Pinecone."
      });
    } catch (error: any) {
      console.error("PDF Processing Error:", error);
      if (docRef) {
        try {
          await docRef.update({
            status: 'error',
            error: error.message,
            updatedAt: FieldValue.serverTimestamp()
          });
        } catch (e) {
          console.error("Failed to update error status in Firestore:", e);
        }
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/rag/upsert", async (req, res) => {
    try {
      await initServices();
      const { records } = req.body;
      if (!pinecone) throw new Error("Pinecone not initialized");
      const index = pinecone.index(process.env.PINECONE_INDEX!);
      await index.upsert({ records });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/rag/query", async (req, res) => {
    try {
      await initServices();
      const { vector, topK, filter } = req.body;
      if (!pinecone) throw new Error("Pinecone not initialized");
      const index = pinecone.index(process.env.PINECONE_INDEX!);
      const queryResponse = await index.query({
        vector,
        topK,
        filter,
        includeMetadata: true
      });
      res.json(queryResponse);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("[Server] Initializing Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("CRITICAL: Failed to start server:", err);
});
