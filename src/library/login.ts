// src/library/login.ts
import axios from "axios";
import dotenv from "dotenv";
import { setTimeout as wait } from "timers/promises";
import { fetchClubGGVerificationCode } from "./mfa";
dotenv.config();

const API_KEY = process.env.CAPSOLVER_API_KEY!;
const SITE_KEY = "6LfGLOwpAAAAAB_yx0Fp06dwDxYIsQ3WD5dSXKbQ";
const PAGE_URL = "https://union.clubgg.com/";
const PAGE_ACTION = "submit";

const LOGIN_URL = "https://union.clubgg.com/login_submit";
const LOGIN_ID = process.env.UNION_LOGIN_ID!;
const LOGIN_PWD = process.env.UNION_LOGIN_PWD!;

const baseHeaders = {
  Accept: "*/*",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "Accept-Language": "en-US,en;q=0.9",
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  Origin: "https://union.clubgg.com",
  Referer: "https://union.clubgg.com/login",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
};

const BACKEND_RECAPTCHA_URL = process.env.UNION_RECAPTCHA_BACKEND!;

// Shape your backend returns: { token: string, ts: number }
interface BackendToken {
  token?: string;
  ts?: number; // epoch ms when produced on your side
}

// Single attempt: ask your backend for one token (queue pop).
async function getRecaptchaTokenFromBackend(): Promise<string | null> {
  try { 
    const { data } = await axios.get<BackendToken>(BACKEND_RECAPTCHA_URL, {
      timeout: 10_000,
      // If your backend requires headers/auth, add them here
      // headers: { Authorization: `Bearer ${process.env.XYZ}` }
    });

    const token = typeof data === "string" ? data : data?.token;
    if (!token || typeof token !== "string" || token.length < 10) return null;

    // Optional: reject very stale tokens (v3 tokens are short-lived).
    const ts = (data as BackendToken)?.ts ?? Date.now();
    const ageMs = Date.now() - ts;
    // allow up to ~110s; adjust if your generator guarantees fresh tokens
    if (ageMs > 110_000) {
      console.warn(`Recaptcha token stale (age ${ageMs}ms) — discarding`);
      return null;
    }

    return token;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      // no token saved in queue — not an error; just means "try again soon"
      return null;
    }
    console.warn("getRecaptchaTokenFromBackend error:", err?.message || err);
    return null;
  }
}

/** Keep trying backend until we get a token (with capped backoff + jitter). */
async function getRecaptchaTokenForeverFromBackend(): Promise<string> {
  let attempt = 0;
  while (true) {
    attempt++;
    const token = await getRecaptchaTokenFromBackend();
    if (token) return token;

    // 300ms, 600ms, 900ms, ... capped at 5s + small jitter
    const backoff = Math.min(5_000, 300 * attempt);
    const jitter = Math.floor(Math.random() * 250);
    await wait(backoff + jitter);
  }
}

// ---------- CapSolver only ----------
async function getRecaptchaTokenFromCapsolver(): Promise<string | null> {
  try {
    const { data: create } = await axios.post(
      "https://api.capsolver.com/createTask",
      {
        clientKey: API_KEY,
        task: {
          type: "ReCaptchaV3EnterpriseTaskProxyLess",
          websiteURL: PAGE_URL,
          websiteKey: SITE_KEY,
          pageAction: PAGE_ACTION,
        },
      },
      { timeout: 20_000 }
    );
    const taskId = create?.taskId;
    if (!taskId) return null;

    // poll up to ~90s
    for (let i = 0; i < 30; i++) {
      await wait(3000);
      const { data: res } = await axios.post(
        "https://api.capsolver.com/getTaskResult",
        { clientKey: API_KEY, taskId },
        { timeout: 20_000 }
      );
      if (res?.status === "ready") {
        return res?.solution?.gRecaptchaResponse ?? null;
      }
    }
    return null;
  } catch {
    return null;
  }
}
/** Retry CapSolver token forever (exponential backoff with cap) */
async function getRecaptchaTokenForeverFromCapsolver(): Promise<string> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt++;
    const token = await getRecaptchaTokenFromCapsolver();
    if (token) return token;

    const backoffMs = Math.min(30_000, 1000 * attempt); // 1s,2s,... up to 30s
    console.warn(
      `CapSolver attempt ${attempt} failed; retrying in ${backoffMs}ms`
    );
    await wait(backoffMs);
  }
}

async function getRecaptchaTokenForeverHybrid(): Promise<string> {
  let attempt = 0;
  while (true) {
    attempt++;
    const fromBackend = await getRecaptchaTokenFromBackend();
    console.log(fromBackend);
    if (fromBackend) return fromBackend;

    // every Nth miss, try CapSolver as a fallback
    if (attempt % 4 === 0) {
      const fromCap = await getRecaptchaTokenFromCapsolver();
      if (fromCap) return fromCap;
    }

    await wait(Math.min(5_000, 300 * attempt));
  }
}

