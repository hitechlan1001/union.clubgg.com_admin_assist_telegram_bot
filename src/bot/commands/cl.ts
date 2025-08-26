// src/bot/commands/cl.ts
import type { Telegraf, Context } from "telegraf";
import { parseArgsSafe, cleanId } from "../../utils/parse";
import { canManageClub } from "../../utils/canManageClub";
import { getClubLimit } from "../../library/getClubLimit";
import { resolveClubId } from "../../utils/clubMap";
import { getClubPnLForClub } from "../../library/getClubPnLForClub";

export default function registerCl(bot: Telegraf<Context>) {
  bot.command("cl", async (ctx) => {
    try {
      const text = "text" in ctx.message ? ctx.message.text : "";
      const args = parseArgsSafe(text, 1);
      if (!args) return ctx.reply("Usage: /cl <clubId>");

      const clubIdStr = cleanId(args[0]);
      if (!/^\d+$/.test(clubIdStr)) {
        return ctx.reply(
          "❌ Invalid clubId. Use a numeric ID, e.g. /cl 250793"
        );
      }
      const backendId = resolveClubId(clubIdStr);
      const clubIdNum = parseInt(backendId, 10);

      // Permission + scope check
      const check = canManageClub(ctx, "cl", clubIdNum);
      if (!check.allowed) return ctx.reply(`❌ ${check.reason}`);

      // Fresh session from middleware
      const sid = ctx.state?.sid;
      if (!sid) return ctx.reply("❌ Session unavailable. Please try again.");

      // Correct arg order: (clubId, sid)
      const current = await getClubLimit(backendId, sid);
      if (!current || !current.INFO) {
        return ctx.reply("❌ Failed to fetch current limits ");
      }

      const { id, nm, win, loss } = current.INFO;
      // P&L (LIST row)
      const pnl = await getClubPnLForClub(backendId, sid);
      const ring = pnl?.ringPnl ?? 0;
      const tour = pnl?.tourneyPnl ?? 0;
      const weeklyEarnings = ring + tour;

      return ctx.reply(
        `🏛️ *Club Information*\n\n` +
          `🔑 *Club ID:* \`${id}\`\n` +
          `📛 *Club Name:* *${nm}*\n\n` +
          `⚙️ *Limits:*\n` +
          `• 🟢 Weekly Win Limit: *${win ?? "N/A"}*\n` +
          `• 🔴 Weekly Loss Limit: *${loss ?? "N/A"}*\n\n` +
          `💰 *Weekly Club Earnings:* *${weeklyEarnings}*`,
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      console.error("Error in /cl:", err);
      return ctx.reply("❌ Unexpected error while fetching club limits.");
    }
  });
}
