// src/gmail/clubggCode.ts
import { gmailAuthFromEnv } from "./googleAuth";

const CLUBGG_QUERY =
  'from:support@clubgg.com subject:"ClubGG Email Verification Code" newer_than:1d';

export async function fetchClubGGVerificationCode(
  since: Date,
  timeoutMs = 120_000
): Promise<string> {
  const gmail = gmailAuthFromEnv();
  const deadline = Date.now() + timeoutMs;
  const sinceMs = since.getTime();

  while (Date.now() < deadline) {
    // list a few newest matching messages
    const list = await gmail.users.messages.list({
      userId: "me",
      q: CLUBGG_QUERY, // already narrowed to ClubGG code email
      maxResults: 10,
    });

    for (const m of list.data.messages ?? []) {
      const msg = await gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "full",
      });

      // only accept messages that arrived AFTER 'since'
      const internalDate = Number(msg.data.internalDate || "0");
      if (internalDate + 10000 <= sinceMs) continue;

      const text = extractText(msg.data);
      const code = extractCodeFromEmailBody(text);
      if (code) return code;
    }

    await sleep(3000); // poll every 3s
  }

  throw new Error("Timed out waiting for ClubGG verification email");
}

function extractCodeFromEmailBody(input: string): string | null {
  // prefer the 2nd <strong>...</strong> if present
  const strongs = [
    ...input.matchAll(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi),
  ].map((m) => cleanText(htmlDecode(m[1])));

  if (strongs.length >= 2) {
    const maybe = pickSixDigits(strongs[1]);
    if (maybe) return maybe;
  }
  for (const s of strongs) {
    const maybe = pickSixDigits(s);
    if (maybe) return maybe;
  }
  // fallback: anywhere
  return pickSixDigits(stripTags(htmlDecode(input)));
}

function pickSixDigits(s: string): string | null {
  const m = s.match(/\b(\d{6})\b/);
  return m ? m[1] : null;
}

function extractText(msg: any): string {
  const parts: string[] = [];
  const walk = (p: any) => {
    if (!p) return;
    if (
      (p.mimeType === "text/plain" || p.mimeType === "text/html") &&
      p.body?.data
    ) {
      parts.push(decodeB64Url(p.body.data));
    }
    (p.parts || []).forEach(walk);
  };
  walk(msg?.payload);

  const subject =
    msg?.payload?.headers?.find(
      (h: any) => String(h.name).toLowerCase() === "subject"
    )?.value || "";

  return [subject, ...parts, msg?.snippet || ""].join("\n");
}

function decodeB64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  return Buffer.from(b64 + pad, "base64").toString("utf-8");
}

function htmlDecode(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}
function stripTags(s: string): string {
  return s.replace(/<\/?[^>]+>/g, "");
}
function cleanText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
