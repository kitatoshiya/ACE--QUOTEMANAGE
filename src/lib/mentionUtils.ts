import { QuotationItem, StaffMember, UserProfile } from "../types";
import { triggerDesktopNotification } from "./notificationHelper";

export interface MentionTarget {
  staffId?: string;
  name: string;
  email: string;
}

// Extract mentioned staff members from HTML or plain text message
export function extractMentionsFromContent(
  contentHtmlOrText: string,
  staffMembers: StaffMember[]
): StaffMember[] {
  if (!contentHtmlOrText || !staffMembers || staffMembers.length === 0) {
    return [];
  }

  const textLower = contentHtmlOrText.toLowerCase();
  const mentionedSet = new Set<string>();
  const result: StaffMember[] = [];

  staffMembers.forEach((staff) => {
    const emailLower = staff.email.toLowerCase();
    const nameLower = staff.name.toLowerCase();
    const firstName = staff.name.split(" ")[0].toLowerCase();

    // Check if email or name is prefixed with @ or mentioned in text
    const hasAtEmail = textLower.includes(`@${emailLower}`) || textLower.includes(emailLower);
    const hasAtName = textLower.includes(`@${nameLower}`) || textLower.includes(`@${firstName}`);

    if (hasAtEmail || hasAtName) {
      if (!mentionedSet.has(staff.id)) {
        mentionedSet.add(staff.id);
        result.push(staff);
      }
    }
  });

  return result;
}

// Check if a specific user (by UserProfile) is mentioned in content
export function isUserMentioned(
  contentHtmlOrText: string,
  user: UserProfile,
  staffMembers: StaffMember[]
): boolean {
  if (!contentHtmlOrText || !user) return false;

  const textLower = contentHtmlOrText.toLowerCase();
  const userEmailLower = user.email.toLowerCase();
  const userNameLower = user.name.toLowerCase();
  const userFirstName = user.name.split(" ")[0].toLowerCase();

  if (textLower.includes(`@${userEmailLower}`) || textLower.includes(userEmailLower)) {
    return true;
  }

  if (textLower.includes(`@${userNameLower}`) || textLower.includes(`@${userFirstName}`)) {
    return true;
  }

  // Also check matched staff
  const mentions = extractMentionsFromContent(contentHtmlOrText, staffMembers);
  return mentions.some((s) => s.email.toLowerCase() === userEmailLower);
}

// Format a staff member as HTML mention badge matching the specified pill style
export function formatMentionHtml(staff: StaffMember): string {
  const displayName = staff.name.split(" ")[0] || staff.name;
  return `<span class="inline-flex items-center gap-1 font-bold text-sky-400 bg-slate-900 border border-sky-600 px-2.5 py-0.5 rounded-lg text-xs shadow-2xs mx-0.5 align-middle select-none" style="color: #38bdf8 !important; background-color: #0f172a !important; border: 1px solid #0284c7; border-radius: 6px; padding: 2px 8px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; font-size: 12px; margin: 0 2px;" data-mention-email="${staff.email}" contenteditable="false">@${displayName} (${staff.email})</span>&nbsp;`;
}

// Strip HTML tags for plain text email / push notification body
export function stripHtmlToPlainText(htmlStr: string): string {
  if (!htmlStr) return "";
  const temp = document.createElement("div");
  temp.innerHTML = htmlStr;
  return temp.textContent || temp.innerText || "";
}

// Automatically trigger Desktop Notifications and Background Email sending for all mentioned recipients
export async function processMentionNotificationsAndEmails({
  contentHtml,
  quote,
  senderName,
  senderEmail,
  currentUser,
  staffMembers,
  msgId,
}: {
  contentHtml: string;
  quote?: QuotationItem | null;
  senderName: string;
  senderEmail: string;
  currentUser: UserProfile;
  staffMembers: StaffMember[];
  msgId: string;
}) {
  if (!contentHtml || !staffMembers || staffMembers.length === 0) return;

  const mentionedStaffs = extractMentionsFromContent(contentHtml, staffMembers);
  if (mentionedStaffs.length === 0) return;

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const msgText = stripHtmlToPlainText(contentHtml);

  // 1. Trigger Desktop Notification if current logged-in user is mentioned
  if (isUserMentioned(contentHtml, currentUser, staffMembers)) {
    triggerDesktopNotification(
      `🔔 [メンション通知] ${senderName || senderEmail}さんからのメッセージ`,
      `あなた宛てにメンションが届きました:\n${msgText.slice(0, 80)}`,
      `mention-${msgId}`
    );
  }

  // 2. Automatic "One-click Background Email Send" to each mentioned recipient
  for (const targetStaff of mentionedStaffs) {
    if (!targetStaff.email) continue;

    const titleStr = quote ? quote.title : "見積案件";
    const vesselStr = quote ? quote.vesselName : "不明";
    const airportStr = quote?.airportCodes?.join(", ") || "未設定";
    const weightStr = quote?.grossWeight || "未記載";

    const subject = `[メンション通知] 案件: ${titleStr} (本船: ${vesselStr})`;
    const bodyText = `${targetStaff.name || "担当者"} 様

お疲れ様です。${senderName}です。
ACE船用品輸出見積管理システムにて、あなた宛てのメンション/メッセージが投稿されました。

--------------------------------------------------
■ 案件名: ${titleStr}
■ 本船名: ${vesselStr}
■ 向け地(IATA): ${airportStr}
■ 概算重量: ${weightStr}
■ 投稿者: ${senderName} (${senderEmail})
--------------------------------------------------

【投稿コメント本文】
${msgText || "最新の見積更新・返信が届いています。内容をご確認ください。"}

▼ 以下のリンクよりシステムを起動して直接スレッドを確認・返信できます:
${appUrl}

よろしくお願いいたします。
--------------------------------------------------
送信元: ACE船用品輸出見積管理システム
`;

    try {
      const resp = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: targetStaff.email,
          subject,
          bodyText,
          fromName: senderName,
          quoteId: quote?.id,
        }),
      });

      const resData = await resp.json();
      console.log(`[Mention Auto Email] Background email sent to ${targetStaff.email}:`, resData);
    } catch (err) {
      console.error(`[Mention Auto Email Error] Failed sending to ${targetStaff.email}:`, err);
    }
  }
}

