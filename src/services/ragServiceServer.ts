import { GoogleGenAI } from "@google/genai";
import firebaseConfig from "../../firebase-applet-config.json";
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { getFirebaseAIModel } from "../../server/firebaseAi.ts";

const getOrigin = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:3000';
};

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.log("[RAG Service Server] GEMINI_API_KEY environment variable is missing. Initializing fallback GoogleGenAI in Vertex AI mode (free version).");
      aiClient = new GoogleGenAI({
        vertexai: true,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build-vertex',
          }
        }
      });
    } else {
      console.log("[RAG Service Server] GEMINI_API_KEY is present. Initializing GoogleGenAI for standard Gemini Developer API.");
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return aiClient;
}

async function getVertexEmbeddingsForTexts(texts: string[], outputDim: number = 1024): Promise<number[][]> {
  const ai = getAIClient();
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-2',
    contents: texts,
    config: {
      outputDimensionality: outputDim
    }
  });

  if (!response.embeddings || response.embeddings.length === 0) {
    throw new Error("Failed to generate embeddings from Gemini API: " + JSON.stringify(response));
  }

  return response.embeddings.map((emb, idx) => {
    if (!emb.values) {
      throw new Error(`Embedding values undefined at index ${idx}`);
    }
    return emb.values;
  });
}

const DEFAULT_MODEL = "gemini-3.5-flash";

export interface FinancialRecord {
  id?: string;
  userId: string;
  amount: number;
  category: string;
  date: string;
  type: 'expense' | 'income';
  description: string;
  metadata?: any;
}

export interface ChunkMetadata {
  documentId: string;
  userId: string;
  chunkType: 'raw' | 'summary';
  section?: string;
  tags?: string[];
  source: string;
  dataType: 'document' | 'financial';
  timestamp: string;
  text: string;
  images?: { url: string; alt: string }[];
}

/**
 * Normalizes text by removing noise and fixing encoding.
 */
export const normalizeText = (text: string): string => {
  return text
    .replace(/[\r\n]+/g, '\n') // Normalize newlines
    .replace(/[ \t]+/g, ' ')   // Normalize spaces
    .trim();
};

/**
 * Detects structure like headings and sections.
 */
