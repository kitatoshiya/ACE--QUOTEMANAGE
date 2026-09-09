import type { Request, Response } from "express";
import app from "../server";

export default function handler(req: Request, res: Response) {
  const forwardedUri = req.headers["x-forwarded-uri"] as string;
  const originalUrl = req.headers["x-original-url"] as string;

  if (forwardedUri && forwardedUri.startsWith("/api")) {
    req.url = forwardedUri;
  } else if (originalUrl && originalUrl.startsWith("/api")) {
    req.url = originalUrl;
  }

  return app(req, res);
}
