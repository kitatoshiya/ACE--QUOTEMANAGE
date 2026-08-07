import React, { useState, useMemo } from "react";
import {
  Inbox,
  Send,
  FileText,
  Trash2,
  Star,
  AlertOctagon,
  Plus,
  Search,
  Filter,
  CheckSquare,
  Square,
  Mail,
  MailOpen,
  Reply,
  ReplyAll,
  Forward,
  Sparkles,
  Ship,
  Plane,
  Tag,
  Clock,
  User,
  ExternalLink,
  CheckCircle2,
  X,
  Copy,
  Check,
  RotateCcw,
  Paperclip,
  Zap,
  Settings,
  Server,
  ShieldCheck,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Key,
} from "lucide-react";
import { EmailFolder, EmailMessage, EmailServerSettings, QuotationItem, StaffMember, UserProfile } from "../types";

interface EmailClientProps {
  emails: EmailMessage[];
  setEmails: React.Dispatch<React.SetStateAction<EmailMessage[]>>;
  currentUser: UserProfile;
  staffMembers: StaffMember[];
  quotes: QuotationItem[];
  onCreateQuoteFromEmail?: (email: EmailMessage) => void;
  onSendEmailApi?: (to: string, subject: string, bodyText: string) => Promise<boolean>;
  emailServerSettings?: EmailServerSettings;
  onUpdateEmailServerSettings?: (settings: EmailServerSettings) => void;
  currentTheme?: string;
}

