import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Firestore,
} from "firebase/firestore";
import { getAuth, Auth, onAuthStateChanged } from "firebase/auth";
import firebaseConfigJson from "../../firebase-applet-config.json";
import { StaffMember, QuotationItem, QuoteMessage, QuoteStatus, StickyNote, ChatMessage } from "../types";

let app: FirebaseApp;
let db: Firestore | null = null;
let auth: Auth | null = null;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfigJson) : getApps()[0];
  db = getFirestore(app, firebaseConfigJson.firestoreDatabaseId || undefined);
  auth = getAuth(app);
} catch (e) {
  console.warn("Firebase initialization warning (using local persistent store):", e);
}

export { db, auth };

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
}

// Helper to remove `undefined` properties before sending to Firestore
export function cleanForFirestore<T extends Record<string, any>>(obj: T): T {
  const cleaned: Record<string, any> = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  });
  return cleaned as T;
}

// Sample initial staff members
export const INITIAL_SAMPLE_STAFF: StaffMember[] = [
  {
    id: "staff-1",
    name: "喜多 健二",
    email: "kita@tac-japan.co.jp",
    employeeNumber: "EMP-001",
  },
  {
    id: "staff-2",
    name: "山田 太郎",
    email: "yamada.sales@marinetrade.co.jp",
    employeeNumber: "EMP-002",
  },
  {
    id: "staff-3",
    name: "斉藤 操",
    email: "saito.op@marinetrade.co.jp",
    employeeNumber: "EMP-003",
  },
];

// Sample initial data for marine spare parts quotations
export const INITIAL_SAMPLE_QUOTES: QuotationItem[] = [
  {
    id: "quote-101",
    title: "M/V OCEAN GLORY 主機関NO.1シリンダライナ＆ピストンエアー手配",
    vesselName: "M/V OCEAN GLORY",
    airportCodes: ["SIN"],
    customsClearanceDate: "2026-08-10",
    isUrgent: true,
    status: "requested",
    createdBy: "yamada.sales@marinetrade.co.jp",
    assignedStaffId: "staff-1",
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    lastRepliedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    readBy: ["yamada.sales@marinetrade.co.jp"], // Unread for other users!
    externalLinks: [
      {
        title: "見積原価計算シート(Drive)",
        url: "https://drive.google.com/file/d/sample-cost-sheet-ocean-glory",
      },
    ],
  },
  {
    id: "quote-102",
    title: "M/V PACIFIC WAVE ターボチャージャーロータアセンブリ急送見積",
    vesselName: "M/V PACIFIC WAVE",
    airportCodes: ["BKK"],
    customsClearanceDate: "2026-08-12",
    isUrgent: false,
    status: "estimated",
    createdBy: "saito.op@marinetrade.co.jp",
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    lastRepliedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    readBy: ["saito.op@marinetrade.co.jp", "yamada.sales@marinetrade.co.jp"],
    externalLinks: [
      {
        title: "航空輸送費用比較表(Excel)",
        url: "https://docs.google.com/spreadsheets/d/sample-air-freight-bkk",
      },
    ],
  },
  {
    id: "quote-103",
    title: "M/V NIPPON MARU 発電機エンジン冷却水ポンプ予備品",
    vesselName: "M/V NIPPON MARU",
    airportCodes: ["HND", "NRT"],
    customsClearanceDate: "2026-08-08",
    isUrgent: false,
    status: "requested",
    createdBy: "yamada.sales@marinetrade.co.jp",
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    lastRepliedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    readBy: ["yamada.sales@marinetrade.co.jp"],
  },
  {
    id: "quote-104",
    title: "M/V ASIAN EXPRESS 燃料噴射弁ノズル＆弁箱セット急行手配",
    vesselName: "M/V ASIAN EXPRESS",
    airportCodes: ["SIN"],
    customsClearanceDate: "2026-08-06",
    isUrgent: true,
    status: "re_estimating",
    createdBy: "tanaka.air@marinetrade.co.jp",
    createdAt: new Date(Date.now() - 3600000 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    lastRepliedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    readBy: ["tanaka.air@marinetrade.co.jp"],
  },
  {
    id: "quote-105",
    title: "M/V GLOBAL PIONEER 航海計器レーダーマグネトロン交換品",
    vesselName: "M/V GLOBAL PIONEER",
    airportCodes: ["FRA"],
    customsClearanceDate: "2026-08-15",
    isUrgent: false,
    status: "accepted",
    createdBy: "yamada.sales@marinetrade.co.jp",
    assignedStaffId: "staff-2",
    createdAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    lastRepliedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    readBy: ["saito.op@marinetrade.co.jp", "yamada.sales@marinetrade.co.jp"],
  },
  {
    id: "quote-106",
    title: "M/V ORIENT SPIRIT 油水分離器用スペアフィルターカートン",
    vesselName: "M/V ORIENT SPIRIT",
    airportCodes: ["DXB"],
    customsClearanceDate: "",
    isUrgent: false,
    status: "closed_or_on_hold",
    createdBy: "yamada.sales@marinetrade.co.jp",
    createdAt: new Date(Date.now() - 3600000 * 120).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 90).toISOString(),
    lastRepliedAt: new Date(Date.now() - 3600000 * 90).toISOString(),
    readBy: ["yamada.sales@marinetrade.co.jp"],
  },
];

