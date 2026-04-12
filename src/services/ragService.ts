import { GoogleGenAI, Type } from "@google/genai";
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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
 * Generates tags/keywords for a chunk.
 */
export const generateTags = async (text: string): Promise<string[]> => {
  const response = await genAI.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: 'user', parts: [{ text: `Extract 3-5 key terms or tags from this text. Return as a JSON array of strings.\n\nText:\n${text}` }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  try {
    return JSON.parse(response.text);
  } catch (e) {
    return [];
  }
};

/**
 * Upserts a general document into Pinecone.
 */
export const upsertDocumentToPinecone = async (userId: string, content: string, documentTitle: string) => {
  const text = normalizeText(content);
  
  // Chunking (simple implementation)
  const chunkSize = 2000;
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.substring(i, i + chunkSize));
  }

  const processedChunks = await Promise.all(chunks.map(async (chunk, index) => {
    const embeddingResponse = await genAI.models.embedContent({
      model: "gemini-embedding-2-preview",
      contents: [{ parts: [{ text: chunk }] }],
      config: { outputDimensionality: 1024 }
    });

    return {
      id: uuidv4(),
      values: embeddingResponse.embeddings[0].values,
      metadata: {
        userId,
        text: chunk,
        documentTitle,
        chunkIndex: index,
        dataType: 'document',
        timestamp: new Date().toISOString()
      }
    };
  }));

  const validProcessedChunks = processedChunks.filter(c => c && c.values && c.values.length > 0);

  if (validProcessedChunks.length === 0) {
    console.warn('No valid chunks to upsert to Pinecone');
    return;
  }
  
  console.log(`[RAG] Upserting ${validProcessedChunks.length} chunks for document "${documentTitle}" to Pinecone.`);
  await axios.post('/api/rag/upsert', { records: validProcessedChunks });
};

/**
 * Upserts financial records into Pinecone.
 */
export const upsertFinancialDataToPinecone = async (userId: string, records: FinancialRecord[]) => {
  const processedRecords = await Promise.all(records.map(async (record) => {
    const rawText = `Type: ${record.type}, Amount: ${record.amount}, Category: ${record.category}, Date: ${record.date}, Description: ${record.description}`;
    const text = normalizeText(rawText);
    const embeddingResponse = await genAI.models.embedContent({
      model: "gemini-embedding-2-preview",
      contents: [{ parts: [{ text }] }],
      config: { outputDimensionality: 1024 }
    });

    const tags = await generateTags(text);

    return {
      id: record.id || uuidv4(),
      values: embeddingResponse.embeddings[0].values,
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

  const validProcessedRecords = processedRecords.filter(r => r && r.values && r.values.length > 0);

  if (validProcessedRecords.length === 0) {
    console.warn('No valid financial records to upsert to Pinecone');
    return;
  }
  
  console.log(`[RAG] Upserting ${validProcessedRecords.length} financial records to Pinecone.`);
  await axios.post('/api/rag/upsert', { records: validProcessedRecords });
};

/**
 * Queries Pinecone for relevant context.
 */
export const queryPinecone = async (userId: string, queryText: string, filter?: any) => {
  const embeddingResponse = await genAI.models.embedContent({
    model: "gemini-embedding-2-preview",
    contents: [{ parts: [{ text: queryText }] }],
    config: { outputDimensionality: 1024 }
  });

  const response = await axios.post('/api/rag/query', {
    vector: embeddingResponse.embeddings[0].values,
    topK: 5,
    filter: {
      userId,
      ...filter
    }
  });

  return response.data.matches || [];
};

/**
 * Generates a RAG-enhanced response.
 */
export const generateRagResponse = async (
  userId: string, 
  userMessage: string, 
  chatHistory: any[]
) => {
  const matches = await queryPinecone(userId, userMessage);
  const context = matches
    .map((m: any) => `[Source: ${m.metadata.documentTitle}]\n${m.metadata.text}`)
    .join('\n\n---\n\n');

  const prompt = `
    You are a helpful AI assistant. Use the provided context to answer the user's question.
    If the answer is not in the context, use your general knowledge but mention that it's not in the provided documents.
    
    CONTEXT:
    ${context || 'No relevant context found in the knowledge base.'}
    
    USER QUESTION:
    ${userMessage}
  `;

  const response = await genAI.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      ...chatHistory.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      })),
      { role: 'user', parts: [{ text: prompt }] }
    ]
  });

  return response.text;
};
