import type { Request, Response } from "express";
import app from "../server";

export default function handler(req: Request, res: Response) {
  return new Promise((resolve) => {
    // Listen for response completion so Vercel Serverless runtime waits until Express finishes
    res.on("finish", () => resolve(null));
    res.on("close", () => resolve(null));

    try {
      // Restore original request URL from Vercel proxy headers
      const forwardedUri = req.headers["x-forwarded-uri"] as string;
      const originalUrl = req.headers["x-original-url"] as string;
      const matchedPath = req.headers["x-matched-path"] as string;

      if (forwardedUri && forwardedUri.startsWith("/api")) {
        req.url = forwardedUri;
      } else if (originalUrl && originalUrl.startsWith("/api")) {
        req.url = originalUrl;
      } else if (matchedPath && matchedPath.startsWith("/api") && matchedPath !== "/api/index") {
        req.url = matchedPath;
      } else if (req.query && req.query.all) {
        const pathSegments = Array.isArray(req.query.all) ? req.query.all.join("/") : req.query.all;
        const queryIdx = req.url.indexOf("?");
        const queryStr = queryIdx !== -1 ? req.url.slice(queryIdx) : "";
        req.url = `/api/${pathSegments}${queryStr}`;
      }

      console.log(`[Vercel Serverless Invocation] Method=${req.method}, Resolved URL=${req.url}`);

      // Pass request to Express app with fallback for unhandled routes
      app(req, res, (err?: any) => {
        if (err) {
          console.error("[Vercel Express Error]:", err);
          if (!res.headersSent) {
            res.status(500).json({
              error: "Internal Express Error",
              message: err?.message || String(err),
            });
          }
        } else if (!res.headersSent) {
          res.status(404).json({
            error: "API Endpoint Not Found",
            url: req.url,
          });
        }
        resolve(null);
      });
    } catch (err: any) {
      console.error("[Vercel Handler Top Exception]:", err);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Vercel Serverless Handler Exception",
          message: err?.message || String(err),
        });
      }
      resolve(null);
    }
  });
}


