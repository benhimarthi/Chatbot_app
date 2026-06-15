import PDFDocument from 'pdfkit';
import { Response } from 'express';

/**
 * Generates an elegant, professional, non-technical Investor Pitch PDF for ChatFlow
 * and streams it directly to the Express HTTP Response.
 */
export function generateInvestorPdf(res: Response): void {
  // Create a new A4 PDF document with balanced margins
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 60, bottom: 65, left: 60, right: 60 },
    bufferPages: true
  });

  // Dynamic stream response headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=ChatFlow_Investor_Pitch.pdf');

  doc.pipe(res);

  // Design Theme Constants
  const primaryColor = '#4F46E5';     // Indigo Accent
  const secondaryColor = '#312E81';   // Deep Blue/Navy
  const textDark = '#1F2937';         // Primary Charcoal Text
  const textMuted = '#4B5563';        // Secondary Muted Gray Text
  const borderLight = '#E5E7EB';      // Light borders for layouts
  const bgLight = '#F9FAFB';          // Neutral light background
  const pageHeight = doc.page.height;
  const pageWidth = doc.page.width;

  // Helper: Reset fonts/colors for body text
  const applyBodyStyle = () => {
    doc.fillColor(textDark)
       .font('Helvetica')
       .fontSize(10.5)
       .lineGap(5);
  };

  // Helper: Draw Slide Header / Title Block for inner pages
  const drawPageHeader = (title: string, category: string) => {
    // Top category tracer
    doc.fillColor(primaryColor)
       .font('Helvetica-Bold')
       .fontSize(9)
       .text(category.toUpperCase(), { characterSpacing: 1 })
       .moveDown(0.3);

    // Slide Header Title
    doc.fillColor(secondaryColor)
       .font('Helvetica-Bold')
       .fontSize(19)
       .text(title)
       .moveDown(0.6);

    // Divider Line
    doc.lineWidth(1.5)
       .strokeColor(primaryColor)
       .moveTo(60, doc.y)
       .lineTo(535, doc.y)
       .stroke()
       .moveDown(1.5);
  };

  // ---------------- PAGE 1: COVER SLIDE ----------------
  // Add a rich background visual block on the left/top
  doc.rect(0, 0, pageWidth, 250).fill(secondaryColor);
  
  // Indigo Accent Bar
  doc.rect(0, 250, pageWidth, 10).fill(primaryColor);

  // White text over Navy Header
  doc.fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .fontSize(40)
     .text('ChatFlow', 60, 85, { characterSpacing: 1.5 })
     .moveDown(0.3);

  doc.fillColor('#E0E7FF')
     .font('Helvetica')
     .fontSize(16)
     .text('The Next-Generation AI Customer Support & Automation Platform')
     .moveDown(0.8);

  // Move back into the white background canvas below 280
  doc.y = 300;

  doc.fillColor(textDark)
     .font('Helvetica-Bold')
     .fontSize(22)
     .text('Investment Brief & Executive Pitch')
     .moveDown(0.5);

  doc.fillColor(textMuted)
     .font('Helvetica')
     .fontSize(12)
     .lineGap(6)
     .text('Unifying direct website widgets, WhatsApp automation pipelines, and native business action engines to help small-to-medium businesses scale conversations effortlessly.')
     .moveDown(2);

  // Graphic border box at the bottom for metadata
  const infoY = 530;
  doc.rect(60, infoY, 475, 120)
     .fillAndStroke(bgLight, borderLight);

  // Info details
  doc.fillColor(secondaryColor)
     .font('Helvetica-Bold')
     .fontSize(11)
     .text('PREPARED FOR:', 80, infoY + 20)
     .fillColor(textDark)
     .font('Helvetica')
     .text('Strategic B2B SaaS Venture Capital & Angel Investors', 80, infoY + 38);

  doc.fillColor(secondaryColor)
     .font('Helvetica-Bold')
     .fontSize(11)
     .text('TIMELINE & STANDARDS:', 80, infoY + 65)
     .fillColor(textDark)
     .font('Helvetica')
     .text('Q3 2026 Funding Round | Developed with Peak Security Practices', 80, infoY + 83);

  // ---------------- PAGE 2: THE PROBLEM & OPPORTUNITY ----------------
  doc.addPage();
  drawPageHeader('The Market Friction we Solve', 'The Support Churn Problem');

  applyBodyStyle();
  doc.text('Customer experience holds the ultimate keys to modern brand loyalty. Yet, small-to-medium businesses face insurmountable barriers when trying to answer, nurture, and automate customer leads across separate messaging environments.', { align: 'justify' })
     .moveDown(1.2);

  // Visual layout block for Problem 1
  const prob1Y = doc.y;
  doc.rect(60, prob1Y, 475, 75).fill(bgLight);
  doc.lineWidth(1).strokeColor(borderLight).rect(60, prob1Y, 475, 75).stroke();
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text('1. The Multi-Channel Chaos', 75, prob1Y + 15);
  doc.fillColor(textDark).font('Helvetica').fontSize(9.5).text('SMEs lose dozens of sales opportunities daily because support queries are scattered across websites, messaging apps (like WhatsApp), and email silos. Consolidating these requires custom engineering that smaller brands cannot afford.', 75, prob1Y + 32, { width: 440 });

  // Visual layout block for Problem 2
  const prob2Y = prob1Y + 95;
  doc.rect(60, prob2Y, 475, 75).fill(bgLight);
  doc.lineWidth(1).strokeColor(borderLight).rect(60, prob2Y, 475, 75).stroke();
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text('2. The Outrageous Expense of Human Support', 75, prob2Y + 15);
  doc.fillColor(textDark).font('Helvetica').fontSize(9.5).text('Customers demand immediate answers within minutes. Building and scaling an around-the-clock human support team represents a massive capital drain, making small business expansion financially restrictive.', 75, prob2Y + 32, { width: 440 });

  // Visual layout block for Problem 3
  const prob3Y = prob2Y + 95;
  doc.rect(60, prob3Y, 475, 75).fill(bgLight);
  doc.lineWidth(1).strokeColor(borderLight).rect(60, prob3Y, 475, 75).stroke();
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text('3. Hallucinations & Low Trust in Generic AI', 75, prob3Y + 15);
  doc.fillColor(textDark).font('Helvetica').fontSize(9.5).text('Standard, generic AI replies repeatedly invent facts, leading to severe brand damage and legal risks. Companies want a tool that stays strictly constrained within their official documentation and guidelines.', 75, prob3Y + 32, { width: 440 });

  doc.y = prob3Y + 105;
  doc.fillColor(secondaryColor)
     .font('Helvetica-Bold')
     .fontSize(13)
     .text('The Immediate Market Opportunity')
     .moveDown(0.5);

  doc.fillColor(textDark)
     .font('Helvetica')
     .fontSize(10.5)
     .text('By resolving channel friction and injecting trustworthy, secure business context directly into automated messaging, ChatFlow unlocks a massive market segment of millions of retail shops, reservation-driven spaces, and premium service firms eager to offload up to 80% of routine client interactions.', { align: 'justify' });

  // ---------------- PAGE 3: THE CHATFLOW SOLUTION ----------------
  doc.addPage();
  drawPageHeader('The Seamless ChatFlow Experience', 'Our Omnichannel Solution');

  applyBodyStyle();
  doc.text('ChatFlow is a comprehensive automated experience hub. Our platform normalizes and supercharges communication pipelines into a beautiful, secure, SaaS workstation.', { align: 'justify' })
     .moveDown(1.2);

  // Key pillar layout
  const colWidth = 220;
  const colY = doc.y;

  // Left Column - Web Chat Widget
  doc.rect(60, colY, colWidth, 190).fill(bgLight);
  doc.lineWidth(1).strokeColor(borderLight).rect(60, colY, colWidth, 190).stroke();
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text('DEPLOYABLE WEB WIDGET', 75, colY + 18);
  doc.fillColor(textDark).font('Helvetica').fontSize(9.5).lineGap(4)
     .text('A beautifully animated, fully responsive web chat bubble that hooks directly onto any corporate website with a single line of code. Features customizable brand themes, helpful action triggers (like native scheduling widgets), and persistent local visitor histories.', 75, colY + 40, { width: colWidth - 30 });

  // Right Column - WhatsApp Automation
  doc.rect(315, colY, colWidth, 190).fill(bgLight);
  doc.lineWidth(1).strokeColor(borderLight).rect(315, colY, colWidth, 190).stroke();
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text('WHATSAPP BOT GATEWAY', 330, colY + 18);
  doc.fillColor(textDark).font('Helvetica').fontSize(9.5).lineGap(4)
     .text('Direct, live integration with powerful WhatsApp Webhook providers (such as WaSender). Incoming customer questions are automatically parsed, logged in our security layers, and immediately answered by your custom AI agent without delay.', 330, colY + 40, { width: colWidth - 30 });

  // Core Value Stat Block Below
  doc.y = colY + 215;
  doc.rect(60, doc.y, 475, 120).fill(secondaryColor);
  
  doc.fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .fontSize(11)
     .text('ENTERPRISE SECURITY & WORKSPACE ISOLATION', 80, doc.y + 18);

  doc.fillColor('#E0E7FF')
     .font('Helvetica')
     .fontSize(9.5)
     .lineGap(5)
     .text('Unlike typical chatbots that mix credentials, ChatFlow stands as a masterpiece of architectural rigor and security. Each workspace manages its own custom API keys and database-backed dynamic webhook secrets. Our system authenticates each callback, giving enterprise business owners full control and 100% data peace of mind.', 80, doc.y + 35, { width: 435 });

  // ---------------- PAGE 4: BEHIND THE MAGIC: DOCUMENT RAG ----------------
  doc.addPage();
  drawPageHeader('Trustworthy AI via Document Ingestion', 'Technological Excellence');

  applyBodyStyle();
  doc.text('Investors frequently ask: "How do we prevent AI from fabricating answers or inventing commercial discounts?" The answer is our secure, high-efficiency Retrieval-Augmented Generation (RAG) platform.', { align: 'justify' })
     .moveDown(1.2);

  // Step-by-Step Visualization
  const stepY = doc.y;
  const cardH = 80;

  // Step 1
  doc.rect(60, stepY, 475, cardH).fill(bgLight);
  doc.lineWidth(1).strokeColor(borderLight).rect(60, stepY, 475, cardH).stroke();
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(18).text('01', 80, stepY + 30);
  doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(11).text('Ingestion & Knowledge Upload', 115, stepY + 18);
  doc.fillColor(textDark).font('Helvetica').fontSize(9).text('Businesses drag and drop PDFs, employee guides, product brochures, or paste websites directly into our dashboard. The knowledge workspace handles sanitization instantly.', 115, stepY + 34, { width: 400 });

  // Step 2
  const step2Y = stepY + cardH + 15;
  doc.rect(60, step2Y, 475, cardH).fill(bgLight);
  doc.lineWidth(1).strokeColor(borderLight).rect(60, step2Y, 475, cardH).stroke();
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(18).text('02', 80, step2Y + 30);
  doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(11).text('Vector Indexing & Partitioning', 115, step2Y + 18);
  doc.fillColor(textDark).font('Helvetica').fontSize(9).text('The ingested text is transformed into high-dimensional embeddings and routed into structured vector memory. Every sentence is split into neat facts for fast indexing.', 115, step2Y + 34, { width: 400 });

  // Step 3
  const step3Y = step2Y + cardH + 15;
  doc.rect(60, step3Y, 475, cardH).fill(bgLight);
  doc.lineWidth(1).strokeColor(borderLight).rect(60, step3Y, 475, cardH).stroke();
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(18).text('03', 80, step3Y + 30);
  doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(11).text('RAG Matching & Gemini Inference', 115, step3Y + 18);
  doc.fillColor(textDark).font('Helvetica').fontSize(9).text('When a customer messages on WhatsApp or the web, the system selects only appropriate parts of the documentation and feeds them to Gemini. The model is constrained to say ONLY what exists in the records.', 115, step3Y + 34, { width: 400 });

  doc.y = step3Y + cardH + 30;
  doc.fillColor(secondaryColor)
     .font('Helvetica-Bold')
     .fontSize(13)
     .text('The Human Impact Value')
     .moveDown(0.5);

  doc.fillColor(textDark)
     .font('Helvetica')
     .fontSize(10.5)
     .text('Instead of training support personnel about ever-changing pricing or product features, businesses simply upload their manuals. ChatFlow is updated instantly, delivering reliable, human-grade conversations 24/7.', { align: 'justify' });

  // ---------------- PAGE 5: BUSINESS OPERATIONS: RESERVATIONS ----------------
  doc.addPage();
  drawPageHeader('Transactional Power: Reservation System', 'Deep Business Workflows');

  applyBodyStyle();
  doc.text('We believe conversational systems shouldn\'t rely on separate, external modules to close appointments. ChatFlow proves this design philosophy by building action engines directly inside our core framework.', { align: 'justify' })
     .moveDown(1);

  // Graphic illustration layout
  const resBoxY = doc.y;
  doc.rect(60, resBoxY, 475, 180).fill(bgLight);
  doc.lineWidth(1.5).strokeColor(borderLight).rect(60, resBoxY, 475, 180).stroke();

  doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(12).text('OUR BUILT-IN ACQUISITION ENGINES', 85, resBoxY + 20);
  doc.lineWidth(0.5).strokeColor(borderLight).moveTo(85, resBoxY + 38).lineTo(510, resBoxY + 38).stroke();

  // Bullet Point 1
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text('• NATIVE DATABASE INTEGRATION', 85, resBoxY + 50);
  doc.fillColor(textDark).font('Helvetica').fontSize(9).text('Integrated workflows (shown by our restaurant table booking system) reside directly in the database. When the bot schedules an appointment, it is committed to real table inventory tables instantly.', 105, resBoxY + 62, { width: 390 });

  // Bullet Point 2
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text('• BI-DIRECTIONAL REAL-TIME CONTROL', 85, resBoxY + 95);
  doc.fillColor(textDark).font('Helvetica').fontSize(9).text('Business staff can view, filter, accept, update, or cancel bookings in real-time from their administrative portal. Users see bookings instantly update, ensuring perfect calendar synchronization.', 105, resBoxY + 107, { width: 390 });

  // Bullet Point 3
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text('• MULTI-PLATFORM TRIGGERING', 85, resBoxY + 140);
  doc.fillColor(textDark).font('Helvetica').fontSize(9).text('Bookings can be initiated manually by administrators, automatically by the website widget, or natively via WhatsApp chat commands processed by the AI.', 105, resBoxY + 152, { width: 390 });

  doc.y = resBoxY + 210;
  doc.fillColor(secondaryColor)
     .font('Helvetica-Bold')
     .fontSize(13)
     .text('Standardized, Extendable Templates')
     .moveDown(0.5);

  doc.fillColor(textDark)
     .font('Helvetica')
     .fontSize(10.5)
     .text('The reservation engine validates our platform\'s core capability: ChatFlow is not just a messaging layer, but an automated operations team. The exact same infrastructure is ready to scale to service repair scheduling, medical checkup bookings, call center routing, and gym system operations.', { align: 'justify' });

  // ---------------- PAGE 6: FINANCIAL MODEL & INVESTMENT ASK ----------------
  doc.addPage();
  drawPageHeader('SaaS Economics, Scale & Seed Ask', 'The Business Case');

  applyBodyStyle();
  doc.text('With simple B2B onboarding, high software margins, and strong recurring revenues, ChatFlow represents a highly investable software asset poised for rapid, vertical industry growth.', { align: 'justify' })
     .moveDown(1);

  // Financial layout blocks
  const finY = doc.y;
  const cellW = 145;

  // Tier 1
  doc.rect(60, finY, cellW, 110).fill(bgLight);
  doc.lineWidth(1).strokeColor(borderLight).rect(60, finY, cellW, 110).stroke();
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text('STARTER TIER', 75, finY + 15);
  doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(16).text('$49 / mo', 75, finY + 32);
  doc.fillColor(textDark).font('Helvetica').fontSize(8.5).lineGap(2)
     .text('Ideal for local retail, cafes & small physical stores. Includes 1 active WhatsApp sandbox, web widget, and basic document ingestion.', 75, finY + 55, { width: cellW - 30 });

  // Tier 2
  doc.rect(225, finY, cellW, 110).fill(bgLight);
  doc.lineWidth(1).strokeColor(borderLight).rect(225, finY, cellW, 110).stroke();
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text('GROWTH TIER', 240, finY + 15);
  doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(16).text('$149 / mo', 240, finY + 32);
  doc.fillColor(textDark).font('Helvetica').fontSize(8.5).lineGap(2)
     .text('Designed for high-growth service firms. Multiple documents, custom AI coaching, complete reservation features, and WhatsApp APIs.', 240, finY + 55, { width: cellW - 30 });

  // Tier 3
  doc.rect(390, finY, cellW, 110).fill(bgLight);
  doc.lineWidth(1).strokeColor(borderLight).rect(390, finY, cellW, 110).stroke();
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text('ENTERPRISE TIER', 405, finY + 15);
  doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(16).text('Custom Quote', 405, finY + 32);
  doc.fillColor(textDark).font('Helvetica').fontSize(8.5).lineGap(2)
     .text('Fully managed custom workspaces. Dedicated server deployment, custom database-bypass configurations, and SLAs.', 405, finY + 55, { width: cellW - 30 });

  // Investment Ask
  doc.y = finY + 130;
  doc.fillColor(secondaryColor)
     .font('Helvetica-Bold')
     .fontSize(14)
     .text('The Funding Objective & Horizon')
     .moveDown(0.5);

  doc.fillColor(textDark)
     .font('Helvetica')
     .fontSize(10.5)
     .lineGap(5)
     .text('ChatFlow is raising a seed round to expand developer operations, fund advanced marketing funnels across SME marketplaces, and build deep API integrations for widely-used payment platforms and CRMs.', { align: 'justify' })
     .moveDown(0.5)
     .text('Our lightweight, containerized architecture runs globally on Google Cloud Run with scale-to-zero efficiency, ensuring beautiful gross margins starting above 88% from day one.', { align: 'justify' });

  // Footer / Final sentence
  doc.moveDown(1.5);
  doc.lineWidth(1)
     .strokeColor(borderLight)
     .moveTo(60, doc.y)
     .lineTo(535, doc.y)
     .stroke()
     .moveDown(1);

  doc.fillColor(secondaryColor)
     .font('Helvetica-Bold')
     .fontSize(12)
     .text('Let\'s automate the operational burden of conversational commerce, together.', { align: 'center' });

  // ---------------- GLOBAL HEADER & FOOTER PAGE NUMBERS ----------------
  const pagesCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pagesCount; i++) {
    doc.switchToPage(i);

    // Skip Header and Footer page numbers on the Cover Page (Page 0)
    if (i > 0) {
      // Header
      doc.fillColor(textMuted)
         .font('Helvetica')
         .fontSize(8)
         .text('ChatFlow Investor Briefing  |  Confidential Business Report', 60, 40);

      doc.lineWidth(0.5)
         .strokeColor(borderLight)
         .moveTo(60, 52)
         .lineTo(535, 52)
         .stroke();

      // Footer
      doc.lineWidth(0.5)
         .strokeColor(borderLight)
         .moveTo(60, pageHeight - 50)
         .lineTo(535, pageHeight - 50)
         .stroke();

      doc.fillColor(textMuted)
         .font('Helvetica')
         .fontSize(8.5)
         .text(`Page ${i + 1} of ${pagesCount}`, 60, pageHeight - 40, { align: 'right' });
    }
  }

  // Finalize the PDF document
  doc.end();
}
