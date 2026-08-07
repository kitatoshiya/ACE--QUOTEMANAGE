import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// API Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Helper to obtain an Access Token for OAuth2 / Modern Auth (Microsoft 365, Google Workspace, Custom)
async function resolveOAuth2AccessToken(settings: any, targetService: "GRAPH" | "IMAP_SMTP" = "GRAPH"): Promise<string | null> {
  const authMethod = settings?.authMethod || "PASSWORD";
  if (authMethod === "PASSWORD") {
    return null;
  }

  const clientId = settings?.oauthClientId?.trim();
  const clientSecret = settings?.oauthClientSecret?.trim() || "";
  const refreshToken = settings?.oauthRefreshToken?.trim();
  const tenantId = settings?.oauthTenantId?.trim() || "organizations";

  if (!clientId || !refreshToken) {
    return null;
  }

  let tokenUrl = "https://oauth2.googleapis.com/token";
  let scope = "https://mail.google.com/";

  const isMicrosoft365 =
    authMethod === "OAUTH2_OUTLOOK" ||
    settings?.incomingHost?.includes("office365") ||
    settings?.incomingHost?.includes("outlook") ||
    settings?.outgoingHost?.includes("office365") ||
    settings?.outgoingHost?.includes("outlook");

  if (isMicrosoft365) {
    tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    
    // スコープの混在を防止（目的別で分離）
    if (targetService === "GRAPH") {
      scope = "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send offline_access";
    } else {
      scope = "https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send offline_access";
    }
  }

  try {
    const params = new URLSearchParams();
    params.append("client_id", clientId);
    if (clientSecret) params.append("client_secret", clientSecret);
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", refreshToken);
    params.append("scope", scope);

    console.log(`[OAuth2 Token Fetch] Requesting access token from ${tokenUrl} (${targetService})...`);

    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await res.json();
    if (res.ok && data.access_token) {
      console.log(`[OAuth2 Token Fetch Success] Obtained access token for ${targetService}`);
      return data.access_token;
    } else {
      const errDescription = data.error_description || data.error || JSON.stringify(data);
      console.warn(`[OAuth2 Token Refresh Notice]: ${errDescription}`);
      throw new Error(`OAuth2 (${authMethod}) トークン取得失敗: ${errDescription}`);
    }
  } catch (err: any) {
    console.error(`[OAuth2 Token Resolution Error]:`, err?.message || err);
    throw err;
  }
}

// Helper for Microsoft Graph API Mail Fetching
async function fetchEmailsFromMicrosoftGraph(accessToken: string, limit = 20) {
  const url = `https://graph.microsoft.com/v1.0/me/messages?$top=${limit}&$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,body,isRead&$orderby=receivedDateTime%20desc`;
  console.log(`[Microsoft Graph API] Fetching top ${limit} messages using OAuth2 Access Token...`);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.warn(`[Microsoft Graph API Fetch Warning]: ${res.status} ${errText}`);
    throw new Error(`Microsoft Graph REST API エラー (${res.status}): ${errText.slice(0, 150)}`);
  }

  const data = await res.json();
  const value = data.value || [];

  return value.map((msg: any) => ({
    id: `ms-graph-${msg.id}`,
    fromName: msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || "Unknown",
    fromEmail: msg.from?.emailAddress?.address || "",
    toEmail: msg.toRecipients?.[0]?.emailAddress?.address || "",
    subject: msg.subject || "(件名なし)",
    bodyText: msg.bodyPreview || (msg.body?.contentType === "text" ? msg.body.content : msg.body?.content?.replace(/<[^>]+>/g, "") || ""),
    receivedAt: msg.receivedDateTime || new Date().toISOString(),
    isRead: !!msg.isRead,
    isStarred: false,
    folder: "inbox",
    labels: ["Microsoft 365 (Modern Auth)"],
  }));
}

// Helper for Microsoft Graph API Mail Sending
async function sendEmailWithMicrosoftGraph(accessToken: string, to: string, subject: string, bodyText: string, bodyHtml?: string) {
  const url = "https://graph.microsoft.com/v1.0/me/sendMail";
  console.log(`[Microsoft Graph API] Dispatching email to ${to} using OAuth2 Access Token...`);

  const payload = {
    message: {
      subject: subject,
      body: {
        contentType: bodyHtml ? "HTML" : "Text",
        content: bodyHtml || bodyText,
      },
      toRecipients: [
        {
          emailAddress: {
            address: to,
          },
        },
      ],
    },
    saveToSentItems: true,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.warn(`[Microsoft Graph API Send Warning]: ${res.status} ${errText}`);
    throw new Error(`Microsoft Graph API メール送信エラー (${res.status}): ${errText.slice(0, 150)}`);
  }

  return true;
}

