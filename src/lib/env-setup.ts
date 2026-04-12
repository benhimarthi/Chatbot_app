import { createRequire } from "module";
const require = createRequire(import.meta.url);
const firebaseConfig = require("../../firebase-applet-config.json");

process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
process.env.GCLOUD_PROJECT = firebaseConfig.projectId;
process.env.FIREBASE_PROJECT_ID = firebaseConfig.projectId;

console.log("Env setup complete. Project ID:", process.env.GOOGLE_CLOUD_PROJECT);
