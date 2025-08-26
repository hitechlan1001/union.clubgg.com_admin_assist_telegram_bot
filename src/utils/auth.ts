// import type { AxiosError } from "axios";
// import { loginAndGetSid } from "../library/login"; // <- implement this to call your sign-in and return the connect.sid
// // e.g., export async function loginAndGetSid(): Promise<string> { ... }

// let currentSid: string | null = null;
// let expiresAt = 0; // epoch ms
// let refreshing: Promise<string> | null = null;

// // How long to trust a SID before refreshing (ms)
// const SID_TTL_MS = 55 * 60 * 1000; // 55 minutes (safer than 60)

// async function refreshSid(): Promise<string> {
//   if (refreshing) return refreshing; // collapse concurrent refreshes
//   refreshing = (async () => {
//     const sid = await loginAndGetSid(); // MUST return just the raw cookie value
//     currentSid = sid;
//     expiresAt = Date.now() + SID_TTL_MS;
//     refreshing = null;
//     return sid;
//   })();
//   return refreshing;
// }

// /** Get a valid SID (refresh if missing or expired) */
// export async function getSid(force = false): Promise<string> {
//   if (
//     force ||
//     !currentSid ||
//     Date.now() > expiresAt
//   ) {
//     return refreshSid();
//   }
//   return currentSid;
// }

// /**
//  * Wrap an API call that needs a SID.
//  * - Injects SID
//  * - Retries once on 401/invalid-session by refreshing SID
//  */
// export async function withSid<T>(
//   fn: (sid: string) => Promise<T>,
//   isInvalidSession?: (err: unknown) => boolean
// ): Promise<T> {
//   let sid = await getSid();
//   try {
//     return await fn(sid);
//   } catch (e) {
//     const axiosErr = e as AxiosError & { response?: { status?: number; data?: any } };
//     const looksUnauthorized =
//       axiosErr?.response?.status === 401 ||
//       (typeof isInvalidSession === "function" && isInvalidSession(e)) ||
//       // some backends return HTML/login page or a specific flag:
//       (axiosErr?.response?.data && typeof axiosErr.response.data === "string" &&
//         /login|sign\s*in|session/i.test(axiosErr.response.data));

//     if (!looksUnauthorized) throw e;

//     // refresh once and retry
//     sid = await getSid(true);
//     return fn(sid);
//   }
// }

// /** Optional: background refresh (best effort; fine for long-lived processes) */
// export function scheduleSidRefresh() {
//   setInterval(() => {
//     getSid(true).catch((e) => console.error("SID refresh failed:", e));
//   }, SID_TTL_MS);
// }