export const detectStructure = (text: string): { section: string; content: string }[] => {
  const lines = text.split('\n');
  const sections: { section: string; content: string }[] = [];
  let currentSection = 'General';
  let currentContent: string[] = [];

  const headingRegex = /^(#{1,6}\s+|[A-Z][A-Z\s]{2,}:?\s*$)/;

  for (const line of lines) {
    if (headingRegex.test(line)) {
      if (currentContent.length > 0) {
        sections.push({ section: currentSection, content: currentContent.join('\n').trim() });
      }
      currentSection = line.replace(/^#+\s+/, '').trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0 || sections.length === 0) {
    sections.push({ section: currentSection, content: currentContent.join('\n').trim() });
  }

  return sections;
};

/**
 * Semantic chunking based on structure and meaning.
 */
export const semanticChunking = (text: string, targetTokens: number = 300): string[] => {
  const sections = detectStructure(text);
  const chunks: string[] = [];

  for (const section of sections) {
    const content = section.content;
    if (content.length < targetTokens * 4) { // Rough estimate: 1 token ~ 4 chars
      chunks.push(`Section: ${section.section}\n\n${content}`);
    } else {
      // Fallback to sliding window for large sections
      const sectionChunks = slidingWindowChunking(content, targetTokens * 4, 0.15);
      sectionChunks.forEach(c => chunks.push(`Section: ${section.section}\n\n${c}`));
    }
  }

  return chunks;
};

/**
 * Sliding window chunking with overlap.
 */
export const slidingWindowChunking = (text: string, size: number, overlap: number): string[] => {
  const chunks: string[] = [];
  const step = Math.floor(size * (1 - overlap));
  
  for (let i = 0; i < text.length; i += step) {
    chunks.push(text.slice(i, i + size));
    if (i + size >= text.length) break;
  }
  
  return chunks;
};

/**
 * AI-Assisted chunking for complex documents.
 */
export const aiChunkText = async (text: string): Promise<string[]> => {
  try {
    const aiModel = getFirebaseAIModel({
      modelName: DEFAULT_MODEL,
      responseMimeType: "application/json"
    });
    const response = await aiModel.generateContent(`Split this content into coherent sections where each section represents a single idea. Return as a JSON array of strings.\n\nContent:\n${text.slice(0, 10000)}`);

    const responseText = response.response.text();
    return JSON.parse(responseText);
  } catch (e) {
    return semanticChunking(text);
  }
};

/**
 * Generates a summary for a chunk.
 */
export const summarizeChunk = async (text: string): Promise<string> => {
  try {
    const aiModel = getFirebaseAIModel({
      modelName: DEFAULT_MODEL
    });
    const response = await aiModel.generateContent(`Summarize this text in 1-2 sentences for high-level retrieval:\n\n${text}`);
    return response.response.text();
  } catch (e) {
    console.error("summarizeChunk failed", e);
    return "";
  }
};

/**
 * Generates tags/keywords for a chunk.
 */
export const generateTags = async (text: string): Promise<string[]> => {
  try {
    const aiModel = getFirebaseAIModel({
      modelName: DEFAULT_MODEL,
      responseMimeType: "application/json"
    });
    const response = await aiModel.generateContent(`Extract 3-5 key terms or tags from this text. Return as a JSON array of strings.\n\nText:\n${text}`);
    const responseText = response.response.text();
    return JSON.parse(responseText);
  } catch (e) {
    return [];
  }
};

/**
 * Chunks long text into smaller semantic pieces.
 * Optimized for financial data context.
 */
export const chunkText = (text: string, chunkSize: number = 500): string[] => {
  return semanticChunking(text, chunkSize / 4);
};

/**
 * Generates embeddings for a list of strings.
 */
export const generateEmbeddings = async (chunks: string[]) => {
  return await getVertexEmbeddingsForTexts(chunks, 1024);
};

/**
 * Upserts financial records into Pinecone.
 */
export const upsertFinancialDataToPinecone = async (userId: string, records: FinancialRecord[]) => {
  const processedRecords = await Promise.all(records.map(async (record) => {
    const rawText = `Type: ${record.type}, Amount: ${record.amount}, Category: ${record.category}, Date: ${record.date}, Description: ${record.description}`;
    const text = normalizeText(rawText);
    const embeddings = await getVertexEmbeddingsForTexts([text], 1024);
    const vector = embeddings[0];

    const tags = await generateTags(text);

    return {
      id: record.id || uuidv4(),
      values: vector,
      metadata: {
        userId,
        text,
        amount: record.amount,
        category: record.category,
        date: record.date,
        type: record.type,
        description: record.description,
        dataType: 'financial',
        tags,
        timestamp: new Date().toISOString()
      }
    };
  }));

  if (records.length === 0) {
    console.warn('No financial records to upsert to Pinecone');
    return;
  }
  await axios.post(`${getOrigin()}/api/rag/upsert`, { records: processedRecords });
};

/**
 * Upserts generic document data into Pinecone via backend API.
 * Implements multi-representation storage (raw + summary + tags).
 */
export const upsertDocumentToPinecone = async (
  userId: string, 
  rawText: string, 
  source: string, 
  documentId: string = uuidv4(),
  contentItems?: any[]
) => {
  const text = normalizeText(rawText);
  
  let chunks: { text: string; images?: { url: string; alt: string }[] }[] = [];

  if (contentItems && contentItems.length > 0) {
    // Advanced chunking with image association
    let currentText = "";
    let currentImages: { url: string; alt: string }[] = [];
    const targetSize = 1200; // chars

    for (const item of contentItems) {
      if (item.type === 'text') {
        currentText += item.text + "\n\n";
        if (currentText.length >= targetSize) {
          chunks.push({ text: currentText.trim(), images: [...currentImages] });
          currentText = "";
          // Keep images for the next chunk if they were just before this split? 
          // Actually, let's clear them but maybe keep some "context"?
          // Rules say associate with "nearby" text.
          currentImages = [];
        }
      } else if (item.type === 'image') {
        currentImages.push({ url: item.url, alt: item.alt });
        // Also limit images per chunk to keep metadata small
        if (currentImages.length > 5) currentImages.shift();
      }
    }
    if (currentText.trim()) {
      chunks.push({ text: currentText.trim(), images: currentImages });
    }
  } else {
    // Standard text-only chunking
    const textChunks = text.length > 2000 ? await aiChunkText(text) : semanticChunking(text);
    chunks = textChunks.map(t => ({ text: t }));
  }
  
  if (chunks.length === 0) {
    console.warn('No chunks generated for document:', source);
    return;
  }

  const records: any[] = [];

  for (const chunkObj of chunks) {
    const chunk = chunkObj.text;
    const images = chunkObj.images;

    // 1. Base Chunk (Raw)
    const baseEmbedding = await generateEmbeddings([chunk]);
    const tags = await generateTags(chunk);
    
    records.push({
      id: uuidv4(),
      values: baseEmbedding[0],
      metadata: {
        documentId,
        userId,
        chunkType: 'raw',
        text: chunk,
        source: source.startsWith('http') ? 'website' : source,
        url: source.startsWith('http') ? source : undefined,
        images: images ? JSON.stringify(images) : undefined,
        tags,
        dataType: 'document',
        timestamp: new Date().toISOString()
      }
    });

    // 2. Summary Chunk (High-level)
    const summary = await summarizeChunk(chunk);
    const summaryEmbedding = await generateEmbeddings([summary]);
    
    records.push({
      id: uuidv4(),
      values: summaryEmbedding[0],
      metadata: {
        documentId,
        userId,
        chunkType: 'summary',
        text: summary,
        source: source.startsWith('http') ? 'website' : source,
        url: source.startsWith('http') ? source : undefined,
        images: images ? JSON.stringify(images) : undefined,
        tags,
        dataType: 'document',
        timestamp: new Date().toISOString()
      }
    });
  }

  if (records.length === 0) {
    console.warn('No records generated for document:', source);
    return;
  }

  await axios.post(`${getOrigin()}/api/rag/upsert`, { records });
};

/**
 * Deletes document vectors from Pinecone based on documentId and userId.
 */
export const deleteDocumentFromPinecone = async (userId: string, documentId: string) => {
  try {
    await axios.post(`${getOrigin()}/api/rag/delete`, {
      filter: { 
        documentId: { "$eq": documentId },
        userId: { "$eq": userId }
      }
    });
  } catch (error) {
    console.error('Error deleting from Pinecone:', error);
    throw error;
  }
};

/**
 * Queries Pinecone for relevant context via backend API.
 */
export const queryPinecone = async (userId: string, queryText: string, topK: number = 5) => {
  const embeddings = await getVertexEmbeddingsForTexts([queryText], 1024);
  const vector = embeddings[0];

  const response = await axios.post(`${getOrigin()}/api/rag/query`, {
    vector,
    topK,
    filter: { userId: { "$eq": userId } }
  });

  const queryResponse = response.data;
  return queryResponse.matches.map((match: any) => {
    let images = undefined;
    if (match.metadata?.images) {
      try {
        images = JSON.parse(match.metadata.images);
      } catch (e) {
        console.error("Failed to parse images metadata", e);
      }
    }
    return {
      text: match.metadata?.text as string,
      images,
      pageUrl: match.metadata?.url as string | undefined
    };
  });
};

/**
 * Uses AI to prioritize links discovered on a website homepage.
 * Optimized for building a knowledge base from business sites.
 */
export const prioritizeUrlLinks = async (title: string, candidates: { url: string; text: string }[]): Promise<string[]> => {
  if (candidates.length === 0) return [];

  // If few links, just return them all
  if (candidates.length <= 10) {
    return candidates.map(c => c.url);
  }

  const prompt = `
    You are a web crawling assistant. Analyze these links from the website "${title}".
    Rank them by how likely they are to contain core business information, services, products, FAQs, or important details for a Knowledge Base.
    Focus on high-value pages. Ignore noise like login, terms, account management, etc.
    
    Links:
    ${candidates.map((l, i) => `[ID: ${i}] ${l.text} (${l.url})`).join('\n')}
    
    Return a JSON array of up to 12 Link IDs that are most important, ordered by priority.
  `;

  try {
    const aiModel = getFirebaseAIModel({
      modelName: DEFAULT_MODEL,
      responseMimeType: "application/json"
    });
    const response = await aiModel.generateContent(prompt);

    const text = response.response.text();
    const topIndices = JSON.parse(text);
    return topIndices
      .map((id: number) => candidates[id]?.url)
      .filter((url: string | undefined) => !!url);
  } catch (e) {
    console.warn("AI Link Prioritization failed, falling back to keywords/length:", e);
    // Simple heuristic fallback
    const includePatterns = [/services/i, /menu/i, /product/i, /pricing/i, /about/i, /faq/i, /rooms/i, /project/i];
    return candidates
      .filter(l => includePatterns.some(p => p.test(l.url) || p.test(l.text)))
      .map(l => l.url)
      .slice(0, 10);
  }
};

/**
 * Full RAG Pipeline: Query -> Context -> Answer
 * General-purpose with adaptive persona.
 */
export const generateRagResponse = async (userId: string, userQuestion: string) => {
  const contextChunks = await queryPinecone(userId, userQuestion);
  const context = contextChunks.map(c => c.text).join("\n\n---\n\n");
  
  // Scoring Logic for Images
  const computeKeywordOverlap = (text1: string, text2: string) => {
    const words1 = new Set(text1.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    const words2 = new Set(text2.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    let intersection = 0;
    words1.forEach(w => { if (words2.has(w)) intersection++; });
    return intersection;
  };

  const getPagePriority = (url?: string) => {
    if (!url) return 1.0;
    const lowUrl = url.toLowerCase();
    if (lowUrl.includes('services') || lowUrl.includes('menu') || lowUrl.includes('product') || lowUrl.includes('pricing')) return 2.0;
    if (lowUrl.includes('contact') || lowUrl.includes('about') || lowUrl.includes('faq')) return 1.5;
    return 1.0;
  };

  interface ScoredImage {
    url: string;
    alt: string;
    score: number;
  }

  const imageCandidates: ScoredImage[] = [];
  const seenUrls = new Set<string>();

  contextChunks.forEach(chunk => {
    if (chunk.images) {
      // @ts-ignore - pageUrl added in queryPinecone
      const pageUrl = (chunk as any).pageUrl;
      const textScore = computeKeywordOverlap(userQuestion, chunk.text);
      const pageWeight = getPagePriority(pageUrl);

      chunk.images.forEach(img => {
        if (seenUrls.has(img.url)) return;
        seenUrls.add(img.url);

        // Filter out very small/placeholder images by URL patterns
        if (img.url.includes('pixel') || img.url.includes('spacer') || img.url.includes('logo')) return;

        const altScore = computeKeywordOverlap(userQuestion, img.alt);
        
        // Final score calculation
        // Priority: Alt text match (high weight) > Text chunk match > Page priority
        const finalScore = (altScore * 2.5) + (textScore * 1.0) * pageWeight;
        
        imageCandidates.push({
          url: img.url,
          alt: img.alt,
          score: finalScore
        });
      });
    }
  });

  // Sort by score descending and take top 3
  const selectedImages = imageCandidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ url, alt }) => ({ url, alt }));

  const systemInstruction = `
    You are a highly intelligent AI assistant with access to the user's personal documents and financial data.
    Your goal is to answer the user's questions based ONLY on the provided context.
    
    Context:
    ${context}
    
    Strict Rules:
    1. Use ONLY the provided context. Do NOT use general knowledge or invent data.
    2. If the answer is not in the context, state that you don't have enough information.
    3. Be analytical, structured, and clear.
    4. If the data is financial, provide insights like spending trends and category breakdowns.
    5. Use bullet points for clarity.
    6. Maintain absolute privacy and professional tone.
    7. If the context contains summaries, use them for high-level overview but prioritize raw chunks for specific details.
  `;

  try {
    const aiModel = getFirebaseAIModel({
      modelName: DEFAULT_MODEL,
      systemInstruction: systemInstruction
    });
    const response = await aiModel.generateContent(userQuestion);

    const replyText = response.response.text();

    return {
      text: replyText,
      images: selectedImages
    };
  } catch (error) {
    console.error("generateRagResponse failed:", error);
    throw error;
  }
};
