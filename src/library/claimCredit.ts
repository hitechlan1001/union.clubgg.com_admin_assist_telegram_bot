// claimCredit.ts
import axios from "axios";

export interface ClaimCreditResult {
  ok: boolean;
  message?: string;
  successClubIds?: string[];
  raw?: any;
}

/**
 * Claim credits from ClubGG union counter
 */
export async function claimCredit(
  clubId: string,
  connectSid: string,
  amount: number
): Promise<ClaimCreditResult | null> {
  try {
    const url = "https://union.clubgg.com/counteru";
    const headers = {
      Accept: "*/*",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: "https://union.clubgg.com",
      Referer: "https://union.clubgg.com/counteru",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
      Cookie: `connect.sid=${connectSid}`,
    };

    const payload = new URLSearchParams({
      iam: "claimback",
      clubstr: `${clubId},${amount}`,
    });

    const { data } = await axios.post(url, payload, { headers });

    const msg = Array.isArray(data?.msg) ? data.msg.join(" ") : data?.msg;
    const successClubIds: string[] = Array.isArray(data?.success_list) ? data.success_list : [];
    const ok =
      (typeof data?.err === "number" && data.err === 0) ||
      (successClubIds.length > 0 && successClubIds.includes(clubId));

    return {
      ok,
      message: typeof msg === "string" ? msg.replace(/<[^>]*>/g, "") : undefined,
      successClubIds,
      raw: data,
    };
  } catch (err) {
    console.error("Claim credit request error:", err);
    return null;
  }
}
