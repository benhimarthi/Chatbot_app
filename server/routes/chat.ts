import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { generateRagResponse } from "../../src/services/ragService.ts";
import { detectBookingIntent, extractReservationDetails } from "../../src/services/reservationService.ts";

const router = Router();

// API: Chatbot Endpoint
router.post("/api/chat", async (req, res) => {
  try {
    const { apiKey, message, useRag, documents, customInstructions, sessionId } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: "API Key (appId) is required" });
    }
    
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    let aiResponseText = "";
    let aiImages: any[] = [];

    if (useRag !== false) {
      // Default RAG
      const response = await generateRagResponse(apiKey, message);
      aiResponseText = response.text;
      aiImages = response.images || [];
    } else {
      // Custom contexts (frontend docs)
      const docsList = documents || [];
      const context = docsList
        .filter((doc: any) => doc.status === 'Processed')
        .map((doc: any) => `Source: ${doc.name}\nContent: ${doc.content || ''}`)
        .join('\n\n---\n\n');

      const systemInstruction = `
        You are a helpful AI assistant.
        ${customInstructions || ''}
        Use the following context to answer their questions.
        Context:
        ${context}
      `;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      const result = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ role: 'user', parts: [{ text: message }] }],
        config: { systemInstruction },
      });
      aiResponseText = result.text || "";
    }

    res.json({
      text: aiResponseText,
      images: aiImages,
      sessionId: sessionId || `session_${Math.random().toString(36).substr(2, 9)}`
    });
  } catch (error) {
    console.error("Chat Error:", error);
    res.status(500).json({ error: "Failed to process chat message" });
  }
});

// API: Detect Booking Intent proxy
router.post("/api/reservation/detect-intent", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    const isBooking = await detectBookingIntent(message);
    res.json({ isBooking });
  } catch (error) {
    console.error("Detect Booking Intent Error:", error);
    res.status(500).json({ error: "Failed to detect booking intent" });
  }
});

// API: Extract Reservation Details proxy
router.post("/api/reservation/extract-details", async (req, res) => {
  try {
    const { message, currentDraft } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    const extracted = await extractReservationDetails(message, currentDraft || {});
    res.json(extracted);
  } catch (error) {
    console.error("Extract Reservation Details Error:", error);
    res.status(500).json({ error: "Failed to extract reservation details" });
  }
});

export default router;
