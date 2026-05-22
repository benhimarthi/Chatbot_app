import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import axios from "axios";

export const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId
  });
}

export const authAdmin = admin.auth();
export let dbAdmin = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId);
export let activeDatabaseId = firebaseConfig.firestoreDatabaseId;

export function setActiveDatabaseId(id: string) {
  activeDatabaseId = id;
}

export function setDbAdmin(db: any) {
  dbAdmin = db;
}

export const diagnosticsLog: {
  logs: string[];
  customDbStatus: string;
  fallbackDbStatus: string;
  customError?: any;
  fallbackError?: any;
} = {
  logs: [],
  customDbStatus: "untested",
  fallbackDbStatus: "untested"
};

export const SYSTEM_BYPASS_KEY = "system_bypass_78c20b2f_5b27_4c3e_899c_18c0557592c3";

export interface PendingUpdate {
  workspaceId: string;
  type: 'setDoc';
  collection: 'workspaces' | 'messages' | 'conversations';
  id: string;
  parentPath?: string;
  data: any;
}

export const pendingUpdates: PendingUpdate[] = [];

export function toRestFields(obj: any): any {
  const fields: any = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined || val === null) continue;
    if (typeof val === 'string') {
      fields[key] = { stringValue: val };
    } else if (typeof val === 'boolean') {
      fields[key] = { booleanValue: val };
    } else if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        fields[key] = { integerValue: String(val) };
      } else {
        fields[key] = { doubleValue: val };
      }
    } else if (val instanceof Date) {
      fields[key] = { timestampValue: val.toISOString() };
    } else if (typeof val === 'object') {
      if ((val as any).seconds !== undefined) {
        fields[key] = { timestampValue: new Date((val as any).seconds * 1000).toISOString() };
      } else {
        fields[key] = { mapValue: { fields: toRestFields(val) } };
      }
    }
  }
  return fields;
}

export function fromRestFields(fields: any): any {
  if (!fields) return {};
  const obj: any = {};
  for (const [key, valueObj] of Object.entries(fields)) {
    const v = valueObj as any;
    if (v.stringValue !== undefined) {
      obj[key] = v.stringValue;
    } else if (v.booleanValue !== undefined) {
      obj[key] = v.booleanValue;
    } else if (v.integerValue !== undefined) {
      obj[key] = parseInt(v.integerValue, 10);
    } else if (v.doubleValue !== undefined) {
      obj[key] = parseFloat(v.doubleValue);
    } else if (v.timestampValue !== undefined) {
      obj[key] = new Date(v.timestampValue);
    } else if (v.mapValue !== undefined) {
      obj[key] = fromRestFields(v.mapValue.fields);
    }
  }
  return obj;
}

export async function restSetDoc(documentPath: string, data: any, idToken?: string) {
  const fields = toRestFields({
    ...data,
    systemKey: SYSTEM_BYPASS_KEY
  });
  let url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/${documentPath}`;
  const headers: any = {};
  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  } else {
    url += `?key=${firebaseConfig.apiKey}`;
  }
  await axios.patch(url, { fields }, { headers });
}

export async function restGetDoc(documentPath: string, idToken?: string) {
  let url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/${documentPath}`;
  const headers: any = {};
  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  } else {
    url += `?key=${firebaseConfig.apiKey}`;
  }
  try {
    const res = await axios.get(url, { headers });
    return {
      exists: true,
      data: () => fromRestFields(res.data.fields)
    };
  } catch (err: any) {
    if (err.response?.status === 3 || err.response?.status === 404) {
      return { exists: false, data: () => null };
    }
    throw err;
  }
}

export const appendWebhookLog = async (workspaceId: string, logEntry: any) => {
  try {
    const logsDocPath = `workspaces/${workspaceId}/whatsapp/logs_history`;
    let currentLogs: any[] = [];
    try {
      const snap = await restGetDoc(logsDocPath);
      if (snap.exists) {
        currentLogs = snap.data()?.logs || [];
      }
    } catch (e) {
      // Document might not exist yet
    }
    
    currentLogs.unshift(logEntry);
    if (currentLogs.length > 25) {
      currentLogs = currentLogs.slice(0, 25);
    }
    
    await restSetDoc(logsDocPath, {
      logs: currentLogs,
      updatedAt: new Date().toISOString()
    });

    pendingUpdates.push({
      workspaceId,
      type: 'setDoc',
      collection: 'workspaces',
      id: 'logs_history',
      parentPath: `workspaces/${workspaceId}/whatsapp`,
      data: {
        logs: currentLogs,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error("Failed to append webhook log:", err.message);
  }
};
