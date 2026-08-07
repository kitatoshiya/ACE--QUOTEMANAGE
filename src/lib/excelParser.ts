/**
 * Converts TSV (Tab Separated Values from Excel copy paste) or HTML into styled HTML Table with clear borders
 */
export function convertTsvToHtmlTable(text: string): string {
  if (!text || typeof text !== "string") return "";

  // Check if text contains tabs (Excel paste)
  if (!text.includes("\t") && !text.includes("\n")) {
    return escapeHtml(text);
  }

  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return escapeHtml(text);

  // Check if at least one line contains tab
  const hasTabs = lines.some((line) => line.includes("\t"));
  if (!hasTabs) {
    // Return standard text formatted with paragraphs/linebreaks
    return text
      .split(/\r?\n/)
      .map((line) => `<p class="my-1">${escapeHtml(line)}</p>`)
      .join("");
  }

  let tableHtml = `<div class="overflow-x-auto my-3 rounded-lg border-2 border-slate-300 bg-white shadow-sm"><table class="excel-table w-full text-xs text-left border-collapse" style="border-collapse: collapse; border: 2px solid #cbd5e1; background-color: #ffffff;">`;

  lines.forEach((line, rowIndex) => {
    const cells = line.split("\t");
    const isHeader = rowIndex === 0;

    tableHtml += `<tr class="${
      isHeader
        ? "bg-slate-200 text-slate-900 font-bold border-b-2 border-slate-400"
        : rowIndex % 2 === 0
        ? "bg-white border-b border-slate-300"
        : "bg-slate-50 border-b border-slate-300"
    }" style="background-color: ${isHeader ? '#e2e8f0' : rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc'};">`;

    cells.forEach((cellText) => {
      const escaped = escapeHtml(cellText.trim());
      const cellTag = isHeader ? "th" : "td";
      tableHtml += `<${cellTag} class="px-3 py-2 border border-slate-300 text-slate-900 whitespace-nowrap" style="border: 1px solid #cbd5e1; background-color: inherit; color: #0f172a;">${escaped || "&nbsp;"}</${cellTag}>`;
    });

    tableHtml += `</tr>`;
  });

  tableHtml += `</table></div>`;
  return tableHtml;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Copy plain text or HTML content to clipboard with fallback
 */
export async function copyToClipboard(content: string): Promise<boolean> {
  try {
    // Strips HTML tags if copying rich HTML text to plain text clipboard
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = content;
    const plainText = tempDiv.innerText || tempDiv.textContent || content;

    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(plainText);
      return true;
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = plainText;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (err) {
    console.error("Copy to clipboard failed:", err);
    return false;
  }
}
