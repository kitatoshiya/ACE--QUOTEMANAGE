import type { Request, Response } from "express";
import app from "../server";

export default function handler(req: Request, res: Response) {
  // Restore original URL if rewritten by Vercel
  const matchedPath = (req.headers["x-matched-path"] as string) || (req.headers["x-forwarded-uri"] as string);
  if (matchedPath && (req.url === "/api/index" || req.url === "/api" || req.url.startsWith("/api/index?"))) {
    req.url = matchedPath;
  }
  return app(req, res);
}
