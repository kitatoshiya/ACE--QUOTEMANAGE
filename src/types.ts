export type QuoteStatus =
  | "requested"
  | "estimated"
  | "re_estimating"
  | "accepted"
  | "closed_or_on_hold";

export type AppTheme = "light" | "dark" | "cute" | "digital";
export type ActiveView =
  | "kanban"
  | "sticky_board"
  | "history_search"
  | "arrangement_progress"
  | "stock_extractor"
  | "shared_mail"
  | "firestore_monitor";

export interface SharedMailRecipient {
  name?: string;
  address: string;
}

export interface SharedMailAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline?: boolean;
}

export interface SharedMailMessage {
  id: string;
  conversationId?: string;
  subject: string;
  bodyPreview: string;
  bodyHtml?: string;
  bodyText?: string;
  from?: SharedMailRecipient;
  toRecipients: SharedMailRecipient[];
  ccRecipients: SharedMailRecipient[];
  receivedDateTime: string;
  sentDateTime?: string;
  hasAttachments: boolean;
  attachments?: SharedMailAttachment[];
  isRead: boolean;
  importance?: "low" | "normal" | "high";
  isDemo?: boolean;
}

export interface SharedMailboxStatus {
  configured: boolean;
  sharedMailbox?: string;
  tenantIdConfigured: boolean;
  clientIdConfigured: boolean;
  clientSecretConfigured: boolean;
  connected?: boolean;
  isSecretIdError?: boolean;
  error?: string;
  tokenRoles?: string[];
  hasMailRead?: boolean;
  hasMailSend?: boolean;
  needsApiPermissions?: boolean;
}

export interface SendSharedMailPayload {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  replyToMessageId?: string;
  mailbox?: string;
}

export interface ArrangementTaskItem {
  id: number; // 1 to 7
  key: string;
  label: string; // e.g. "受託・手配開始"
  subLabel: string; // e.g. "Booking確定"
  shortName: string; // e.g. "Booking確定"
}

export const ARRANGEMENT_TASKS: ArrangementTaskItem[] = [
  { id: 1, key: "booking", label: "受託・手配開始", subLabel: "Booking確定", shortName: "Booking確定" },
  { id: 2, key: "invoice", label: "書類作成", subLabel: "インボイス", shortName: "インボイス" },
  { id: 3, key: "warehouse", label: "倉庫へ依頼", subLabel: "業連・爆発物検査・搬入伝票FAX", shortName: "倉庫FAX" },
  { id: 4, key: "customs", label: "通関手配", subLabel: "通関依頼", shortName: "通関依頼" },
  { id: 5, key: "awb", label: "AWB発行", subLabel: "発行、KIXへ送る", shortName: "AWB発行" },
  { id: 6, key: "ccsj", label: "CCSJ", subLabel: "データ送信", shortName: "CCSJ送信" },
  { id: 7, key: "stock", label: "ストックリスト更新", subLabel: "在庫更新", shortName: "在庫更新" },
];

export interface ArrangementTaskStatus {
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
  note?: string;
}

export type WeightBreak =
  | "MIN"
  | "-45kg"
  | "+45kg"
  | "+100kg"
  | "+300kg"
  | "+500kg"
  | "+1000kg";

export const WEIGHT_BREAK_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "未選択" },
  { value: "MIN", label: "MIN" },
  { value: "-45kg", label: "-45kg" },
  { value: "+45kg", label: "+45kg" },
  { value: "+100kg", label: "+100kg" },
  { value: "+300kg", label: "+300kg" },
  { value: "+500kg", label: "+500kg" },
  { value: "+1000kg", label: "+1000kg" },
];



export type StickyNoteColor = "yellow" | "blue" | "green" | "pink" | "purple" | "slate";

export interface StickyNoteLink {
  id: string;
  title: string;
  url: string;
}

export interface StickyNote {
  id: string;
  title: string;
  content: string;
  color: StickyNoteColor;
  x: number;
  y: number;
  width?: number;
  height?: number;
  links?: StickyNoteLink[];
  imageUrl?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  zIndex?: number;
}

