import axios from "axios";

interface SetLimitResponse {}

/**
 * Set club win/loss limit
 * @param connectSid Session cookie
 * @param clubId Club number (cno)
 * @param win Win cap value
 * @param loss Stop loss value
 * @param include Include flag (1 or 0)
 */
export async function setLimit(
  connectSid: string,
  clubId: string,
  win: number,
  loss: number,
  include: number = 1
): Promise<SetLimitResponse | null> {
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

    const payload = new URLSearchParams({
      iam: "edit",
      cno: clubId,
      win: win.toString(),
      loss: loss.toString(),
      include: include.toString(),
    });

    const response = await axios.post(url, payload, { headers });

    return response.data as SetLimitResponse;
  } catch (err) {
    console.error("Set limit request error:", err);
    return null;
  }
}