export const INITIAL_SAMPLE_MESSAGES: QuoteMessage[] = [
  {
    id: "msg-101-1",
    quoteId: "quote-101",
    authorEmail: "yamada.sales@marinetrade.co.jp",
    authorName: "山田 太郎 (営業)",
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    contentHtml: `<p>本船 M/V OCEAN GLORY のシリンダライナ（320kg）およびピストンリングセット（60kg）のシンガポール（SIN）向け航空輸送見積の依頼を受信しました。</p>
    <p>ETA SIN: 2026年7月30日。本船入港後即時納入が必要な緊急案件です。航空会社枠の確保と概算概算運賃の算出をお願いします。</p>`,
    externalLinks: [
      {
        title: "本船動静・代理店連絡先(PDF)",
        url: "https://drive.google.com/file/d/vessel-schedule-ocean-glory",
      },
    ],
  },
  {
    id: "msg-101-2",
    quoteId: "quote-101",
    authorEmail: "tanaka.air@marinetrade.co.jp",
    authorName: "田中 健一 (航空業務)",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    contentHtml: `<p>シンガポール航空 (SQ) 直行便のスペース確認が取れました。以下が概算見積金額となります。</p>
    <div class="overflow-x-auto my-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"><table class="w-full text-xs text-left border-collapse">
      <tr class="bg-slate-100 dark:bg-slate-800 font-semibold border-b"><th class="px-3 py-2 border-r">項目</th><th class="px-3 py-2 border-r">重量/数量</th><th class="px-3 py-2 border-r">単価 (JPY)</th><th class="px-3 py-2">金額 (JPY)</th></tr>
      <tr class="border-b"><td class="px-3 py-2 border-r">Air Freight (SQ Direct)</td><td class="px-3 py-2 border-r">380 kg</td><td class="px-3 py-2 border-r">¥850 /kg</td><td class="px-3 py-2">¥323,000</td></tr>
      <tr class="border-b"><td class="px-3 py-2 border-r">Fuel & FSC / SSC</td><td class="px-3 py-2 border-r">380 kg</td><td class="px-3 py-2 border-r">¥180 /kg</td><td class="px-3 py-2">¥68,400</td></tr>
      <tr class="border-b"><td class="px-3 py-2 border-r">Handling & Customs</td><td class="px-3 py-2 border-r">1 Lot</td><td class="px-3 py-2 border-r">¥35,000</td><td class="px-3 py-2">¥35,000</td></tr>
      <tr class="bg-amber-50 dark:bg-amber-950 font-bold"><td class="px-3 py-2 border-r" colspan="3">合計概算費用 (TAX Excluded)</td><td class="px-3 py-2 text-amber-700 dark:text-amber-300">¥426,400</td></tr>
    </table></div>
    <p>💡 フライト手配はカットオフ前日15時までに確定をお願いいたします。</p>`,
  },
  {
    id: "msg-102-1",
    quoteId: "quote-102",
    authorEmail: "saito.op@marinetrade.co.jp",
    authorName: "斎藤 華 (オペレーション)",
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    contentHtml: `<p>M/V PACIFIC WAVE バンコク（BKK）向けターボチャージャーロータ（145kg）の見積回答を顧客へ提出完了しました。</p>`,
  },
];

// LocalStorage Persistence Keys
const STORAGE_KEY_QUOTES = "marine_quotes_data_v1";
const STORAGE_KEY_MESSAGES = "marine_messages_data_v1";
const STORAGE_KEY_STAFF = "marine_staff_data_v1";

export function loadLocalStaff(): StaffMember[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STAFF);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse local staff:", e);
  }
  saveLocalStaff(INITIAL_SAMPLE_STAFF);
  return INITIAL_SAMPLE_STAFF;
}

export function saveLocalStaff(staff: StaffMember[]) {
  try {
    localStorage.setItem(STORAGE_KEY_STAFF, JSON.stringify(staff));
  } catch (e) {
    console.error("Failed to save local staff:", e);
  }
}

export function loadLocalQuotes(): QuotationItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_QUOTES);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse local quotes:", e);
  }
  saveLocalQuotes(INITIAL_SAMPLE_QUOTES);
  return INITIAL_SAMPLE_QUOTES;
}

export function saveLocalQuotes(quotes: QuotationItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY_QUOTES, JSON.stringify(quotes));
  } catch (e) {
    console.error("Failed to save local quotes:", e);
  }
}

export function loadLocalMessages(): QuoteMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse local messages:", e);
  }
  saveLocalMessages(INITIAL_SAMPLE_MESSAGES);
  return INITIAL_SAMPLE_MESSAGES;
}

export function saveLocalMessages(messages: QuoteMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
  } catch (e) {
    console.error("Failed to save local messages:", e);
  }
}

