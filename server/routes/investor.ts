import { Router } from "express";
import { generateInvestorPdf } from "../services/pdfGenerator.ts";

const router = Router();

/**
 * Endpoint to download the dynamically generated Investor Pitch PDF.
 */
router.get("/api/investor-deck/pdf", (req, res) => {
  try {
    generateInvestorPdf(res);
  } catch (error: any) {
    console.error("Failed to generate investor PDF:", error);
    res.status(500).json({ error: "Failed to generate investor pitch deck PDF.", details: error.message });
  }
});

export default router;
