// src/bot/commands/subsl.ts
import type { Telegraf, Context } from "telegraf";
import { parseArgsSafe, cleanId } from "../../utils/parse";
import { canManageClub } from "../../utils/canManageClub";
import { getClubLimit } from "../../library/getClubLimit";
import { setLimit } from "../../library/setLimit";
import { resolveClubId } from "../../utils/clubMap";

export default function registerSubsl(bot: Telegraf<Context>) {
  bot.command("subsl", async (ctx) => {
    try {
      const text = "text" in ctx.message ? ctx.message.text : "";
      const args = parseArgsSafe(text, 2);
      if (!args) return ctx.reply("Usage: /subsl <clubId> <amount>");

      const clubIdStr = cleanId(args[0]);
      const amountStr = args[1].replace(/,/g, "").trim();

      if (!/^\d+$/.test(clubIdStr)) return ctx.reply("❌ Invalid clubId.");
      if (!/^-?\d+$/.test(amountStr)) return ctx.reply("❌ Invalid amount.");

      const backendId = resolveClubId(clubIdStr);
      const clubIdNum = parseInt(backendId, 10);
      const amount = parseInt(amountStr, 10);

      // Role + scope
      const check = canManageClub(ctx, "subsl", clubIdNum);
      if (!check.allowed) return ctx.reply(`❌ ${check.reason}`);

      // Fresh session from middleware
      const sid = ctx.state?.sid;
      if (!sid) return ctx.reply("❌ Session unavailable. Please try again.");

      // Fetch current limits
      const current = await getClubLimit(backendId, sid); // (clubId, sid)
      if (!current || !current.INFO) {
        return ctx.reply("❌ Failed to fetch current limits ");
      }

      const prevWin = parseInt(current.INFO.win || "0", 10);
      const prevLoss = parseInt(current.INFO.loss || "0", 10);
      const newLoss = prevLoss - amount;

      // Update: keep win the same, reduce loss
      const res = await setLimit(sid, backendId, prevWin, newLoss, 1);
      if (!res) return ctx.reply("❌ Failed to update limits.");

      return ctx.reply(
        `✅ *Weekly Loss Limit Updated Successfully*\n\n` +
          `🏛️ *Club Information*\n` +
          `🔑 Club ID: \`${clubIdStr}\`\n` +
          `📛 Club Name: *${current.INFO.nm}*\n\n` +
          `📊 *Previous Limits:*\n` +
          `• 🟢 Weekly Win Limit: *${prevWin}*\n` +
          `• 🔴 Weekly Loss Limit: *${prevLoss}*\n\n` +
          `📊 *Updated Limits:*\n` +
          `• 🟢 Weekly Win Limit: *${prevWin}*\n` +
          `• 🔴 Weekly Loss Limit: *${newLoss}*`,
        { parse_mode: "Markdown" }
      );
    } catch (e) {
      console.error("Error in /subsl:", e);
      return ctx.reply("❌ Unexpected error while updating loss limit.");
    }
  });
}
