import type { Request, Response } from "express";
import app from "../server";

export default function handler(req: Request, res: Response) {
  try {
    const originalUrl = (req.headers["x-forwarded-uri"] as string) || 
                        (req.headers["x-original-url"] as string) || 
                        req.url;

    // Correct req.url if Vercel serverless rewrite stripped the original path
    if (originalUrl && !originalUrl.startsWith("/api/index")) {
      req.url = originalUrl;
    } else if (req.query && req.query.all) {
      const pathSegments = Array.isArray(req.query.all) ? req.query.all.join("/") : req.query.all;
      const queryIdx = req.url.indexOf("?");
      const queryStr = queryIdx !== -1 ? req.url.slice(queryIdx) : "";
      req.url = `/api/${pathSegments}${queryStr}`;
    }

    console.log(`[Vercel Serverless Request]: Method=${req.method}, URL=${req.url}`);

    return app(req, res);
  } catch (err: any) {
    console.error("[Vercel Serverless Handler Error]:", err);
    return res.status(500).json({
      error: "Vercel Serverless Execution Failed",
      message: err?.message || String(err),
      url: req.url,
    });
  }
}

