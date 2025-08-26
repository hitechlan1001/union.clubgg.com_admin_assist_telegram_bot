// src/bot/commands/addwl.ts
import type { Telegraf, Context } from "telegraf";
import { parseArgsSafe, cleanId } from "../../utils/parse";
import { canManageClub } from "../../utils/canManageClub";
import { getClubLimit } from "../../library/getClubLimit";
import { setLimit } from "../../library/setLimit";
import { resolveClubId } from "../../utils/clubMap";

export default function registerAddwl(bot: Telegraf<Context>) {
  bot.command("addwl", async (ctx) => {
    try {
      const text = "text" in ctx.message ? ctx.message.text : "";
      const args = parseArgsSafe(text, 2);
      if (!args) return ctx.reply("Usage: /addwl <clubId> <amount>");

      const clubIdStr = cleanId(args[0]);
      const amountStr = args[1].replace(/,/g, "").trim();

      if (!/^\d+$/.test(clubIdStr)) return ctx.reply("❌ Invalid clubId.");
      if (!/^-?\d+$/.test(amountStr)) return ctx.reply("❌ Invalid amount.");

      const backendId = resolveClubId(clubIdStr);
      const clubIdNum = parseInt(backendId, 10);
      const amount = parseInt(amountStr, 10);

      // Role + scope
      const check = canManageClub(ctx, "addwl", clubIdNum);
      if (!check.allowed) return ctx.reply(`❌ ${check.reason}`);

      // Fresh session from middleware
      const sid = ctx.state?.sid;
      if (!sid) return ctx.reply("❌ Session unavailable. Please try again.");

      // Fetch current limits (clubId, sid) ✅
      const current = await getClubLimit(backendId, sid);
      if (!current || !current.INFO) {
        return ctx.reply("❌ Failed to fetch current limits ");
      }

      const prevWin = parseInt(current.INFO.win || "0", 10);
      const prevLoss = parseInt(current.INFO.loss || "0", 10);
      const newWin = prevWin + amount;

      // Update (sid first per your setLimit signature) ✅
      const res = await setLimit(sid, backendId, newWin, prevLoss, 1);
      if (!res)
        return ctx.reply(
          "❌ Failed to update limits (no response from server)"
        );

      return ctx.reply(
        `✅ *Weekly Win Limit Updated Successfully*\n\n` +
          `🏛️ *Club Information*\n` +
          `🔑 Club ID: \`${clubIdStr}\`\n` +
          `📛 Club Name: *${current.INFO.nm}*\n\n` +
          `📊 *Previous Limits:*\n` +
          `• 🟢 Weekly Win Limit: *${prevWin}*\n` +
          `• 🔴 Weekly Loss Limit: *${prevLoss}*\n\n` +
          `📊 *Updated Limits:*\n` +
          `• 🟢 Weekly Win Limit: *${newWin}*\n` +
          `• 🔴 Weekly Loss Limit: *${prevLoss}*`,
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      console.error("Error in /addwl:", err);
      return ctx.reply("❌ Unexpected error while updating win limit.");
    }
  });
}
