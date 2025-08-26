// src/bot/commands/scr.ts
import type { Telegraf, Context } from "telegraf";
import { parseArgsSafe, cleanId } from "../../utils/parse";
import { canManageClub } from "../../utils/canManageClub";
import { sendCredit } from "../../library/sendCredit";
import { resolveClubId } from "../../utils/clubMap";

export default function registerScr(bot: Telegraf<Context>) {
  bot.command("scr", async (ctx) => {
    try {
      const text = "text" in ctx.message ? ctx.message.text : "";
      const args = parseArgsSafe(text, 2);
      if (!args) return ctx.reply("Usage: /scr <clubId> <amount>");

      const clubIdStr = cleanId(args[0]);
      const amountStr = args[1].replace(/,/g, "").trim();

      if (!/^\d+$/.test(clubIdStr)) return ctx.reply("❌ Invalid clubId.");
      if (!/^\d+$/.test(amountStr)) return ctx.reply("❌ Invalid amount.");

      const backendId = resolveClubId(clubIdStr);
      const clubIdNum = parseInt(backendId, 10);
      const amount = parseInt(amountStr, 10);

      // Permission check
      const check = canManageClub(ctx, "scr", clubIdNum);
      if (!check.allowed) return ctx.reply(`❌ ${check.reason}`);

      // Fresh session from middleware
      const sid = ctx.state?.sid;
      if (!sid) return ctx.reply("❌ Session unavailable. Please try again.");

      // Call API
      const res = await sendCredit(sid, backendId, amount);
      if (!res) return ctx.reply("❌ Failed to send credits (no response)");
      if (!res.ok) {
        return ctx.reply(
          `❌ Failed to send credits${res.message ? `: ${res.message}` : ""}`
        );
      }
      return ctx.reply(
        `✅ *Credits Sent Successfully*\n\n` +
          `🏛️ *Club Information*\n` +
          `🔑 Club ID : \`${clubIdStr}\`\n` +
          `💳 *Transaction*\n` +
          `• Amount: *${amount}*\n` +
          (res.message ? `\n📝 ${res.message}` : ""),
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      console.error("Error in /scr:", err);
      return ctx.reply("❌ Unexpected error while sending credits.");
    }
  });
}
