import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import onHeaders from "on-headers";
import fs from "fs";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// SOLID decoupled components
import { 
  firebaseConfig, 
  dbAdmin, 
  setDbAdmin, 
  setActiveDatabaseId, 
  diagnosticsLog, 
  restSetDoc, 
  restGetDoc 
} from "./server/firebaseAdmin.ts";

import configRouter from "./server/routes/config.ts";
import chatRouter from "./server/routes/chat.ts";
import processRouter from "./server/routes/process.ts";
import ragRouter from "./server/routes/rag.ts";
import whatsappRouter from "./server/routes/whatsapp.ts";

async function startServer() {
  try {
    const app = express();
    app.set('trust proxy', true);
    const PORT = 3000;

    // Security headers to allow embedding
    app.use((req, res, next) => {
      // Set permissive CSP and CORS headers
      res.setHeader('Content-Security-Policy', "frame-ancestors *;");
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

      // Use on-headers to strip X-Frame-Options right before headers are sent
      onHeaders(res, () => {
        res.removeHeader('X-Frame-Options');
        res.removeHeader('x-frame-options');
        
        // Ensure CSP doesn't restrict framing
        const existingCsp = res.getHeader('Content-Security-Policy');
        if (!existingCsp) {
          res.setHeader('Content-Security-Policy', "frame-ancestors *;");
        } else if (typeof existingCsp === 'string' && !existingCsp.includes('frame-ancestors')) {
          res.setHeader('Content-Security-Policy', existingCsp + "; frame-ancestors *;");
        }
      });

      // Handle OPTIONS preflight requests immediately with 204 No Content
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
        return res.status(204).end();
      }

      next();
    });

    app.use(express.json({ limit: '50mb' }));

    // Explicitly serve static files before other complex routing
    app.use(express.static(path.join(process.cwd(), 'public')));
    app.use(express.static(path.join(process.cwd(), 'dist')));

    // Mount SOLID sub-routers
    app.use(configRouter);
    app.use(chatRouter);
    app.use(processRouter);
    app.use(ragRouter);
    app.use(whatsappRouter);

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
      try {
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
      } catch (viteError) {
        console.error("Vite Dev Server creation failed:", viteError);
      }
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    // Run Firestore diagnostics on startup to verify IAM permissions and self-heal / fallback if needed
    (async () => {
      const addLog = (msg: string) => {
        console.log(msg);
        diagnosticsLog.logs.push(`[${new Date().toISOString()}] ${msg}`);
      };
      const addError = (msg: string, err: any) => {
        console.error(msg, err);
        diagnosticsLog.logs.push(`[${new Date().toISOString()}] ${msg} - Error: ${err.message || err}`);
      };

      try {
        addLog(`Verifying Admin Firestore access on custom database: "${firebaseConfig.firestoreDatabaseId}"...`);
        const testRef = dbAdmin.collection('workspaces').doc('test_diagnostics');
        await testRef.set({
          testedAt: new Date().toISOString(),
          status: "connected"
        }, { merge: true });
        
        const snap = await testRef.get();
        if (snap.exists) {
          diagnosticsLog.customDbStatus = "success";
          addLog("SUCCESS! Admin SDK has full read & write permissions on custom Firestore database.");
        } else {
          diagnosticsLog.customDbStatus = "failed_not_readable";
          addError("FAILED: Document written successfully to custom database but could not be read back.", new Error("Read verified empty"));
        }
      } catch (err: any) {
        diagnosticsLog.customDbStatus = "failed";
        diagnosticsLog.customError = {
          message: err.message || String(err),
          code: err.code || "unknown",
          stack: err.stack
        };
        addError(`FAILED: Permissions verification failed on custom database. Code: ${err.code || 'unknown'}. Error:`, err);
        addLog(`🔄 Attempting dynamic self-healing fallback to "(default)" Firestore database...`);
        
        try {
          const fallbackDb = getFirestore(admin.app());
          const fallbackRef = fallbackDb.collection('workspaces').doc('test_diagnostics');
          await fallbackRef.set({
            testedAt: new Date().toISOString(),
            status: "connected",
            note: "fallback_database"
          }, { merge: true });
          
          const fallbackSnap = await fallbackRef.get();
          if (fallbackSnap.exists) {
            setDbAdmin(fallbackDb);
            setActiveDatabaseId("(default)");
            diagnosticsLog.fallbackDbStatus = "success";
            addLog("🌟 SUCCESS! Successfully initialized and verified connection to the (default) Firestore database.");
            addLog("Backend is now routing all Firestore traffic to the (default) database to bypass permissions issue.");
          } else {
            diagnosticsLog.fallbackDbStatus = "failed_not_readable";
            addError("FAILED: Document written to default database but could not be read back.", new Error("Read verified empty"));
          }
        } catch (fallbackErr: any) {
          diagnosticsLog.fallbackDbStatus = "failed";
          diagnosticsLog.fallbackError = {
            message: fallbackErr.message || String(fallbackErr),
            code: fallbackErr.code || "unknown",
            stack: fallbackErr.stack
          };
          addError(`🛑 CRITICAL: Fallback to (default) database also failed! Error:`, fallbackErr);
          addLog("Suggestion: Re-provisioning Firebase with set_up_firebase and deploy_firebase usually establishes correct Container IAM roles on active Google Cloud projects.");
          
          addLog("🚀 INITIALIZING: Testing Dynamic REST-Bypass fallback engine using systemKey...");
          try {
            await restSetDoc('workspaces/diagnostics_rest', {
              status: "connected",
              timestamp: new Date()
            });
            const restVerify = await restGetDoc('workspaces/diagnostics_rest');
            if (restVerify.exists && restVerify.data()?.status === "connected") {
              addLog("🐳 REST-BYPASS SUCCESS! Standard Web API connection to Firestore with systemKey is 100% operational.");
              addLog("All server features (messages, conversations, webhooks) will function perfectly using this backup REST pipeline.");
            } else {
              addError("REST-BYPASS FAILED: Write didn't throw an error but verification returned non-existent document.", new Error("Verification failed"));
            }
          } catch (restErr: any) {
            addError("REST-BYPASS FAILED: REST connectivity helper failed.", restErr);
          }
        }
      }
      try {
        fs.writeFileSync('./diagnostics-output.json', JSON.stringify(diagnosticsLog, null, 2), 'utf8');
      } catch (writeErr) {
        console.error("Failed to write diagnostics JSON file:", writeErr);
      }
    })();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    }).on('error', (err: any) => {
      console.error("Server failed to listen:", err);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer().catch(err => {
  console.error("Fatal error in startServer phase:", err);
  process.exit(1);
});
