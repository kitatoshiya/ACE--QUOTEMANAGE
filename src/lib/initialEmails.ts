import { EmailMessage } from "../types";

export const INITIAL_EMAILS: EmailMessage[] = [
  {
    id: "email-001",
    fromName: "東洋船舶海運（株）工務部 鈴木",
    fromEmail: "s.suzuki@toyo-maritime.co.jp",
    toEmail: "spares-common@shipping-air.jp",
    subject: "【緊急見積依頼】M/V PACIFIC WAVE シリンダライナ＆ピストンリング SIN宛エアー手配",
    bodyText: `TACエアサービス 船用品営業部 御中
お世話になっております。東洋船舶の鈴木です。

本船 M/V PACIFIC WAVE（現在シンガポール沖アンカー中）の主機予備部品につきまして、緊急で航空輸送の見積をお願いいたします。

【貨物明細】
1. Cylinder Liner x 2本 (約 640kg)
2. Piston Ring Set x 1箱 (約 60kg)
合計総重量: 約 700 kg / 梱包サイズ: 120 x 80 x 110 cm

【希望スケジュール】
出荷地: 成田(NRT) または 羽田(HND)
到着地: シンガポール (SIN)
希望納入日: 2026年8月5日必着

本船の出港予定が近づいておりますため、取り急ぎ直行便（SQ / JL）での概算運賃と現地通関・本船配送費の見積をご提示いただけますと幸いです。

何卒よろしくお願い申し上げます。
--------------------------------------------------
東洋船舶海運株式会社 工務部
鈴木 健太郎
TEL: 03-3555-9876 / Mobile: 090-1234-5678
Email: s.suzuki@toyo-maritime.co.jp
`,
    receivedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
    isRead: false,
    isStarred: true,
    folder: "inbox",
    labels: ["見積依頼", "緊急", "SIN"],
    vesselName: "M/V PACIFIC WAVE",
    airportCode: "SIN",
  },
  {
    id: "email-002",
    fromName: "Global Marine Logistics (SIN) Ltd.",
    fromEmail: "ops@global-marine-sin.sg",
    toEmail: "spares-common@shipping-air.jp",
    subject: "Re: Cargo Arrival Notice & Clearance Confirm - M/V OCEAN GLORY (SIN)",
    bodyText: `Dear TAC Air Freight Team,

Good day.
Regarding the shipment for M/V OCEAN GLORY under AWB # 131-88901234, we confirm that cargo has safely arrived at Changi Airport (SIN) today 14:20 LT.

Customs clearance is in progress and onboard delivery to anchorage is scheduled for tomorrow morning 09:00 hrs.

Please find attached the signed delivery receipt copy once completed.

Best regards,
Alvin Tan / Operations Exec.
Global Marine Logistics Singapore
Email: ops@global-marine-sin.sg
`,
    receivedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), // 3 hours ago
    isRead: true,
    isStarred: false,
    folder: "inbox",
    labels: ["本船手配完了", "SIN"],
    vesselName: "M/V OCEAN GLORY",
    airportCode: "SIN",
  },
  {
    id: "email-003",
    fromName: "日本海運エンジニアリング 高橋",
    fromEmail: "takahashi@japan-marine-eng.co.jp",
    toEmail: "spares-common@shipping-air.jp",
    subject: "【至急確認】BKK向け ターボチャージャーロータ 危険物判定・梱包要件",
    bodyText: `船用品エアー輸出見積チーム 御中

いつも大変お世話になっております。日本海運エンジニアリングの高橋です。

先日ご相談いたしましたバンコク（BKK）向けのターボチャージャーロータ（145kg）の件ですが、油分付着に関する航空会社の危険物（DG）判定について確認させてください。

完全洗浄済み証明書を発行のうえ、木箱梱包（IPPC燻蒸処理済み）にて準備予定ですが、TG（タイ国際航空）便での受託条件に問題ないでしょうか。

問題なければ、本日夕方までに正式な運賃見積もりをお願いしたく存じます。

よろしくお願いいたします。
--------------------------------------------------
日本海運エンジニアリング株式会社
物流手配グループ 高橋 浩二
`,
    receivedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(), // 12 hours ago
    isRead: true,
    isStarred: true,
    folder: "inbox",
    labels: ["見積依頼", "BKK"],
    vesselName: "M/V BKK STAR",
    airportCode: "BKK",
  },
  {
    id: "email-004",
    fromName: "TACエアサービス 船用品担当",
    fromEmail: "spares-common@shipping-air.jp",
    toEmail: "s.suzuki@toyo-maritime.co.jp",
    subject: "【見積回答】M/V PACIFIC WAVE 航空輸送概算お見積り（SIN宛て）",
    bodyText: `東洋船舶海運株式会社 工務部
鈴木 健太郎 様

いつも大変お世話になっております。
TACエアサービス 船用品営業部でございます。

お問い合わせいただきました M/V PACIFIC WAVE 向けの予備部品航空輸送につきまして、以下の通り概算見積を作成いたしました。

【案件概要】
本船名: M/V PACIFIC WAVE
仕向地: シンガポール (SIN)
概算重量: 700 kg (シリンダライナ & ピストンリング)

【概算運賃・費用内訳】
1. 航空運賃 (NRT-SIN / SQ直行便): JPY 385,000-
2. 国内集荷・梱包補強費: JPY 45,000-
3. 輸出通関・ドキュメント作成料: JPY 22,000-
4. 現地通関・アンカー本船船側配送費: SGD 1,200 (約 JPY 135,000-)
--------------------------------------------------
概算合計: JPY 587,000- （税別）

スペースはSQ637便（NRT 11:10発）にて仮確保可能でございます。
手配進めてよろしければ、折り返し本メールまたはシステム上にてご指示ください。

何卒よろしくお願い申し上げます。
`,
    receivedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), // 1 day ago
    isRead: true,
    isStarred: false,
    folder: "sent",
    labels: ["見積回答済"],
    vesselName: "M/V PACIFIC WAVE",
    airportCode: "SIN",
  },
  {
    id: "email-005",
    fromName: "TACエアサービス 船用品担当",
    fromEmail: "spares-common@shipping-air.jp",
    toEmail: "yamada@pacific-ship.com",
    subject: "【下書き】M/V GLOBAL EXPRESS 予備部品輸送お見積り",
    bodyText: `パシフィックシッピング 担当者様

お世話になっております。
M/V GLOBAL EXPRESS 向けの燃料噴射弁（120kg / RTM宛）の見積下書きです。
`,
    receivedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    isRead: true,
    isStarred: false,
    folder: "drafts",
    labels: ["下書き"],
    vesselName: "M/V GLOBAL EXPRESS",
    airportCode: "RTM",
  },
];

export const DEFAULT_EMAIL_SETTINGS = {
  commonEmail: "spares-common@shipping-air.jp",
  senderName: "TACエアサービス 船用品営業部",
  incomingProtocol: "IMAP" as const,
  incomingHost: "imap.gmail.com",
  incomingPort: 993,
  incomingEncryption: "SSL/TLS" as const,
  outgoingHost: "smtp.gmail.com",
  outgoingPort: 587,
  outgoingEncryption: "STARTTLS" as const,
  authUsername: "spares-common@shipping-air.jp",
  authPassword: "••••••••••••",
  authMethod: "PASSWORD" as const,
  oauthClientId: "",
  oauthClientSecret: "",
  oauthRefreshToken: "",
  oauthTenantId: "",
  syncIntervalMinutes: 5,
  signatureText: `--------------------------------------------------\nTACエアサービス 船用品営業部\n〒104-0061 東京都中央区銀座 7-10-1\nEmail: spares-common@shipping-air.jp\nTEL: 03-5555-9876`,
  updatedAt: new Date().toISOString(),
  updatedBy: "System",
};

