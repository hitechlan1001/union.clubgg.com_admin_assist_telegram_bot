// getclublimit.ts
import axios from "axios";

interface ClubLimitInfo {
  img: string;
  nm: string;
  id: string;
  master: string;
  win: string;
  loss: string;
  include: boolean | string;
}
interface ClubLimitResponse {
  INFO?: ClubLimitInfo;
}

export async function getClubLimit(
  clubId: string,
  connectSid: string
): Promise<ClubLimitResponse | null> {
  try {
    const url = "https://union.clubgg.com/clublimit";
    const headers = {
      Accept: "*/*",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: "https://union.clubgg.com",
      Referer: "https://union.clubgg.com/clublimit",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
      Cookie: `connect.sid=${connectSid}`,
    };

    const payload = new URLSearchParams({ iam: "view", cno: clubId });
    const response = await axios.post(url, payload, { headers });

    // Defensive: ensure shape
    const data = response.data as ClubLimitResponse;
    if (!data || typeof data !== "object" || !("INFO" in data)) {
      console.error("Unexpected clublimit response shape:", response.data);
      return null;
    }
    return data;
  } catch (err: any) {
    // Better diagnostics
    if (err.response) {
      console.error("Club limit request error:", {
        status: err.response.status,
        headers: err.response.headers,
        data: err.response.data?.slice?.(0, 500) ?? err.response.data,
      });
    } else {
      console.error("Club limit request error:", err.message || err);
    }
    return null;
  }
}
