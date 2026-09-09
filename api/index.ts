import type { Request, Response } from "express";
import app from "../server";

export default function handler(req: Request, res: Response) {
  // Restore original request URL if rewritten by Vercel serverless functions
  const xMatchedPath = req.headers["x-matched-path"] as string;
  const xForwardedUri = req.headers["x-forwarded-uri"] as string;
  const xOriginalUrl = req.headers["x-original-url"] as string;

  const targetPath = xMatchedPath || xForwardedUri || xOriginalUrl;

  if (targetPath) {
    req.url = targetPath;
  } else if (req.url && (req.url === "/api/index" || req.url === "/api" || req.url.startsWith("/api/index?"))) {
    // If query string exists, preserve it
    const queryIndex = req.url.indexOf("?");
    const query = queryIndex !== -1 ? req.url.slice(queryIndex) : "";
    req.url = `/api${query}`;
  }

  return app(req, res);
}
