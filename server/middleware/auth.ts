import { Request, Response, NextFunction } from "express";
import { authAdmin } from "../firebaseAdmin.ts";

export interface AuthenticatedRequest extends Request {
  workspaceId?: string;
  idToken?: string;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  try {
    const decoded = await authAdmin.verifyIdToken(idToken);
    req.workspaceId = decoded.uid;
    req.idToken = idToken;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid authorization token" });
  }
}