export const EmailClient: React.FC<EmailClientProps> = ({
  emails,
  setEmails,
  currentUser,
  staffMembers,
  quotes,
  onCreateQuoteFromEmail,
  onSendEmailApi,
  emailServerSettings,
  onUpdateEmailServerSettings,
  currentTheme = "light",
}) => {
  // Navigation State
  const [selectedFolder, setSelectedFolder] = useState<EmailFolder>("inbox");
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);

  // Multi-selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Compose Modal State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeVessel, setComposeVessel] = useState("");
  const [composeAirport, setComposeAirport] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Compute folder unread counts
  const folderCounts = useMemo(() => {
    const counts = {
      inbox: 0,
      starred: 0,
      sent: 0,
      drafts: 0,
      trash: 0,
      spam: 0,
    };
    emails.forEach((m) => {
      if (m.folder === "inbox" && !m.isRead) counts.inbox++;
      if (m.isStarred) counts.starred++;
      if (m.folder === "sent") counts.sent++;
      if (m.folder === "drafts") counts.drafts++;
      if (m.folder === "trash") counts.trash++;
      if (m.folder === "spam") counts.spam++;
    });
    return counts;
  }, [emails]);

  // All distinct labels
  const allLabels = useMemo(() => {
    const set = new Set<string>();
    emails.forEach((e) => e.labels?.forEach((l) => set.add(l)));
    return Array.from(set);
  }, [emails]);

  // Filtered emails
  const filteredEmails = useMemo(() => {
    return emails.filter((email) => {
      // Label filter
      if (selectedLabel) {
        if (!email.labels?.includes(selectedLabel)) return false;
      } else {
        // Folder filter
        if (selectedFolder === "starred") {
          if (!email.isStarred) return false;
        } else if (email.folder !== selectedFolder) {
          return false;
        }
      }

      // Unread / Starred toggle filters
      if (unreadOnly && email.isRead) return false;
      if (starredOnly && !email.isStarred) return false;

      // Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSubject = email.subject.toLowerCase().includes(q);
        const matchFrom = email.fromName.toLowerCase().includes(q) || email.fromEmail.toLowerCase().includes(q);
        const matchBody = email.bodyText.toLowerCase().includes(q);
        const matchVessel = email.vesselName?.toLowerCase().includes(q);
        const matchAirport = email.airportCode?.toLowerCase().includes(q);
        if (!matchSubject && !matchFrom && !matchBody && !matchVessel && !matchAirport) {
          return false;
        }
      }

      return true;
    });
  }, [emails, selectedFolder, selectedLabel, unreadOnly, starredOnly, searchQuery]);

  // Active Selected Email Detail
  const selectedEmail = useMemo(() => {
    return emails.find((e) => e.id === selectedEmailId) || null;
  }, [emails, selectedEmailId]);

  // Mark as read when selected
  const handleSelectEmail = (email: EmailMessage) => {
    setSelectedEmailId(email.id);
    if (!email.isRead) {
      setEmails((prev) =>
        prev.map((item) => (item.id === email.id ? { ...item, isRead: true } : item))
      );
    }
  };

  // Toggle Star
  const handleToggleStar = (e: React.MouseEvent, emailId: string) => {
    e.stopPropagation();
    setEmails((prev) =>
      prev.map((item) =>
        item.id === emailId ? { ...item, isStarred: !item.isStarred } : item
      )
    );
  };

  // Toggle Selection
  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredEmails.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEmails.map((e) => e.id));
    }
  };

  const handleToggleSelectOne = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Bulk Actions
  const handleBulkMarkRead = (readStatus: boolean) => {
    setEmails((prev) =>
      prev.map((m) => (selectedIds.includes(m.id) ? { ...m, isRead: readStatus } : m))
    );
    showToast(`${selectedIds.length} 件のメールを${readStatus ? "既読" : "未読"}にしました`);
    setSelectedIds([]);
  };

  const handleBulkMoveFolder = (folder: EmailFolder) => {
    setEmails((prev) =>
      prev.map((m) => (selectedIds.includes(m.id) ? { ...m, folder } : m))
    );
    showToast(`${selectedIds.length} 件のメールを ${folder} へ移動しました`);
    setSelectedIds([]);
    if (selectedEmailId && selectedIds.includes(selectedEmailId)) {
      setSelectedEmailId(null);
    }
  };

  const handleBulkDeletePermanent = () => {
    setEmails((prev) => prev.filter((m) => !selectedIds.includes(m.id)));
    showToast(`${selectedIds.length} 件のメールを完全に削除しました`);
    setSelectedIds([]);
    if (selectedEmailId && selectedIds.includes(selectedEmailId)) {
      setSelectedEmailId(null);
    }
  };

  // Single Action
  const handleMoveToTrash = (emailId: string) => {
    setEmails((prev) =>
      prev.map((m) => (m.id === emailId ? { ...m, folder: "trash" } : m))
    );
    showToast("ゴミ箱へ移動しました");
    if (selectedEmailId === emailId) setSelectedEmailId(null);
  };

  // Open Reply
  const handleReply = (email: EmailMessage) => {
    setComposeTo(email.fromEmail);
    setComposeSubject(email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
    setComposeVessel(email.vesselName || "");
    setComposeAirport(email.airportCode || "");
    setComposeBody(
      `\n\n--------------------------------------------------\n${email.receivedAt.slice(0, 16)} ${email.fromName} (${email.fromEmail}) 書込:\n> ${email.bodyText.replace(/\n/g, "\n> ")}`
    );
    setIsComposeOpen(true);
  };

  // Send Email Handler
  const handleSendEmail = async () => {
    if (!composeTo.trim()) {
      alert("送信先メールアドレスを入力してください。");
      return;
    }
    if (!composeSubject.trim()) {
      alert("件名を入力してください。");
      return;
    }

    setIsSending(true);

    const commonAddress = settingsForm.commonEmail?.trim() || emailServerSettings?.commonEmail || "spares-common@shipping-air.jp";
    const senderDisplayName = settingsForm.senderName?.trim() || emailServerSettings?.senderName || "TACエアサービス 船用品営業部";

    // Auto append signature if set and not already present
    let finalBodyText = composeBody;
    if (settingsForm.signatureText && !finalBodyText.includes(settingsForm.signatureText.trim())) {
      finalBodyText = `${finalBodyText.trim()}\n\n${settingsForm.signatureText.trim()}`;
    }

    try {
      let sentSuccess = true;
      if (onSendEmailApi) {
        sentSuccess = await onSendEmailApi(composeTo, composeSubject, finalBodyText);
      } else {
        const resp = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: composeTo,
            subject: composeSubject,
            bodyText: finalBodyText,
            fromName: senderDisplayName,
            fromEmail: commonAddress,
            settings: settingsForm,
          }),
        });
        sentSuccess = resp.ok;
      }

      if (sentSuccess) {
        // Create new sent email message record with configured common email address
        const newSentMsg: EmailMessage = {
          id: `email-${Date.now()}`,
          fromName: `${senderDisplayName} (${currentUser.name})`,
          fromEmail: commonAddress,
          toEmail: composeTo,
          ccEmail: composeCc,
          subject: composeSubject,
          bodyText: finalBodyText,
          receivedAt: new Date().toISOString(),
          isRead: true,
          isStarred: false,
          folder: "sent",
          labels: ["送信済", ...(composeAirport ? [composeAirport] : [])],
          vesselName: composeVessel || undefined,
          airportCode: composeAirport || undefined,
        };

        setEmails((prev) => [newSentMsg, ...prev]);
        showToast(`メールを送信完了しました！ (送信元: ${commonAddress})`);
        setIsComposeOpen(false);
        // Reset compose form
        setComposeTo("");
        setComposeCc("");
        setComposeSubject("");
        setComposeBody("");
        setComposeVessel("");
        setComposeAirport("");
      } else {
        alert("メール送信中にエラーが発生しました。");
      }
    } catch (err) {
      console.error(err);
      alert("メール送信APIの呼び出しに失敗しました。");
    } finally {
      setIsSending(false);
    }
  };

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showRefreshToken, setShowRefreshToken] = useState(false);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  const [settingsForm, setSettingsForm] = useState<EmailServerSettings>(() => {
    if (emailServerSettings) return emailServerSettings;
    return {
      commonEmail: "spares-common@shipping-air.jp",
      senderName: "TACエアサービス 船用品営業部",
      incomingProtocol: "IMAP",
      incomingHost: "imap.gmail.com",
      incomingPort: 993,
      incomingEncryption: "SSL/TLS",
      outgoingHost: "smtp.gmail.com",
      outgoingPort: 587,
      outgoingEncryption: "STARTTLS",
      authUsername: "spares-common@shipping-air.jp",
      authPassword: "••••••••••••",
      authMethod: "PASSWORD",
      oauthClientId: "",
      oauthClientSecret: "",
      oauthRefreshToken: "",
      oauthTenantId: "",
      syncIntervalMinutes: 5,
      signatureText: `--------------------------------------------------\nTACエアサービス 船用品営業部\nEmail: spares-common@shipping-air.jp`,
    };
  });

  React.useEffect(() => {
    if (emailServerSettings) {
      setSettingsForm(emailServerSettings);
    }
  }, [emailServerSettings]);

  const applyPresetGoogleOAuth2 = () => {
    setSettingsForm((prev) => ({
      ...prev,
      incomingProtocol: "IMAP",
      incomingHost: "imap.gmail.com",
      incomingPort: 993,
      incomingEncryption: "SSL/TLS",
      outgoingHost: "smtp.gmail.com",
      outgoingPort: 587,
      outgoingEncryption: "STARTTLS",
      authMethod: "OAUTH2_GMAIL",
      oauthClientId: prev.oauthClientId || "102938475610-example.apps.googleusercontent.com",
      oauthTenantId: "",
    }));
    showToast("✨ Google Workspace (Gmail) OAuth2 Modern Auth プリセットを適用しました");
  };

  const applyPresetOutlookOAuth2 = () => {
    setSettingsForm((prev) => ({
      ...prev,
      incomingProtocol: "IMAP",
      incomingHost: "outlook.office365.com",
      incomingPort: 993,
      incomingEncryption: "SSL/TLS",
      outgoingHost: "smtp.office365.com",
      outgoingPort: 587,
      outgoingEncryption: "STARTTLS",
      authMethod: "OAUTH2_OUTLOOK",
      oauthClientId: prev.oauthClientId || "00000000-0000-0000-0000-000000000000",
      oauthTenantId: prev.oauthTenantId || "common",
    }));
    showToast("✨ Microsoft 365 (Outlook) OAuth2 Modern Auth プリセットを適用しました");
  };

  const handleSaveSettings = () => {
    if (!settingsForm.commonEmail.trim() || !settingsForm.incomingHost.trim() || !settingsForm.outgoingHost.trim()) {
      alert("共通メールアドレス、受信サーバー、送信サーバーの入力は必須です。");
      return;
    }
    if (onUpdateEmailServerSettings) {
      onUpdateEmailServerSettings(settingsForm);
    }
    showToast("⚙️ メールサーバー・アカウント共有設定を保存しました（Firestore同期）");
    setIsSettingsOpen(false);
  };

  const handleTestConnection = async () => {
    setIsTestingConn(true);
    setTestResult(null);

    const isOauth = settingsForm.authMethod && settingsForm.authMethod !== "PASSWORD";
    const authLabel = isOauth
      ? `OAuth2 Modern Auth (${settingsForm.authMethod === "OAUTH2_GMAIL" ? "Google Workspace" : settingsForm.authMethod === "OAUTH2_OUTLOOK" ? "Microsoft 365" : "カスタム OAuth2"})`
      : "アプリパスワード (Basic Auth)";

    try {
      const res = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: settingsForm }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data: any;
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const textErr = await res.text();
        throw new Error(`サーバー応答エラー: ${textErr.slice(0, 80)}`);
      }

      setIsTestingConn(false);

      if (data.success) {
        setTestResult({
          success: true,
          msg: data.message || `【${authLabel} 接続テスト成功】通信・ハンドシェイクが正常に完了しました。`,
        });
        showToast(`⚡ 接続テスト成功: ${authLabel} の通信を確認しました`);
      } else {
        setTestResult({
          success: false,
          msg: `【接続テストエラー】${data.error || "設定内容をご確認ください。"}`,
        });
        showToast(`⚠️ 接続テスト不一致: ${data.error || "認証情報を確認してください"}`);
      }
    } catch (err: any) {
      setIsTestingConn(false);
      setTestResult({
        success: false,
        msg: `【通信エラー】接続テスト処理中にエラーが発生しました: ${err?.message || "ネットワークエラー"}`,
      });
      showToast(`⚠️ 接続テスト通信エラー: ${err?.message || "ネットワークエラー"}`);
    }
  };

  // Real IMAP Mail Fetch State
  const [isFetchingMail, setIsFetchingMail] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string>("");
  const [lastFetchedTime, setLastFetchedTime] = useState<string>(() => {
    return new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  });

  // Real Fetch Messages from IMAP Server via Backend API
  const handleFetchMail = async () => {
    if (isFetchingMail) return;
    setIsFetchingMail(true);

    const proto = settingsForm.incomingProtocol || "IMAP";
    const host = settingsForm.incomingHost || "imap.gmail.com";
    const port = settingsForm.incomingPort || 993;
    const commonAddr = settingsForm.commonEmail || "spares-common@shipping-air.jp";

    try {
      const res = await fetch("/api/fetch-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: settingsForm,
          limit: 10,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data: any;
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const textErr = await res.text();
        throw new Error(`サーバーレスポンス形式エラー: ${textErr.slice(0, 100)}`);
      }
      const timeStr = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setLastFetchedTime(timeStr);

      if (data.success && Array.isArray(data.emails)) {
        if (data.emails.length > 0) {
          setEmails((prev) => {
            const existingIds = new Set(prev.map((e) => e.id));
            const newEmails = data.emails.filter((e: EmailMessage) => !existingIds.has(e.id));
            return [...newEmails, ...prev];
          });
          setSelectedFolder("inbox");
          showToast(`📬 本番メール受信完了 (${timeStr}): [${proto}] ${host}:${port} から ${data.emails.length} 件の実メールを受信トレイに同期しました。`);
        } else {
          showToast(`📬 本番メール受信チェック (${timeStr}): [${proto}] ${host}:${port} に新着メッセージはありません。`);
        }
      } else {
        showToast(`⚠️ 本番IMAP受信エラー: ${data.error || "サーバー接続失敗。設定画面のパスワードを確認してください。"}`);
      }
    } catch (err: any) {
      console.error("[Mail Fetch Exception]", err);
      showToast(`⚠️ 受信通信エラー: バックエンドAPIに接続できませんでした。(${err?.message || "ネットワークエラー"})`);
    } finally {
      setIsFetchingMail(false);
    }
  };

  // Full Email Data Sync handler (Real IMAP / POP3 Backend Fetch)
  const handleSyncAllEmails = async () => {
    if (isSyncingAll) return;
    setIsSyncingAll(true);
    const commonAddr = settingsForm.commonEmail || "spares-common@shipping-air.jp";
    const proto = settingsForm.incomingProtocol || "IMAP";
    const host = settingsForm.incomingHost || "imap.gmail.com";
    const port = settingsForm.incomingPort || 993;

    setSyncProgress(`本番サーバー接続中: ${host}:${port} (${proto})...`);

    try {
      setSyncProgress("フォルダインデックス解析 & 本番メール全件同期中...");
      const res = await fetch("/api/fetch-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: settingsForm,
          limit: 100,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data: any;
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const textErr = await res.text();
        throw new Error(`サーバーレスポンス形式エラー: ${textErr.slice(0, 100)}`);
      }
      const timeStr = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setLastFetchedTime(timeStr);

      if (data.success && Array.isArray(data.emails)) {
        setEmails((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const newEmails = data.emails.filter((e: EmailMessage) => !existingIds.has(e.id));
          return [...newEmails, ...prev];
        });
        setSelectedFolder("inbox");
        setTestResult({
          success: true,
          msg: `【本番全データ同期成功 ${timeStr}】[${proto}] ${host}:${port} から実メール ${data.emails.length}件 を正常取得・同期完了しました。`,
        });
        showToast(`🔄 [${proto}] 本番メール全データ同期完了: ${data.emails.length}件をサーバーから取得・反映しました。`);
      } else {
        setTestResult({
          success: false,
          msg: `【本番同期失敗】${data.error || "IMAPサーバーへの認証に失敗しました。サーバー・認証情報(パスワード)を確認してください。"}`,
        });
        showToast(`⚠️ 本番IMAP同期失敗: ${data.error || "設定情報をご確認ください。"}`);
      }
    } catch (err: any) {
      console.error("[Full Sync Exception]", err);
      setTestResult({
        success: false,
        msg: `【通信エラー】本番同期処理中にエラーが発生しました: ${err?.message || "不明なエラー"}`,
      });
      showToast(`⚠️ 本番同期通信エラー: ${err?.message || "接続失敗"}`);
    } finally {
      setIsSyncingAll(false);
      setSyncProgress("");
    }
  };

  // Copy Common Email Address
  const handleCopyCommonEmail = () => {
    navigator.clipboard.writeText(settingsForm.commonEmail || "spares-common@shipping-air.jp");
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Preset Templates
  const applyTemplate = (type: "quote_ack" | "space_confirm" | "delivery_complete") => {
    if (type === "quote_ack") {
      setComposeSubject("【受託御礼】船用品エアー輸送見積のご依頼を承りました");
      setComposeBody(`お世話になっております。TACエアサービス 船用品営業部でございます。

この度は船用品航空輸送見積のご依頼をいただき、誠にありがとうございます。
ご提示いただきました貨物明細および希望スケジュールに基づき、現在最適な航空便（直行便/経由便）のスペース確認および概算運賃の算出を進めております。

見積回答が整い次第、速やかにご連絡いたします。
今しばらくお待ちいただけますようお願い申し上げます。

--------------------------------------------------
TACエアサービス 船用品営業部
Email: spares-common@shipping-air.jp
`);
    } else if (type === "space_confirm") {
      setComposeSubject("【回答】航空便スペース確認および概算運賃のご案内");
      setComposeBody(`お世話になっております。TACエアサービス 船用品営業部でございます。

お問い合わせの案件につきまして、指定航空会社（SQ/JL/TG等）のスペース確保状況と概算運賃をお知らせいたします。

■ 概算運賃合計: JPY ________-
■ スペース状況: 確保済み（便名: ______ / 発時刻: ______）

手配を進める場合は、本メールへのご返信またはシステム上での受託承認をお願いいたします。

よろしくお願いいたします。
--------------------------------------------------
TACエアサービス 船用品営業部
`);
    } else if (type === "delivery_complete") {
      setComposeSubject("【完了報告】本船納入完了およびデリバリーレシートのご連絡");
      setComposeBody(`お世話になっております。TACエアサービス 船用品営業部でございます。

対象貨物の現地通関および本船船側への納入が無事に完了いたしました。
サイン受領済みのデリバリーレシート（D/R）を添付いたします。

ご利用誠にありがとうございました。
またのご用命を心よりお待ち申し上げております。

--------------------------------------------------
TACエアサービス 船用品営業部
`);
    }
  };

  const isDark = currentTheme === "dark" || currentTheme === "digital";

  return (
    <div className={`h-[calc(100vh-65px)] flex flex-col ${isDark ? "bg-[#050b14] text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      {/* Top Banner & Search Header */}
      <div className={`border-b px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 ${isDark ? "bg-slate-900/90 border-slate-800" : "bg-white border-slate-200 shadow-2xs"}`}>
        {/* Left Title & Common Email Badge */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 via-red-500 to-amber-500 text-white flex items-center justify-center shadow-md">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-sm sm:text-base tracking-tight flex items-center gap-1.5">
                船用品共通メール <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 font-bold flex items-center gap-1"><Server className="w-3 h-3" /> 全員共有DB連携</span>
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
              <span>共通アドレス: <strong className="text-sky-600 font-mono">{settingsForm.commonEmail || "spares-common@shipping-air.jp"}</strong></span>
              <button
                onClick={handleCopyCommonEmail}
                className="hover:text-sky-600 inline-flex items-center gap-1 p-0.5 rounded transition-colors"
                title="共通アドレスをコピー"
              >
                {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="flex-1 max-w-xl mx-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="メール検索 (件名、送信者、本文、船名、SIN/BKK...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-8 py-2 text-xs font-bold rounded-xl border focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all ${
                isDark
                  ? "bg-slate-950/80 border-slate-700 text-slate-100 placeholder-slate-500"
                  : "bg-slate-100/90 border-slate-300 text-slate-900 placeholder-slate-500"
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Toggles & Manual Fetch */}
        <div className="flex items-center gap-2 text-xs font-bold">
          <button
            onClick={handleFetchMail}
            disabled={isFetchingMail}
            className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-75"
            title="設定された受信サーバー(IMAP/POP3)から最新メールを手動受信"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetchingMail ? "animate-spin" : ""}`} />
            <span>{isFetchingMail ? "受信中..." : "メール受信"}</span>
          </button>

          <button
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all ${
              unreadOnly
                ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                : isDark
                ? "bg-slate-800 border-slate-700 text-slate-300"
                : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>未読のみ</span>
          </button>
          <button
            onClick={() => setStarredOnly(!starredOnly)}
            className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all ${
              starredOnly
                ? "bg-amber-500 text-slate-950 border-amber-500 font-black shadow-xs"
                : isDark
                ? "bg-slate-800 border-slate-700 text-slate-300"
                : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
            <span>スターのみ</span>
          </button>

          <button
            onClick={() => {
              setTestResult(null);
              setIsSettingsOpen(true);
            }}
            className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
            title="アドレス・サーバー・ポート・認証設定を変更 (Firestore全員共有)"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>サーバー・ポート設定</span>
          </button>
        </div>
      </div>

      {/* Main Mail View Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Gmail Left Navigation Sidebar */}
        <aside className={`w-56 sm:w-64 border-r flex flex-col p-3 shrink-0 select-none ${isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200"}`}>
          {/* Action Buttons (Compose & Receive) */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => {
                setComposeTo("");
                setComposeCc("");
                setComposeSubject("");
                setComposeBody("");
                setIsComposeOpen(true);
              }}
              className="flex-1 py-3 px-3 bg-gradient-to-r from-rose-500 via-rose-600 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>作成</span>
            </button>
            <button
              onClick={handleFetchMail}
              disabled={isFetchingMail}
              className="py-3 px-3.5 bg-sky-600 hover:bg-sky-700 text-white font-black text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-75"
              title="設定された受信サーバーから即時メール受信"
            >
              <RefreshCw className={`w-4 h-4 ${isFetchingMail ? "animate-spin" : ""}`} />
              <span>{isFetchingMail ? "受信中" : "手動受信"}</span>
            </button>
          </div>

          {/* Folders Menu */}
          <div className="space-y-1 text-xs font-bold">
            <button
              onClick={() => {
                setSelectedFolder("inbox");
                setSelectedLabel(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                selectedFolder === "inbox" && !selectedLabel
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 font-black shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Inbox className="w-4 h-4 text-rose-500" />
                <span>受信トレイ (Inbox)</span>
              </div>
              {folderCounts.inbox > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
                  {folderCounts.inbox}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setSelectedFolder("starred");
                setSelectedLabel(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                selectedFolder === "starred" && !selectedLabel
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>スター付き (Starred)</span>
              </div>
              {folderCounts.starred > 0 && (
                <span className="text-[11px] text-slate-400 font-bold">{folderCounts.starred}</span>
              )}
            </button>

            <button
              onClick={() => {
                setSelectedFolder("sent");
                setSelectedLabel(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                selectedFolder === "sent" && !selectedLabel
                  ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-black"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Send className="w-4 h-4 text-sky-500" />
                <span>送信済み (Sent)</span>
              </div>
              {folderCounts.sent > 0 && (
                <span className="text-[11px] text-slate-400 font-bold">{folderCounts.sent}</span>
              )}
            </button>

            <button
              onClick={() => {
                setSelectedFolder("drafts");
                setSelectedLabel(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                selectedFolder === "drafts" && !selectedLabel
                  ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 font-black"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-purple-500" />
                <span>下書き (Drafts)</span>
              </div>
              {folderCounts.drafts > 0 && (
                <span className="text-[11px] text-slate-400 font-bold">{folderCounts.drafts}</span>
              )}
            </button>

            <button
              onClick={() => {
                setSelectedFolder("trash");
                setSelectedLabel(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                selectedFolder === "trash" && !selectedLabel
                  ? "bg-slate-500/10 text-slate-700 dark:text-slate-300 font-black"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Trash2 className="w-4 h-4 text-slate-400" />
                <span>ゴミ箱 (Trash)</span>
              </div>
              {folderCounts.trash > 0 && (
                <span className="text-[11px] text-slate-400 font-bold">{folderCounts.trash}</span>
              )}
            </button>
          </div>

          {/* Labels Section */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="px-3 mb-2 flex items-center justify-between text-xs font-black text-slate-400 uppercase tracking-wider">
              <span>ラベル分類</span>
              <Tag className="w-3.5 h-3.5" />
            </div>

            <div className="space-y-0.5 text-xs font-bold">
              {allLabels.map((lbl) => (
                <button
                  key={lbl}
                  onClick={() => setSelectedLabel(selectedLabel === lbl ? null : lbl)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all ${
                    selectedLabel === lbl
                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 font-black"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                  <span className="truncate">{lbl}</span>
                </button>
              ))}
            </div>
          </div>

          {/* System Info Box at Bottom */}
          <div className="mt-auto pt-4 space-y-2">
            <button
              onClick={() => {
                setTestResult(null);
                setIsSettingsOpen(true);
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 transition-all hover:border-slate-500 active:scale-95 shadow-xs"
            >
              <Settings className="w-4 h-4 text-rose-400" />
              <span>サーバー・アカウント共有設定</span>
            </button>
            <div className={`p-3 rounded-xl border text-[11px] space-y-1 ${isDark ? "bg-slate-950/60 border-slate-800 text-slate-400" : "bg-sky-50 border-sky-200 text-sky-900"}`}>
              <div className="font-bold flex items-center gap-1.5 text-rose-500">
                <Zap className="w-3.5 h-3.5 fill-rose-500" /> バックグラウンド即時送信
              </div>
              <p className="leading-tight text-[10px]">
                全メールは共有サーバー設定に従い自動送信。受信設定もFirestoreで永続同期されます。
              </p>
            </div>
          </div>
        </aside>

        {/* Email List Column */}
        <section className={`w-full md:w-5/12 border-r flex flex-col overflow-hidden ${isDark ? "bg-slate-950/40 border-slate-800" : "bg-white border-slate-200"}`}>
          {/* List Bulk Action Bar */}
          <div className={`px-4 py-2 border-b flex items-center justify-between gap-2 text-xs font-bold ${isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleSelectAll}
                className="hover:text-rose-500 flex items-center gap-1.5 transition-colors"
                title="全選択 / 解除"
              >
                {selectedIds.length > 0 && selectedIds.length === filteredEmails.length ? (
                  <CheckSquare className="w-4 h-4 text-rose-500" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
              </button>
              <span className="text-slate-500 text-[11px]">
                {selectedIds.length > 0 ? `${selectedIds.length}件 選択中` : `${filteredEmails.length}件`}
              </span>
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleBulkMarkRead(true)}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300"
                  title="既読にする"
                >
                  <MailOpen className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleBulkMarkRead(false)}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300"
                  title="未読にする"
                >
                  <Mail className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleBulkMoveFolder("trash")}
                  className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded-lg text-rose-500"
                  title="ゴミ箱へ移動"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Email Items Scroll List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800/60">
            {filteredEmails.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Mail className="w-10 h-10 mx-auto stroke-1 opacity-50" />
                <p className="text-xs font-bold">メールが見つかりませんでした</p>
              </div>
            ) : (
              filteredEmails.map((email) => {
                const isSelected = selectedEmailId === email.id;
                const isChecked = selectedIds.includes(email.id);

                return (
                  <div
                    key={email.id}
                    onClick={() => handleSelectEmail(email)}
                    className={`p-3 sm:p-4 cursor-pointer transition-all flex items-start gap-3 relative ${
                      isSelected
                        ? isDark
                          ? "bg-slate-800/90 border-l-4 border-l-rose-500"
                          : "bg-rose-50/70 border-l-4 border-l-rose-500"
                        : !email.isRead
                        ? isDark
                          ? "bg-slate-900/90 font-bold"
                          : "bg-white font-extrabold shadow-2xs"
                        : isDark
                        ? "bg-slate-950/40 opacity-80 hover:bg-slate-900/50"
                        : "bg-slate-50/40 opacity-90 hover:bg-slate-100/80"
                    }`}
                  >
                    {/* Select Checkbox & Star Button */}
                    <div className="flex flex-col items-center gap-2 pt-0.5 shrink-0">
                      <button onClick={(e) => handleToggleSelectOne(e, email.id)}>
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-rose-500" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 hover:text-slate-400" />
                        )}
                      </button>
                      <button onClick={(e) => handleToggleStar(e, email.id)}>
                        <Star
                          className={`w-4 h-4 transition-colors ${
                            email.isStarred
                              ? "fill-amber-400 text-amber-500"
                              : "text-slate-300 dark:text-slate-600 hover:text-amber-400"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Email Content Snippet Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`text-xs truncate ${!email.isRead ? "font-black text-rose-600 dark:text-rose-400" : "font-bold text-slate-800 dark:text-slate-200"}`}>
                          {email.fromName || email.fromEmail}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {new Date(email.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <h4 className={`text-xs truncate mb-1 ${!email.isRead ? "font-black text-slate-950 dark:text-white" : "font-semibold text-slate-700 dark:text-slate-300"}`}>
                        {email.subject}
                      </h4>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-relaxed">
                        {email.bodyText.replace(/\n/g, " ")}
                      </p>

                      {/* Labels / Tags Pills */}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {email.vesselName && (
                          <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold text-[10px] flex items-center gap-1 border border-sky-500/20">
                            <Ship className="w-3 h-3" /> {email.vesselName}
                          </span>
                        )}
                        {email.airportCode && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-[10px]">
                            ✈️ {email.airportCode}
                          </span>
                        )}
                        {email.labels?.map((lbl) => (
                          <span key={lbl} className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 font-bold text-[10px]">
                            {lbl}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Email Detail / Reading Pane */}
        <main className={`hidden md:flex flex-1 flex-col overflow-hidden ${isDark ? "bg-slate-950" : "bg-white"}`}>
          {selectedEmail ? (
            <div className="h-full flex flex-col overflow-hidden">
              {/* Detail Toolbar */}
              <div className={`px-6 py-3 border-b flex items-center justify-between gap-3 shrink-0 ${isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReply(selectedEmail)}
                    className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                  >
                    <Reply className="w-3.5 h-3.5" /> 返信 (Reply)
                  </button>
                  <button
                    onClick={() => handleReply(selectedEmail)}
                    className={`px-3 py-1.5 rounded-lg border font-bold text-xs flex items-center gap-1.5 ${isDark ? "border-slate-700 hover:bg-slate-800 text-slate-300" : "border-slate-300 hover:bg-slate-100 text-slate-700"}`}
                  >
                    <Forward className="w-3.5 h-3.5" /> 転送
                  </button>

                  {/* Create Quote from Email Action Button */}
                  {onCreateQuoteFromEmail && (
                    <button
                      onClick={() => {
                        onCreateQuoteFromEmail(selectedEmail);
                        showToast("🎉 このメールから見積案件を新規作成しました！");
                      }}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all ml-2"
                      title="メールの内容から自動で見積案件（カンバンカード）を作成します"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>見積案件を作成 (カンバン連動)</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleMoveToTrash(selectedEmail.id)}
                    className="p-2 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded-lg text-rose-500 transition-colors"
                    title="ゴミ箱へ移動"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Email Content Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Subject Heading */}
                <div className="border-b pb-4 border-slate-200 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 leading-snug">
                      {selectedEmail.subject}
                    </h1>
                    <button onClick={(e) => handleToggleStar(e, selectedEmail.id)}>
                      <Star
                        className={`w-5 h-5 ${
                          selectedEmail.isStarred
                            ? "fill-amber-400 text-amber-500"
                            : "text-slate-300 dark:text-slate-600 hover:text-amber-400"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Badges / Vessel Header */}
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedEmail.vesselName && (
                      <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 font-bold text-xs flex items-center gap-1.5 border border-sky-500/30">
                        <Ship className="w-4 h-4" /> 本船: {selectedEmail.vesselName}
                      </span>
                    )}
                    {selectedEmail.airportCode && (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs flex items-center gap-1 border border-emerald-500/30">
                        ✈️ 到着空港: {selectedEmail.airportCode}
                      </span>
                    )}
                  </div>
                </div>

                {/* Sender & Receiver Info Header */}
                <div className="flex items-start justify-between gap-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rose-500 to-amber-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                      {selectedEmail.fromName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-black text-sm text-slate-900 dark:text-slate-100">
                        {selectedEmail.fromName}{" "}
                        <span className="font-mono text-xs text-slate-400 font-semibold">
                          &lt;{selectedEmail.fromEmail}&gt;
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-bold mt-0.5">
                        宛先 (To): <span className="font-mono text-slate-700 dark:text-slate-300">{selectedEmail.toEmail}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 font-mono font-bold shrink-0">
                    {new Date(selectedEmail.receivedAt).toLocaleString("ja-JP")}
                  </div>
                </div>

                {/* Message Text Body */}
                <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-900">
                  {selectedEmail.bodyText}
                </div>

                {/* Bottom Quick Reply Action Box */}
                <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  <button
                    onClick={() => handleReply(selectedEmail)}
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all"
                  >
                    <Reply className="w-4 h-4" /> 返信用コンポーザーを開く
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 space-y-3">
              <Mail className="w-16 h-16 stroke-1 opacity-40 text-rose-500" />
              <p className="text-sm font-bold text-slate-500">メールを選択して本文を閲覧してください</p>
            </div>
          )}
        </main>
      </div>

      {/* Gmail Compose Popup Modal */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm">
                <Mail className="w-4 h-4 text-rose-400" />
                <span>新規メッセージを作成 (ワンクリックバックグラウンド送信)</span>
              </div>
              <button
                onClick={() => setIsComposeOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Template Preset Bar */}
            <div className="bg-slate-100 dark:bg-slate-950 px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs font-bold overflow-x-auto no-scrollbar">
              <span className="text-slate-500 shrink-0">⚡ 定型文テンプレート:</span>
              <button
                type="button"
                onClick={() => applyTemplate("quote_ack")}
                className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 shrink-0 transition-colors"
              >
                受託御礼メール
              </button>
              <button
                type="button"
                onClick={() => applyTemplate("space_confirm")}
                className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 shrink-0 transition-colors"
              >
                スペース・見積回答
              </button>
              <button
                type="button"
                onClick={() => applyTemplate("delivery_complete")}
                className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 shrink-0 transition-colors"
              >
                本船納入完了報告
              </button>
            </div>

            {/* Form Inputs */}
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              {/* Common Email Sender Info Banner */}
              <div className="bg-slate-100 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 shrink-0">送信元 (From):</span>
                  <span className="font-mono text-rose-600 dark:text-rose-400 font-black">
                    {settingsForm.commonEmail || "spares-common@shipping-air.jp"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
                    ({settingsForm.senderName || "共通メールアドレス"})
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold shrink-0">
                  共有サーバー設定
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">送信先 (To):</label>
                <input
                  type="email"
                  placeholder="例: s.suzuki@toyo-maritime.co.jp"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">件名 (Subject):</label>
                <input
                  type="text"
                  placeholder="件名を入力..."
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Optional Metadata (Vessel / Airport) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">関連本船名 (任意):</label>
                  <input
                    type="text"
                    placeholder="M/V PACIFIC WAVE"
                    value={composeVessel}
                    onChange={(e) => setComposeVessel(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">到着空港コード (IATA):</label>
                  <input
                    type="text"
                    placeholder="SIN, BKK, RTM..."
                    value={composeAirport}
                    onChange={(e) => setComposeAirport(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-bold font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">本文 (Body):</label>
                <textarea
                  rows={8}
                  placeholder="メール本文を入力..."
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  className="w-full p-3 text-xs font-sans rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-rose-500 leading-relaxed"
                />
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsComposeOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                キャンセル
              </button>

              <button
                type="button"
                disabled={isSending}
                onClick={handleSendEmail}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 transition-all disabled:opacity-50 active:scale-95"
              >
                {isSending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>送信中...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 stroke-[2.5]" />
                    <span>ワンクリックバックグラウンド送信</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Server Settings Modal (Firestore Shared) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 text-slate-100 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center shadow-md">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white flex items-center gap-2">
                    共通メール サーバー・ポート共有設定
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold">
                      Firestore全員共有
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    受信(IMAP/POP3)・送信(SMTP)・ポート設定・共通アドレス等の共有データ設定
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs font-bold">
              {/* 1. 共通送信元情報 */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-rose-400 font-black border-b border-slate-800 pb-2 text-xs">
                  <Mail className="w-4 h-4" />
                  <span>基本情報 & 共通送信元アドレス</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">共通メールアドレス (Full Address):</label>
                    <input
                      type="email"
                      value={settingsForm.commonEmail}
                      onChange={(e) => setSettingsForm({ ...settingsForm, commonEmail: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:border-rose-500 focus:outline-none"
                      placeholder="spares-common@shipping-air.jp"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">送信者表示名 (Sender Display Name):</label>
                    <input
                      type="text"
                      value={settingsForm.senderName}
                      onChange={(e) => setSettingsForm({ ...settingsForm, senderName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 focus:border-rose-500 focus:outline-none"
                      placeholder="TACエアサービス 船用品営業部"
                    />
                  </div>
                </div>
              </div>

              {/* 2. 受信サーバー設定 (IMAP / POP3) */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-sky-400 font-black border-b border-slate-800 pb-2 text-xs">
                  <Inbox className="w-4 h-4" />
                  <span>受信サーバー設定 (IMAP / POP3 / Gmail API)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">プロトコル:</label>
                    <select
                      value={settingsForm.incomingProtocol}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          incomingProtocol: e.target.value as any,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 focus:border-sky-500 focus:outline-none"
                    >
                      <option value="IMAP">IMAP</option>
                      <option value="POP3">POP3</option>
                      <option value="Gmail API">Gmail API</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 mb-1">受信サーバーホスト (Host / Server):</label>
                    <input
                      type="text"
                      value={settingsForm.incomingHost}
                      onChange={(e) => setSettingsForm({ ...settingsForm, incomingHost: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
                      placeholder="imap.gmail.com"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">ポート番号 (Port):</label>
                    <input
                      type="number"
                      value={settingsForm.incomingPort}
                      onChange={(e) => setSettingsForm({ ...settingsForm, incomingPort: parseInt(e.target.value) || 993 })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
                      placeholder="993"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">受信暗号化方式 (Encryption):</label>
                  <select
                    value={settingsForm.incomingEncryption}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        incomingEncryption: e.target.value as any,
                      })
                    }
                    className="w-full sm:w-1/2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="SSL/TLS">SSL / TLS (推奨)</option>
                    <option value="STARTTLS">STARTTLS</option>
                    <option value="NONE">暗号化なし (平文)</option>
                  </select>
                </div>
              </div>

              {/* 3. 送信サーバー設定 (SMTP) */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-black border-b border-slate-800 pb-2 text-xs">
                  <Send className="w-4 h-4" />
                  <span>送信サーバー設定 (SMTP)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 mb-1">SMTP送信サーバーホスト:</label>
                    <input
                      type="text"
                      value={settingsForm.outgoingHost}
                      onChange={(e) => setSettingsForm({ ...settingsForm, outgoingHost: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">送信ポート番号 (Port):</label>
                    <input
                      type="number"
                      value={settingsForm.outgoingPort}
                      onChange={(e) => setSettingsForm({ ...settingsForm, outgoingPort: parseInt(e.target.value) || 587 })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
                      placeholder="587"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">送信暗号化方式 (Encryption):</label>
                  <select
                    value={settingsForm.outgoingEncryption}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        outgoingEncryption: e.target.value as any,
                      })
                    }
                    className="w-full sm:w-1/2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="STARTTLS">STARTTLS (587番ポート用)</option>
                    <option value="SSL/TLS">SSL / TLS (465番ポート用)</option>
                    <option value="NONE">暗号化なし (25番ポート用)</option>
                  </select>
                </div>
              </div>

              {/* 4. アカウント認証 & 同期設定 (OAuth2 / Modern Auth 対応) */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-400 font-black">
                    <ShieldCheck className="w-4 h-4" />
                    <span>認証方式 & 資格情報 (IMAP / SMTP / Modern Auth)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                    {settingsForm.authMethod && settingsForm.authMethod !== "PASSWORD" ? "OAuth2 Modern Auth Active" : "Basic Auth (Password)"}
                  </span>
                </div>

                {/* 認証方式セレクター */}
                <div>
                  <label className="block text-slate-300 font-black mb-1.5 flex items-center justify-between">
                    <span>IMAP / SMTP 認証方式 (Authentication Method):</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Google Workspace / Microsoft 365 の Modern Auth (XOAUTH2) 対応
                    </span>
                  </label>
                  <select
                    value={settingsForm.authMethod || "PASSWORD"}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        authMethod: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-bold focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="PASSWORD">🔑 パスワード / アプリパスワード認証 (Basic Auth)</option>
                    <option value="OAUTH2_GMAIL">🌐 OAuth2 / Modern Auth (Google Workspace / Gmail XOAUTH2)</option>
                    <option value="OAUTH2_OUTLOOK">💼 OAuth2 / Modern Auth (Microsoft 365 / Outlook XOAUTH2)</option>
                    <option value="OAUTH2_CUSTOM">⚙️ OAuth2 / Modern Auth (カスタム Client ID & Token)</option>
                  </select>
                </div>

                {/* プリセット適用ボタン (OAuth2選択時) */}
                {settingsForm.authMethod && settingsForm.authMethod !== "PASSWORD" && (
                  <div className="p-3.5 rounded-lg bg-sky-950/40 border border-sky-500/30 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-sky-300 font-bold">
                      <div className="flex items-center gap-1.5">
                        <Key className="w-4 h-4 text-amber-400" />
                        <span>Modern Auth 認証 (パスワード不要 / Access Token 自動解決)</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-200 font-mono">
                        Password-less Active
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      💡 Microsoft 365 / Exchange Online ではパスワード入力は不要です。以下の <strong>Client ID</strong> および <strong>Refresh Token</strong> を使用して Microsoft Graph REST API または Modern Auth (XOAUTH2) 経由でメールを同期します。
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={applyPresetGoogleOAuth2}
                        className="px-3 py-1.5 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold flex items-center gap-1 transition-all"
                      >
                        <span>Google Workspace (Gmail) プリセット適用</span>
                      </button>
                      <button
                        type="button"
                        onClick={applyPresetOutlookOAuth2}
                        className="px-3 py-1.5 rounded-md bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-[11px] font-bold flex items-center gap-1 transition-all"
                      >
                        <span>Microsoft 365 (Outlook) プリセット適用</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 認証ユーザーID & パスワード */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">認証ユーザーID / アカウント名:</label>
                    <input
                      type="text"
                      value={settingsForm.authUsername}
                      onChange={(e) => setSettingsForm({ ...settingsForm, authUsername: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
                      placeholder="spares-common@shipping-air.jp"
                    />
                  </div>

                  {(!settingsForm.authMethod || settingsForm.authMethod === "PASSWORD") && (
                    <div>
                      <label className="block text-slate-400 mb-1">パスワード / アプリパスワード:</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={settingsForm.authPassword || ""}
                          onChange={(e) => setSettingsForm({ ...settingsForm, authPassword: e.target.value })}
                          className="w-full pl-3 pr-10 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
                          placeholder="••••••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* OAuth2 Modern Auth 詳細パラメータ設定 */}
                {settingsForm.authMethod && settingsForm.authMethod !== "PASSWORD" && (
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-emerald-500/30 space-y-3">
                    <div className="text-[11px] text-emerald-400 font-black flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <ShieldCheck className="w-4 h-4" />
                      <span>OAuth2 / Modern Auth (XOAUTH2) 詳細認証情報</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">Client ID (クライアントID):</label>
                        <input
                          type="text"
                          value={settingsForm.oauthClientId || ""}
                          onChange={(e) => setSettingsForm({ ...settingsForm, oauthClientId: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-mono focus:border-emerald-500 focus:outline-none text-xs"
                          placeholder={settingsForm.authMethod === "OAUTH2_GMAIL" ? "102938475610-xxx.apps.googleusercontent.com" : "00000000-0000-0000-0000-000000000000"}
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">Client Secret (クライアントシークレット):</label>
                        <div className="relative">
                          <input
                            type={showClientSecret ? "text" : "password"}
                            value={settingsForm.oauthClientSecret || ""}
                            onChange={(e) => setSettingsForm({ ...settingsForm, oauthClientSecret: e.target.value })}
                            className="w-full pl-3 pr-10 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-mono focus:border-emerald-500 focus:outline-none text-xs"
                            placeholder="GOCSPX-xxxxxxxxxxxxxxxx"
                          />
                          <button
                            type="button"
                            onClick={() => setShowClientSecret(!showClientSecret)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
                          >
                            {showClientSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">Refresh Token (リフレッシュトークン):</label>
                        <div className="relative">
                          <input
                            type={showRefreshToken ? "text" : "password"}
                            value={settingsForm.oauthRefreshToken || ""}
                            onChange={(e) => setSettingsForm({ ...settingsForm, oauthRefreshToken: e.target.value })}
                            className="w-full pl-3 pr-10 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-mono focus:border-emerald-500 focus:outline-none text-xs"
                            placeholder="1//04xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          />
                          <button
                            type="button"
                            onClick={() => setShowRefreshToken(!showRefreshToken)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
                          >
                            {showRefreshToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {(settingsForm.authMethod === "OAUTH2_OUTLOOK" || settingsForm.authMethod === "OAUTH2_CUSTOM") && (
                        <div>
                          <label className="block text-slate-400 mb-1">Tenant ID (Microsoft 365テナントID):</label>
                          <input
                            type="text"
                            value={settingsForm.oauthTenantId || ""}
                            onChange={(e) => setSettingsForm({ ...settingsForm, oauthTenantId: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-mono focus:border-emerald-500 focus:outline-none text-xs"
                            placeholder="common または xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 自動同期インターバル */}
                <div>
                  <label className="block text-slate-400 mb-1">自動バックグラウンド同期・ポーリング間隔:</label>
                  <select
                    value={settingsForm.syncIntervalMinutes}
                    onChange={(e) => setSettingsForm({ ...settingsForm, syncIntervalMinutes: parseInt(e.target.value) || 5 })}
                    className="w-full sm:w-1/2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value={1}>1分ごとに同期 (リアルタイム重視)</option>
                    <option value={5}>5分ごとに同期 (推奨)</option>
                    <option value={10}>10分ごとに同期</option>
                    <option value={30}>30分ごとに同期</option>
                    <option value={0}>手動同期のみ</option>
                  </select>
                </div>
              </div>

              {/* 5. 共通自動署名 (Signature Text) */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <label className="block text-slate-400">共通メール送信時の自動付与署名 (Signature):</label>
                <textarea
                  rows={4}
                  value={settingsForm.signatureText || ""}
                  onChange={(e) => setSettingsForm({ ...settingsForm, signatureText: e.target.value })}
                  className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs focus:border-rose-500 focus:outline-none leading-relaxed"
                  placeholder="--------------------------------------------------"
                />
              </div>

              {/* 6. Connection Test & Full Data Sync Area */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div>
                    <div className="font-bold text-slate-200 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-400" /> サーバー接続状態確認
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">
                      入力されたIMAP/SMTPホストおよびポートへのハンドシェイク接続テストを実施
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isTestingConn}
                    onClick={handleTestConnection}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 flex items-center gap-2 font-bold shrink-0 transition-all active:scale-95"
                  >
                    {isTestingConn ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
                        <span>検証中...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                        <span>接続テスト実行</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Full Mail Data Sync Feature */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                  <div>
                    <div className="font-bold text-slate-100 flex items-center gap-2">
                      <RefreshCw className={`w-4 h-4 text-sky-400 ${isSyncingAll ? "animate-spin" : ""}`} />
                      <span>メール全データ同期処理 (IMAP / POP3 Full Sync)</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30">
                        サーバー全件一括同期
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      設定済みのメールサーバー [{settingsForm.incomingProtocol}] {settingsForm.incomingHost}:{settingsForm.incomingPort} に接続し、保管されている全メールフォルダデータをアライメント・同期します。
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isSyncingAll}
                    onClick={handleSyncAllEmails}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-black flex items-center gap-2 shrink-0 shadow-md transition-all active:scale-95 disabled:opacity-70"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncingAll ? "animate-spin" : ""}`} />
                    <span>{isSyncingAll ? "全データ同期中..." : "メール全データ同期実行"}</span>
                  </button>
                </div>

                {isSyncingAll && syncProgress && (
                  <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-500/40 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs text-sky-300 font-bold">
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                        {syncProgress}
                      </span>
                      <span className="text-[10px] font-mono bg-sky-900/60 px-2 py-0.5 rounded">CONNECTING</span>
                    </div>
                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-sky-800">
                      <div className="bg-gradient-to-r from-sky-400 to-blue-500 h-full animate-pulse rounded-full w-3/4"></div>
                    </div>
                  </div>
                )}
              </div>

              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-bold leading-relaxed flex items-start gap-2.5 ${
                    testResult.success
                      ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
                      : "bg-rose-950/40 border-rose-500/50 text-rose-300"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{testResult.msg}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                className="px-6 py-2.5 bg-gradient-to-r from-rose-500 via-rose-600 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>全員共有サーバー設定を保存 (Firestore)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-black">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