export interface StatusColumnConfig {
  id: QuoteStatus;
  title: string;
  badgeBg: string;
  badgeText: string;
  description: string;
}

export interface ExternalLink {
  id?: string;
  title: string;
  url: string;
}

export interface StaffMember {
  id: string;
  name: string; // 担当者名（必須）
  email: string; // ログインメールアドレス（必須）
  employeeNumber?: string; // 社員番号（任意）
}

export interface QuoteMessage {
  id: string;
  quoteId: string;
  authorEmail: string;
  authorName?: string;
  createdAt: string; // ISO string
  contentHtml: string;
  isSystemLog?: boolean;
  externalLinks?: ExternalLink[];
}

export interface AppBackground {
  type: "image" | "color" | "default";
  value: string;
}

export interface NotificationPreferences {
  desktopEnabled: boolean;
  emailEnabled: boolean;
  notifyOnStatusChanges: {
    requested: boolean; // 1. ”見積依頼”にタスクが追加された
    estimated: boolean; // 2. ”見積済み”にタスクが追加された
    re_estimating: boolean; // 3. ”見積連絡済”にタスクが追加された
    accepted: boolean; // 4. ”受託”にタスクが追加された
    closed_or_on_hold: boolean; // 5. ”失注・保留”にタスクが追加された
    archived: boolean; // 6. タスクがアーカイブされた
  };
  statusChangeScope: "all" | "mentioned_only"; // 対象範囲：「すべてのタスク」または「メンションで自分が指定されたタスクのみ」
  notifyOnMentions: boolean;
  notifyOnAssignedTasks: boolean;
  notifyOnUrgent: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  desktopEnabled: true,
  emailEnabled: true,
  notifyOnStatusChanges: {
    requested: true,
    estimated: true,
    re_estimating: true,
    accepted: true,
    closed_or_on_hold: true,
    archived: true,
  },
  statusChangeScope: "all",
  notifyOnMentions: true,
  notifyOnAssignedTasks: true,
  notifyOnUrgent: true,
};

export function normalizeNotificationPreferences(raw?: Partial<NotificationPreferences>): NotificationPreferences {
  if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES;
  const statusChanges = (raw.notifyOnStatusChanges || {}) as Record<string, boolean | undefined>;
  return {
    desktopEnabled: raw.desktopEnabled ?? true,
    emailEnabled: raw.emailEnabled ?? true,
    notifyOnStatusChanges: {
      requested: statusChanges.requested ?? statusChanges.received ?? true,
      estimated: statusChanges.estimated ?? statusChanges.pricing ?? true,
      re_estimating: statusChanges.re_estimating ?? statusChanges.sent ?? true,
      accepted: statusChanges.accepted ?? true,
      closed_or_on_hold: statusChanges.closed_or_on_hold ?? statusChanges.declined ?? statusChanges.completed ?? true,
      archived: statusChanges.archived ?? true,
    },
    statusChangeScope: raw.statusChangeScope === "mentioned_only" ? "mentioned_only" : "all",
    notifyOnMentions: raw.notifyOnMentions ?? true,
    notifyOnAssignedTasks: raw.notifyOnAssignedTasks ?? true,
    notifyOnUrgent: raw.notifyOnUrgent ?? true,
  };
}

export interface QuotationItem {
  id: string;
  title: string;
  vesselName: string;
  airportCodes: string[]; // 3-letter IATA codes
  weightBreak?: WeightBreak | string; // 重量帯 (MIN, -45kg, +45kg, +100kg, +300kg, +500kg, +1000kg)
  grossWeight?: string; // Legacy/fallback
  customsClearanceDate?: string; // 通関日 (YYYY-MM-DD or date string, 任意)
  isUrgent: boolean;
  status: QuoteStatus;
  createdBy: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  updatedBy?: string; // メールアドレス/ユーザー識別子
  lastRepliedAt: string; // ISO string
  readBy: string[]; // List of user emails who have read the latest update
  externalLinks?: ExternalLink[];
  assignedStaffId?: string; // 担当者ID (任意)
  isArchived?: boolean; // アーカイブフラグ
  archivedAt?: string; // アーカイブ日時 (ISO string)