// ---------- Helpers ----------
type CookieMap = Record<string, string>;
function parseSetCookie(setCookies?: string[] | null): CookieMap {
  const out: CookieMap = {};
  if (!setCookies) return out;
  for (const line of setCookies) {
    const firstPair = line.split(";")[0];
    const idx = firstPair.indexOf("=");
    if (idx === -1) continue;
    const name = firstPair.slice(0, idx).trim();
    const value = firstPair.slice(idx + 1).trim();
    out[name] = value;
  }
  return out;
}

// TODO: implement Gmail/IMAP to read 6-digit code
async function fetchEmailMfaCode(
  since: Date,
  timeoutMs = 120_000
): Promise<string> {
  const code = await fetchClubGGVerificationCode(since, timeoutMs);
  console.log(code, "gamil code");
  if (code) return code;
  throw new Error("No verification code received in time");
}

// ---------- Main login ----------
export async function loginAndGetSid(): Promise<string> {
  let step1Data: any;
  let r1Headers: any;

  // ---- STEP 1: retry UNTIL recaptcha is accepted by backend ----
  let stepAttempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    stepAttempt++;
    const recaptcha = await getRecaptchaTokenForeverFromBackend();
    const p1 = new URLSearchParams({
      id: LOGIN_ID,
      pwd: LOGIN_PWD,
      recaptcha_res: recaptcha,
      mfacode: "",
      os: "Windows",
      os_ver: "10",
      method_type: "",
    });

    const r1 = await axios.post(LOGIN_URL, p1, {
      headers: baseHeaders,
      validateStatus: () => true,
    });
    console.log(r1.data);
    step1Data = r1.data;
    r1Headers = r1.headers; // <-- keep headers for cookies

    const recaptchaFailed =
      step1Data?.err === -2 ||
      /recaptcha/i.test(String(step1Data?.msg)) ||
      /please\s*check\s*recaptcha/i.test(String(step1Data?.msg));

    if (recaptchaFailed) {
      const backoff = Math.min(5000, 100 * stepAttempt); // 0.5s, 1s, 1.5s… up to 5s
      console.warn(
        `Step-1 reCAPTCHA rejected (attempt ${stepAttempt}); retrying in ${backoff}ms`
      );
      await wait(backoff);
      continue; // 🔁 repeat until success
    }

    break; // proceed (MFA or success)
  }

  // ✅ READ COOKIES FROM RESPONSE HEADERS (not step1Data)
  const cookies1 = parseSetCookie((r1Headers as any)?.["set-cookie"]);
  if (
    cookies1["connect.sid"] &&
    step1Data?.err === 0 &&
    !step1Data?.data?.code
  ) {
    return cookies1["connect.sid"]; // no MFA case
  }

  if (
    step1Data?.data?.code === "REQUIRED_MFA_CODE" ||
    step1Data?.data?.description?.codeSent === true
  ) {
    let step2Attempt = 0;
    const mfaRequestedAt = new Date();
    let r2Headers: any;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      step2Attempt++;

      // Always fetch the latest/newer MFA code before retry
      const code = await fetchEmailMfaCode(mfaRequestedAt);
      const recaptcha = await getRecaptchaTokenForeverFromBackend();

      const p2 = new URLSearchParams({
        id: LOGIN_ID,
        pwd: LOGIN_PWD,
        recaptcha_res: recaptcha, // usually ignored in step2
        mfacode: code,
        os: "Windows",
        os_ver: "10",
        method_type: "",
      });

      const r2 = await axios.post(LOGIN_URL, p2, {
        headers: baseHeaders,
        validateStatus: () => true,
      });
      let step2Data = r2.data;
      r2Headers = r2.headers;

      const recaptchaFailed =
        step2Data?.err === -2 ||
        /recaptcha/i.test(String(step2Data?.msg)) ||
        /please\s*check\s*recaptcha/i.test(String(step2Data?.msg));

      if (recaptchaFailed) {
        const backoff = Math.min(5000, 100 * step2Attempt);
        console.warn(
          `Step-2 reCAPTCHA rejected (attempt ${step2Attempt}); retrying in ${backoff}ms`
        );
        await wait(backoff);
        continue; // 🔁 loop until recaptcha passes
      }

      const unmatched =
        step2Data?.data?.code === "UNMATCHED_VERIFICATION_CODE" ||
        /unmatched\s*verification\s*code/i.test(
          String(step2Data?.data?.message)
        );

      if (unmatched) {
        console.warn(
          `MFA code unmatched (attempt ${step2Attempt}); waiting for a new email...`
        );
        await wait(2000);
        continue; // 🔁 retry with new MFA code
      }

      break;
    }

    const cookies2 = parseSetCookie((r2Headers as any)?.["set-cookie"]);
    console.log(cookies2["connect.sid"]);
    return cookies2["connect.sid"]; // no MFA case
  }
  throw new Error(`Unexpected login response: ${JSON.stringify(step1Data)}`);
}

// loginAndGetSid();
