// src/library/getClubPnLForClub.ts
import axios from "axios";

function parseNum(n?: string): number {
  if (!n) return 0;
  const v = Number(String(n).replace(/,/g, "").trim());
  return Number.isFinite(v) ? v : 0;
}

/** Fetch ring & tournament P&L for a single club by backendId (cno). */
export async function getClubPnLForClub(
  backendId: string,
  connectSid: string
): Promise<{ publicId: string; ringPnl: number; tourneyPnl: number } | null> {
  const url = "https://union.clubgg.com/clublist";
  const headers = {
    Accept: "*/*",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Origin: "https://union.clubgg.com",
    Referer: "https://union.clubgg.com/clublist",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    Cookie: `connect.sid=${connectSid}`,
  };

  // first page
  const firstPayload = new URLSearchParams({
    iam: "list",
    clubnm: "",
    cur_page: "1",
    clubmn: "clubnm",
    acs: "1",
  });
  const first = await axios.post(url, firstPayload, { headers });
  const totPages = Number(first.data?.PAGE?.tot_pages || 1);

  const findIn = (resp: any) => {
    for (const r of resp?.DATA ?? []) {
      if (r?.cno === backendId) {
        return {
          publicId: String(r.f1 ?? ""),
          ringPnl: parseNum(r.f4), // Ring Game P&L
          tourneyPnl: parseNum(r.f5), // Tournament P&L
        };
      }
    }
    return null;
  };

  let hit = findIn(first.data);
  if (hit) return hit;

  for (let p = 2; p <= totPages; p++) {
    const payload = new URLSearchParams({
      iam: "list",
      clubnm: "",
      cur_page: String(p),
      clubmn: "clubnm",
      acs: "1",
    });
    const resp = await axios.post(url, payload, { headers });
    hit = findIn(resp.data);
    if (hit) return hit;
  }

  return null;
}
