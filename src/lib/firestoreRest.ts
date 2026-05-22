import axios from "axios";
import fs from "fs";

let firebaseConfig: any;
try {
  firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
} catch (e: any) {
  console.error("Failed to load firebase-applet-config.json inside firestoreRest:", e.message);
}

// Convert JSON standard objects to Firestore REST Field Maps
export function toRestFields(obj: any): any {
  const fields: any = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined || val === null) {
      continue;
    }
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
        const d = new Date((val as any).seconds * 1000);
        fields[key] = { timestampValue: d.toISOString() };
      } else if ((val as any).constructor?.name === 'FieldValue' || String(val).includes('FieldValue')) {
        fields[key] = { timestampValue: new Date().toISOString() };
      } else {
        fields[key] = { mapValue: { fields: toRestFields(val) } };
      }
    }
  }
  return fields;
}

// Convert Firestore REST Field Maps to human JSON objects
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

// Write document (set with merge = true equivalent)
export async function setFirestoreDoc(path: string, data: any, idToken?: string) {
  const fields = toRestFields(data);
  let url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/${path}`;
  const headers: any = {};

  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  } else {
    url += `?key=${firebaseConfig.apiKey}`;
  }

  await axios.patch(url, { fields }, { headers });
}

// Read document
export async function getFirestoreDoc(path: string, idToken?: string) {
  let url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/${path}`;
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
    if (err.response?.status === 404) {
      return { exists: false, data: () => null };
    }
    throw err;
  }
}

// Update specific fields (non-destructive)
export async function updateFirestoreDoc(path: string, data: any, idToken?: string) {
  const fields = toRestFields(data);
  const fieldPaths = Object.keys(data).map(k => `updateMask.fieldPaths=${k}`).join('&');
  let url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/${path}?${fieldPaths}`;
  const headers: any = {};

  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  } else {
    url += `&key=${firebaseConfig.apiKey}`;
  }

  await axios.patch(url, { fields }, { headers });
}
