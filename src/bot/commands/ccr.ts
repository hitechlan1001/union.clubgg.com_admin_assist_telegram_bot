// src/bot/commands/ccr.ts
import type { Telegraf, Context } from "telegraf";
import { parseArgsSafe, cleanId } from "../../utils/parse";
import { canManageClub } from "../../utils/canManageClub";
import { claimCredit } from "../../library/claimCredit";
import { resolveClubId } from "../../utils/clubMap";

export default function registerCcr(bot: Telegraf<Context>) {
  bot.command("ccr", async (ctx) => {
    try {
      const text = "text" in ctx.message ? ctx.message.text : "";
      const args = parseArgsSafe(text, 2);
      if (!args) return ctx.reply("Usage: /ccr <clubId> <amount>");

      const clubIdStr = cleanId(args[0]);
      const amountStr = args[1].replace(/,/g, "").trim();

      if (!/^\d+$/.test(clubIdStr)) return ctx.reply("❌ Invalid clubId.");
      if (!/^\d+$/.test(amountStr)) return ctx.reply("❌ Invalid amount.");

      const backendId = resolveClubId(clubIdStr);
      const clubIdNum = parseInt(backendId, 10);
      const amount = parseInt(amountStr, 10);

      // Role + scope
      const check = canManageClub(ctx, "ccr", clubIdNum);
      if (!check.allowed) return ctx.reply(`❌ ${check.reason}`);

      // Fresh SID from middleware
      const sid = ctx.state?.sid;
      if (!sid) return ctx.reply("❌ Session unavailable. Please try again.");

      // (clubId, sid, amount) — using normalized claimCredit that returns { ok, message }
      const res = await claimCredit(backendId, sid, amount);
      if (!res) return ctx.reply("❌ Failed to claim credits (no response)");
      if (!res.ok) {
        return ctx.reply(
          `❌ Failed to claim credits${res.message ? `: ${res.message}` : ""}`
        );
      }

      return ctx.reply(
        `✅ *Credits Claimed Successfully*\n\n` +
          `🏛️ *Club Information*\n` +
          `🔑 Club ID : \`${clubIdStr}\`\n` +
          `💳 *Transaction*\n` +
          `• Amount: *${amount}*\n` +
          (res.message ? `\n📝 ${res.message}` : ""),
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      console.error("Error in /ccr:", err);
      return ctx.reply("❌ Unexpected error while claiming credits.");
    }
  });
}
