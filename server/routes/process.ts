import { Router } from "express";
import multer from "multer";
import axios from "axios";
import * as cheerio from "cheerio";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// API: Parse PDF
router.post("/api/process/pdf", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const pdfParseModule = (await import("pdf-parse")) as any;
    const pdf = pdfParseModule.default || pdfParseModule;
    const data = await pdf(req.file.buffer);
    res.json({ text: data.text });
  } catch (error) {
    console.error("PDF Parsing Error:", error);
    res.status(500).json({ error: "Failed to parse PDF" });
  }
});

// API: Scrape URL (Enhanced for Multi-page)
router.post("/api/process/url", async (req, res) => {
  try {
    const { url, urls: targetUrls } = req.body;
    if (!url && (!targetUrls || !Array.isArray(targetUrls))) {
      return res.status(400).json({ error: "No URL or URLs provided" });
    }
    
    const baseUrl = url ? url.replace(/\/$/, "") : "";
    
    const scrapePage = async (pageUrl: string) => {
      try {
        const response = await axios.get(pageUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 8000
        });
        const $ = cheerio.load(response.data);
        
        const title = $("title").text().trim() || pageUrl;
        
        // Get og:image
        const ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="og:image"]').attr('content');
        
        const contentItems: any[] = [];
        if (ogImage) {
          try {
            const absoluteOgImage = new URL(ogImage, pageUrl).toString();
            contentItems.push({ type: 'image', url: absoluteOgImage, alt: title, isOg: true });
          } catch (e) {}
        }

        const clonedBody = $("body").clone();
        clonedBody.find("script, style, nav, footer, noscript, iframe, header, [role='banner'], [role='contentinfo']").remove();
        
        const container = clonedBody.find("main, #content, .content, article").length > 0 
          ? clonedBody.find("main, #content, .content, article").first() 
          : clonedBody;

        container.find("p, h1, h2, h3, h4, h5, h6, img, li").each((_, el) => {
          const $el = $(el);
          if ($el.is("img")) {
            const src = $el.attr("src");
            const alt = ($el.attr("alt") || "").trim();
            if (src && !src.startsWith("data:")) {
              try {
                const absoluteUrl = new URL(src, pageUrl).toString();
                // Filter out obvious logos/icons
                const isLowQuality = /logo|icon|avatar|header|footer|nav|button|social|pixel/i.test(absoluteUrl) || 
                                   /logo|icon|avatar/i.test(alt);
                
                if (!isLowQuality) {
                  contentItems.push({ type: 'image', url: absoluteUrl, alt });
                }
              } catch (e) {}
            }
          } else {
            const text = $el.text().replace(/\s+/g, " ").trim();
            if (text.length > 20) {
              contentItems.push({ type: 'text', text });
            }
          }
        });
        
        const fullText = contentItems
          .filter(item => item.type === 'text')
          .map(item => item.text)
          .join("\n\n");
        
        return { 
          url: pageUrl, 
          title, 
          text: fullText, 
          contentItems, 
          html: response.data 
        };
      } catch (e: any) {
        if (e.response?.status === 404) {
          console.warn(`Scrape skip: 404 Not Found for ${pageUrl}`);
        } else {
          console.error(`Failed to scrape ${pageUrl}:`, e.message || e);
        }
        return null;
      }
    };

    // Case 1: Bulk Scrape specific URLs (called after discovery step)
    if (targetUrls && Array.isArray(targetUrls)) {
      const scrapers = targetUrls.slice(0, 15).map(u => scrapePage(u));
      const pages = await Promise.all(scrapers);
      const results = pages.filter(p => p !== null && p.text.length > 100);
      return res.json({ results });
    }

    // Case 2: Source Discovery (Scrape homepage + find links)
    if (!baseUrl) return res.status(400).json({ error: "No base URL provided for discovery" });
    const mainPage = await scrapePage(baseUrl);
    if (!mainPage) return res.status(500).json({ error: "Failed to scrape homepage" });

    const baseHost = new URL(baseUrl).hostname;

    // Discover Links
    const $ = cheerio.load(mainPage.html);
    const discoveryResults: { url: string; text: string }[] = [];
    $("a[href]").each((_, el) => {
      try {
        const href = $(el).attr("href");
        const text = $(el).text().trim();
        if (!href) return;
        const absoluteUrl = new URL(href, baseUrl);
        if (absoluteUrl.hostname === baseHost) {
          absoluteUrl.hash = "";
          const normalized = absoluteUrl.toString().replace(/\/$/, "");
          const isNonHtml = normalized.match(/\.(pdf|jpg|jpeg|png|gif|zip|csv|docx|xlsx|pptx)$/i);
          if (normalized !== baseUrl && !isNonHtml) {
            discoveryResults.push({ url: normalized, text: text || normalized });
          }
        }
      } catch (e) {}
    });

    // Remove duplicates and noise
    const uniqueLinksMap = new Map<string, string>();
    const excludePatterns = [/login/i, /signup/i, /privacy/i, /terms/i, /legal/i, /admin/i, /auth/i, /cart/i, /checkout/i, /account/i, /tag/i, /category/i];
    
    discoveryResults.forEach(l => {
      if (excludePatterns.some(p => p.test(l.url))) return;
      if (!uniqueLinksMap.has(l.url) || uniqueLinksMap.get(l.url)!.length < l.text.length) {
        uniqueLinksMap.set(l.url, l.text);
      }
    });
    
    const candidates = Array.from(uniqueLinksMap.entries()).map(([url, text]) => ({ url, text }));

    res.json({ 
      homepage: { url: mainPage.url, title: mainPage.title, text: mainPage.text, contentItems: mainPage.contentItems },
      candidates
    });
  } catch (error) {
    console.error("URL Scraping Error:", error);
    res.status(500).json({ error: "Failed to scrape URL" });
  }
});

export default router;