  // 受託案件 手配進捗管理フィールド
  shipperName?: string; // 荷主名 (e.g., "GHI Inc", "XYZ Trading")
  etdDate?: string; // ETD 出発日 (YYYY-MM-DD or MM/DD)
  etaDate?: string; // ETA 到着予定日 (YYYY-MM-DD or MM/DD)
  flightOrVesselCode?: string; // 便名・船番 (e.g., "SQ619", "KE552")
  arrangementTasks?: Record<number, ArrangementTaskStatus>; // 7つのタスク進行状況 (1..7)
  arrangementMemo?: string; // 手配特記事項・社内メモ
  arrangementUrgency?: "normal" | "risk" | "urgent" | "smooth" | "in_progress" | "arranging" | "completed"; // 手配状態手動指定
  isArrangementCompleted?: boolean; // 全手配完了フラグ
}

export interface FilterOptions {
  searchQuery: string;
  airportCode: string;
  urgentOnly: boolean;
  statusFilter: string; // "all" or specific QuoteStatus
  assignedStaffId: string; // "ALL", "UNASSIGNED", or specific staff member ID
}

export interface BackupData {
  version: string;
  exportedAt: string;
  quotations: QuotationItem[];
  messages: QuoteMessage[];
  staffMembers?: StaffMember[];
}

export interface UserProfile {
  email: string;
  name: string;
  employeeNumber?: string;
}



export interface ChatMessage {
  id: string;
  authorEmail: string;
  authorName: string;
  content: string;
  createdAt: string; // ISO date string
  mentions?: string[]; // List of mentioned emails or staff names
  readBy: string[]; // List of user emails who have read this message
}

export interface ChatWindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized: boolean;
}

export interface ChatTypingStatus {
  email: string;
  name: string;
  lastTypedAt: number; // timestamp in milliseconds
}

export function formatCustomsDate(dateStr?: string): string | null {
  if (!dateStr || !dateStr.trim()) return null;
  const str = dateStr.trim();
  if (str === "未設定" || str === "未記載") return null;

  const match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    const month = match[2].padStart(2, "0");
    const day = match[3].padStart(2, "0");
    return `${month}月${day}日`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${m}月${day}日`;
  }

  return str;
}

export function parseCustomsDateToTime(dateStr?: string): number {
  if (!dateStr || !dateStr.trim()) return Infinity;
  const str = dateStr.trim();
  if (str === "未設定" || str === "未記載") return Infinity;

  const match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    return new Date(year, month, day).getTime();
  }

  const shortMatch = str.match(/^(\d{1,2})[-/](\d{1,2})/);
  if (shortMatch) {
    const month = parseInt(shortMatch[1], 10) - 1;
    const day = parseInt(shortMatch[2], 10);
    const year = new Date().getFullYear();
    return new Date(year, month, day).getTime();
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.getTime();
  }

  return Infinity;
}

export function isQuoteAssignedToUser(
  quote: QuotationItem,
  currentUser: UserProfile,
  staffMembers: StaffMember[] = []
): boolean {
  const assignedStaff = staffMembers.find((s) => s.id === quote.assignedStaffId);
  const currentStaffMember = staffMembers.find(
    (s) =>
      (s.email && s.email.toLowerCase() === currentUser.email.toLowerCase()) ||
      (s.name && s.name === currentUser.name)
  );

  return Boolean(
    (assignedStaff &&
      ((assignedStaff.email && assignedStaff.email.toLowerCase() === currentUser.email.toLowerCase()) ||
        assignedStaff.name === currentUser.name)) ||
    (currentStaffMember && quote.assignedStaffId === currentStaffMember.id) ||
    (!quote.assignedStaffId && quote.createdBy && quote.createdBy.toLowerCase() === currentUser.email.toLowerCase())
  );
}
