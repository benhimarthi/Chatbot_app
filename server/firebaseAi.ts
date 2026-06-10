import { initializeApp, getApp, getApps } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
import firebaseConfig from "../firebase-applet-config.json" assert { type: "json" };

/**
 * Shared utility to get a compiled GenerativeModel using firebase/ai SDK.
 */
export function getFirebaseAIModel(options: {
  modelName?: string;
  systemInstruction?: string;
  responseMimeType?: string;
} = {}) {
  const {
    modelName = "gemini-3.5-flash",
    systemInstruction,
    responseMimeType
  } = options;

  // Initialize client Firebase app if not already initialized
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  
  const ai = getAI(app, {
    backend: new GoogleAIBackend()
  });

  const modelParams: any = {
    model: modelName,
  };

  if (systemInstruction) {
    modelParams.systemInstruction = systemInstruction;
  }

  if (responseMimeType) {
    modelParams.generationConfig = {
      responseMimeType
    };
  }

  return getGenerativeModel(ai, modelParams);
}