// Sample initial Kanban Chat Messages
export const INITIAL_SAMPLE_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "chat-msg-1",
    authorEmail: "yamada.sales@marinetrade.co.jp",
    authorName: "山田 太郎 (営業)",
    content: "みなさんお疲れ様です。本日の羽田・成田向けエア便手配の件、進捗いかがでしょうか？ @喜多 健二 @斉藤 操",
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    mentions: ["kita@tac-japan.co.jp", "saito.op@marinetrade.co.jp"],
    readBy: ["yamada.sales@marinetrade.co.jp"],
  },
  {
    id: "chat-msg-2",
    authorEmail: "saito.op@marinetrade.co.jp",
    authorName: "斉藤 操 (オペレーション)",
    content: "山田さん、BKK行きのバンコク便スペース確保完了しました！通関書類準備中です。",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    mentions: [],
    readBy: ["saito.op@marinetrade.co.jp", "yamada.sales@marinetrade.co.jp"],
  },
  {
    id: "chat-msg-3",
    authorEmail: "kita@tac-japan.co.jp",
    authorName: "喜多 健二",
    content: "@山田 太郎 (営業) SIN行きの緊急パーツ件、シンガポール航空直行便で最終調整中です。16時までに回答します。",
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    mentions: ["yamada.sales@marinetrade.co.jp"],
    readBy: ["kita@tac-japan.co.jp"],
  },
];

const STORAGE_KEY_CHAT_MESSAGES = "marine_chat_messages_data_v1";

export function loadLocalChatMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHAT_MESSAGES);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse local chat messages:", e);
  }
  saveLocalChatMessages(INITIAL_SAMPLE_CHAT_MESSAGES);
  return INITIAL_SAMPLE_CHAT_MESSAGES;
}

export function saveLocalChatMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY_CHAT_MESSAGES, JSON.stringify(messages));
  } catch (e) {
    console.error("Failed to save local chat messages:", e);
  }
}

// Sample initial sticky notes for Backstage canvas (裏画面 付箋ボード)
export const INITIAL_SAMPLE_STICKY_NOTES: StickyNote[] = [
  {
    id: "note-101",
    title: "⚓ 全体共有：緊急船用品航空便の注意事項",
    content: "【連絡事項】\nシンガポール (SIN) 及びバンコク (BKK) 向けの危急品手配時、関税関係書類（Proforma Invoice / Packing List）の送付漏れにご注意ください。\n直近のフライト枠確保は前日15時カットオフとなります。",
    color: "yellow",
    x: 40,
    y: 30,
    width: 320,
    links: [
      {
        id: "link-1",
        title: "成田/羽田 航空貨物取扱手順ガイド",
        url: "https://www.japan-air-cargo.example.com/guide",
      },
    ],
    createdBy: "yamada.sales@marinetrade.co.jp",
    createdByName: "山田 太郎 (営業)",
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    zIndex: 1,
  },
  {
    id: "note-102",
    title: "✈️ 主要代理店・空港担当連絡先リンク集",
    content: "各主要港・空港における本船船用品デリバリー担当代理店のポータルサイト及び社内共通フォルダ一覧。",
    color: "blue",
    x: 390,
    y: 30,
    width: 320,
    links: [
      {
        id: "link-2",
        title: "SIN代理店 OceanPort Logistics",
        url: "https://oceanport-singapore.example.com",
      },
      {
        id: "link-3",
        title: "BKK代理店 ThaiMarine Freight",
        url: "https://thaimarine-bkk.example.com",
      },
    ],
    createdBy: "saito.op@marinetrade.co.jp",
    createdByName: "斉藤 操 (オペレーション)",
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    zIndex: 2,
  },
  {
    id: "note-103",
    title: "📸 主機関スペアパーツ識別写真メモ",
    content: "シリンダライナ・ピストンリング・ターボチャージャーロータの標準梱包仕様です。木枠梱包時はVCI防錆紙の同封を徹底してください。",
    color: "green",
    x: 740,
    y: 30,
    width: 340,
    imageUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    links: [
      {
        id: "link-4",
        title: "梱包ガイドライン仕様書 (PDF)",
        url: "https://drive.google.com/file/d/packing-guidelines",
      },
    ],
    createdBy: "kita@tac-japan.co.jp",
    createdByName: "喜多 健二",
    createdAt: new Date(Date.now() - 3600000 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    zIndex: 3,
  },
];

const STORAGE_KEY_STICKY_NOTES = "marine_sticky_notes_data_v1";

export function loadLocalStickyNotes(): StickyNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STICKY_NOTES);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse local sticky notes:", e);
  }
  saveLocalStickyNotes(INITIAL_SAMPLE_STICKY_NOTES);
  return INITIAL_SAMPLE_STICKY_NOTES;
}

export function saveLocalStickyNotes(notes: StickyNote[]) {
  try {
    localStorage.setItem(STORAGE_KEY_STICKY_NOTES, JSON.stringify(notes));
  } catch (e) {
    console.error("Failed to save local sticky notes:", e);
  }
}
