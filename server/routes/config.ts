import { Router } from "express";
import { firebaseConfig, activeDatabaseId, diagnosticsLog } from "../firebaseAdmin.ts";

const router = Router();

router.get("/api/firebase/config", (req, res) => {
  res.json({
    projectId: firebaseConfig.projectId,
    databaseId: activeDatabaseId || "(default)",
    diagnostics: diagnosticsLog
  });
});

export default router;
