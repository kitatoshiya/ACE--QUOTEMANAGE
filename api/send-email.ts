import type { Request, Response } from "express";
import nodemailer from "nodemailer";

export default async function handler(req: Request, res: Response) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  }

  try {
    const { to, subject, bodyText, bodyHtml, fromName, settings } = req.body || {};

    if (!to || !subject || !bodyText) {
      return res.status(400).json({
        success: false,
        error: "宛先(to)、件名(subject)、本文(bodyText)は必須項目です。",
      });
    }

    // Resolve SMTP settings from payload or environment variables
    const smtpHost = settings?.outgoingHost || process.env.SMTP_HOST || "smtp.office365.com";
    const smtpPort = parseInt(String(settings?.outgoingPort || process.env.SMTP_PORT || "587"), 10);
    const smtpUser =
      settings?.authUsername || settings?.commonEmail || process.env.SMTP_USER || "spares-common@shipping-air.jp";
    const smtpPass = settings?.authPassword || process.env.SMTP_PASS;

    const senderName = settings?.senderName || fromName || "ACE船用品輸出管理";
    const senderEmail = settings?.commonEmail || smtpUser;
    const smtpFrom = `"${senderName}" <${senderEmail}>`;

    console.log(`[Vercel / Server Email Service] 宛先: ${to} | 件名: ${subject} | Host: ${smtpHost}:${smtpPort}`);

    // Check if valid password is present
    const hasValidPass = smtpPass && smtpPass !== "••••••••••••" && smtpPass.trim() !== "";

    if (!hasValidPass) {
      console.warn(`[Email Warning] No valid SMTP password provided for ${to}. Email not dispatched.`);
      return res.status(200).json({
        success: false,
        warning: true,
        message: "メール送信スキップ: SMTP送信パスワードが未設定です。画面右上の『メール設定』または環境変数(SMTP_PASS)でパスワードを設定してください。",
        mode: "unconfigured_smtp",
      });
    }

    // Create Transporter using real SMTP settings
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: { rejectUnauthorized: false },
    });

    const info = await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      text: bodyText,
      html: bodyHtml || bodyText.replace(/\n/g, "<br>"),
    });

    console.log(`[Email Success] MessageId: ${info.messageId} sent to ${to}`);

    return res.status(200).json({
      success: true,
      message: `実メールが [${smtpHost}:${smtpPort}] より ${to} へ正常に送信されました。`,
      messageId: info.messageId,
      mode: "smtp_live",
    });
  } catch (err: any) {
    console.error("[Email Dispatch Error]", err);
    return res.status(500).json({
      success: false,
      error: `メール送信エラー: ${err?.message || "不明なエラーが発生しました"}`,
    });
  }
}