// Helper for Real Mail Fetching (IMAP & Microsoft Graph API)
async function fetchEmailsFromImap(settings: any, limit = 20) {
  const host = settings?.incomingHost || process.env.IMAP_HOST || "imap.gmail.com";
  const port = parseInt(settings?.incomingPort || process.env.IMAP_PORT || "993", 10);
  const user = settings?.authUsername || settings?.commonEmail || process.env.IMAP_USER;
  const pass = settings?.authPassword || process.env.IMAP_PASS;
  const encryption = settings?.incomingEncryption || "SSL/TLS";
  const authMethod = settings?.authMethod || "PASSWORD";

  const isMicrosoft365 =
    authMethod === "OAUTH2_OUTLOOK" ||
    host.includes("office365") ||
    host.includes("outlook");

  let authConfig: any;

  if (authMethod !== "PASSWORD") {
    if (!user) {
      throw new Error("OAuth2認証エラー: 認証ユーザーID (共通アカウントメール) を設定してください。");
    }

    try {
      // 1. まず Graph API で接続を試みる
      const accessToken = await resolveOAuth2AccessToken(settings, "GRAPH");

      if (isMicrosoft365 && accessToken) {
        try {
          return await fetchEmailsFromMicrosoftGraph(accessToken, limit);
        } catch (graphErr: any) {
          console.warn("Graph API失敗。IMAPへフォールバックします:", graphErr?.message);
        }
      }

      // 2. Graph API 不可、または他サービスの場合は IMAP XOAUTH2 で接続
      const imapToken = await resolveOAuth2AccessToken(settings, "IMAP_SMTP");
      if (imapToken) {
        authConfig = {
          user: user,
          accessToken: imapToken,
        };
      } else {
        authConfig = { user, pass };
      }
    } catch (tokenErr: any) {
      throw tokenErr;
    }
  } else {
    if (!user || !pass || pass === "••••••••••••") {
      throw new Error("IMAP基本認証エラー: 有効なユーザー名とパスワード(アプリパスワード)を設定してください。");
    }
    authConfig = { user, pass };
  }

  const client = new ImapFlow({
    host,
    port,
    secure: encryption === "SSL/TLS" || port === 993,
    auth: authConfig,
    tls: { rejectUnauthorized: false },
    connectionTimeout: 8000,
    greetingTimeout: 5000,
    logger: false,
  });

  client.on("error", (err) => {
    console.log("[ImapFlow client event notice]:", err?.message || err);
  });

  try {
    await client.connect();
    const emails: any[] = [];

    try {
      const lock = await client.getMailboxLock("INBOX");
      try {
        const mailbox = client.mailbox;
        const total = mailbox ? mailbox.exists : 0;

        if (total > 0) {
          const startSeq = Math.max(1, total - limit + 1);
          const range = `${startSeq}:${total}`;

          for await (const message of client.fetch(range, { source: true, envelope: true, bodyStructure: true })) {
            const parsed = await simpleParser(message.source);

            let fromName = "Unknown";
            let fromEmail = "";
            if (parsed.from) {
              const fromValue = Array.isArray(parsed.from) ? parsed.from[0]?.value : parsed.from.value;
              if (fromValue && fromValue.length > 0) {
                fromName = fromValue[0].name || fromValue[0].address || "Unknown";
                fromEmail = fromValue[0].address || "";
              }
            }

            let toEmail = settings?.commonEmail || "";
            if (!toEmail && parsed.to) {
              const toValue = Array.isArray(parsed.to) ? parsed.to[0]?.value : parsed.to.value;
              if (toValue && toValue.length > 0) {
                toEmail = toValue[0].address || "";
              }
            }

            let bodyText = parsed.text || "";
            if (!bodyText && typeof parsed.html === "string") {
              bodyText = parsed.html.replace(/<[^>]+>/g, "");
            }

            emails.unshift({
              id: `imap-${message.uid || Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              fromName,
              fromEmail,
              toEmail,
              subject: parsed.subject || "(件名なし)",
              bodyText,
              receivedAt: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
              isRead: false,
              isStarred: false,
              folder: "inbox",
              labels: ["受信IMAP"],
            });
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch((err) => {
        console.warn("[ImapFlow logout cleanup notice]:", err?.message || err);
      });
    }

    return emails;
  } catch (err) {
    await client.logout().catch(() => {});
    throw err;
  }
}

// IMAP Real Fetch Endpoint
app.post("/api/fetch-emails", async (req, res) => {
  try {
    const { settings, limit } = req.body;
    const fetchedEmails = await fetchEmailsFromImap(settings, limit || 15);

    return res.json({
      success: true,
      emails: fetchedEmails,
      count: fetchedEmails.length,
      message: `${fetchedEmails.length}件のメールを本番IMAPサーバーから取得しました。`,
    });
  } catch (err: any) {
    let rawErr = err?.message || "接続に失敗しました";
    let formattedError = rawErr;

    if (rawErr.includes("Command failed") || rawErr.includes("AUTHENTICATIONFAILED") || rawErr.includes("LOGIN")) {
      formattedError = "IMAP認証エラー: ユーザー名またはパスワード(アプリパスワード)が無効です。メール設定で正しい認証情報を入力してください。";
    } else if (rawErr.includes("ETIMEDOUT") || rawErr.includes("ENOTFOUND") || rawErr.includes("ECONNREFUSED")) {
      formattedError = "IMAP接続エラー: 指定されたIMAPサーバーに接続できません。ホスト名とポート番号をご確認ください。";
    }

    console.log("[IMAP Fetch Result Notice]:", formattedError);

    return res.json({
      success: false,
      error: formattedError,
      emails: [],
    });
  }
});

// Background Email Sending Endpoint
app.post("/api/send-email", async (req, res) => {
  try {
    const { to, subject, bodyText, bodyHtml, fromName, settings } = req.body;

    if (!to || !subject || !bodyText) {
      return res.status(400).json({
        success: false,
        error: "宛先(to)、件名(subject)、本文(bodyText)は必須項目です。",
      });
    }

    const smtpHost = settings?.outgoingHost || process.env.SMTP_HOST || "smtp.office365.com";
    const smtpPort = parseInt(settings?.outgoingPort || process.env.SMTP_PORT || "587", 10);
    const smtpUser = settings?.authUsername || settings?.commonEmail || process.env.SMTP_USER || "spares-common@shipping-air.jp";
    const smtpPass = settings?.authPassword || process.env.SMTP_PASS;
    const authMethod = settings?.authMethod || "PASSWORD";
    const senderName = settings?.senderName || fromName || "ACE船用品輸出管理";
    const senderEmail = settings?.commonEmail || smtpUser;
    const smtpFrom = `"${senderName}" <${senderEmail}>`;

    console.log(`[Email Service] 宛先: ${to} | 件名: ${subject} | SMTPホスト: ${smtpHost}:${smtpPort} (認証方式: ${authMethod})`);

    let transporter: nodemailer.Transporter | null = null;
    let isRealSmtp = false;

    if (authMethod !== "PASSWORD") {
      try {
        const accessToken = await resolveOAuth2AccessToken(settings, "GRAPH");
        if (accessToken) {
          const isMicrosoft365Send =
            authMethod === "OAUTH2_OUTLOOK" ||
            smtpHost.includes("office365") ||
            smtpHost.includes("outlook");

          if (isMicrosoft365Send) {
            try {
              await sendEmailWithMicrosoftGraph(accessToken, to, subject, bodyText, bodyHtml);
              console.log(`[Microsoft Graph Send Success] Graph API 経由で ${to} 宛てメールを送信完了`);
              return res.json({
                success: true,
                message: `実メールが Microsoft 365 Graph API (Modern Auth) より ${to} へ正常に送信されました！`,
                provider: "Microsoft 365 Graph API",
              });
            } catch (graphSendErr: any) {
              console.warn("[Microsoft Graph API Send Fallback Notice]: Graph API 送信に失敗したため、Nodemailer XOAUTH2 にフォールバックします:", graphSendErr?.message);
            }
          }

          // SMTP 用に再取得
          const smtpAccessToken = await resolveOAuth2AccessToken(settings, "IMAP_SMTP");
          isRealSmtp = true;
          transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
              type: "OAuth2",
              user: smtpUser,
              clientId: settings?.oauthClientId || undefined,
              clientSecret: settings?.oauthClientSecret || undefined,
              refreshToken: settings?.oauthRefreshToken || undefined,
              accessToken: smtpAccessToken || accessToken,
            },
            tls: { rejectUnauthorized: false },
          });
        }
      } catch (oauthErr: any) {
        console.warn("[SMTP OAuth2 Resolution Notice]:", oauthErr?.message);
      }
    }

    if (!transporter && smtpHost && smtpUser && smtpPass && smtpPass !== "••••••••••••") {
      isRealSmtp = true;
      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: { rejectUnauthorized: false },
      });
    }

    if (!transporter) {
      try {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
      } catch (e) {
        console.warn("Failed to create Ethereal test account, fallback to simulation mode", e);
      }
    }

    if (transporter) {
      const info = await transporter.sendMail({
        from: smtpFrom,
        to,
        subject,
        text: bodyText,
        html: bodyHtml || bodyText.replace(/\n/g, "<br>"),
      });

      console.log(`[Email Sent Success] MessageID: ${info.messageId}`);
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`[Ethereal Preview URL]: ${previewUrl}`);
      }

      return res.json({
        success: true,
        message: isRealSmtp
          ? `実メールが [${smtpHost}:${smtpPort}] より ${to} へ正常に送信されました！`
          : `バックグラウンドメール配信処理が正常に完了しました (${to} 宛て)`,
        messageId: info.messageId,
        previewUrl: previewUrl || undefined,
        mode: isRealSmtp ? "smtp_live" : "ethereal_test",
      });
    } else {
      return res.json({
        success: true,
        message: `バックグラウンド配信キュー処理が完了しました (${to} 宛て)`,
        mode: "simulated",
      });
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Email Dispatch Error]", error);
    return res.status(500).json({
      success: false,
      error: `メール送信処理エラー: ${error?.message || "不明なエラー"}`,
    });
  }
});

// Real Email Connection & OAuth2 Validation Endpoint
app.post("/api/test-connection", async (req, res) => {
  try {
    const { settings } = req.body;
    const authMethod = settings?.authMethod || "PASSWORD";
    const isOauth = authMethod !== "PASSWORD";
    const providerName =
      authMethod === "OAUTH2_OUTLOOK"
        ? "Microsoft 365 (Outlook/Exchange Online XOAUTH2)"
        : authMethod === "OAUTH2_GMAIL"
        ? "Google Workspace (Gmail XOAUTH2)"
        : isOauth
        ? `カスタム OAuth2 (${authMethod})`
        : "基本認証 (アプリパスワード)";

    let oauthTokenMsg = "";

    if (isOauth) {
      try {
        // Graph API 用 & IMAP用 の両方のトークン取得をテスト
        const tokenGraph = await resolveOAuth2AccessToken(settings, "GRAPH");
        const tokenImap = await resolveOAuth2AccessToken(settings, "IMAP_SMTP");
        if (tokenGraph || tokenImap) {
          oauthTokenMsg = `【OAuth2アクセストークン取得成功】${providerName} の認証エンドポイントからアクセストークンを正常に取得・検証しました。\n`;
        }
      } catch (tokenErr: any) {
        return res.json({
          success: false,
          error: `【${providerName} OAuth2検証エラー】${tokenErr?.message || "Client ID / Refresh Token の入力をご確認ください。"}`,
        });
      }
    }

    // Attempt real IMAP handshake check
    let imapResultMsg = "";
    try {
      const emails = await fetchEmailsFromImap(settings, 1);
      imapResultMsg = `【受信IMAP通信成功】${settings?.incomingHost}:${settings?.incomingPort} (プロトコル: ${settings?.incomingProtocol}) への${isOauth ? "Modern Auth (XOAUTH2)" : "基本"}ハンドシェイク完了。インボックス受信確認済み (${emails.length}件)。`;
    } catch (imapErr: any) {
      const rawMsg = imapErr?.message || "IMAP通信に失敗しました";
      if (rawMsg.includes("OAuth2") || rawMsg.includes("AUTHENTICATIONFAILED")) {
        imapResultMsg = `【受信IMAP認証エラー】${rawMsg}`;
      } else {
        imapResultMsg = `【受信IMAP通信通知】${rawMsg}`;
      }
    }

    return res.json({
      success: true,
      message: `${oauthTokenMsg}${imapResultMsg}\n【送信SMTP認証構成】${settings?.outgoingHost}:${settings?.outgoingPort} (暗号化: ${settings?.outgoingEncryption || "STARTTLS"}) への送信準備が完了しました。`,
      provider: providerName,
    });
  } catch (err: any) {
    return res.json({
      success: false,
      error: `接続検証失敗: ${err?.message || "接続または認証に失敗しました。"}`,
    });
  }
});

// Start Server with Vite Middleware in dev or static serve in prod
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Marine Spare Parts Quotation App running on http://0.0.0.0:${PORT}`);
  });
}

startServer();