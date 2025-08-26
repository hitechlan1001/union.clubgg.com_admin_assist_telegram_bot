import { Context, Telegraf } from "telegraf";
import { TELEGRAM_BOT_TOKEN } from "../config";
import { getClubLimit } from "../library/getClubLimit";
import { setLimit } from "../library/setLimit";
import { sendCredit } from "../library/sendCredit";
import { claimCredit } from "../library/claimCredit";
import { getUserRole, hasPermission } from "../utils/roles"; // import roles helper




const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// Middleware: Authorization & Role-based Club Access
bot.use((ctx, next) => {
  const user = ctx.from;
  if (!user) return;
  const role = getUserRole(user.id);
  if (!role) return ctx.reply("❌ You are not authorized to use this bot.");
  ctx.state.role = role;
  return next();
});

const sid = process.env.CONNECT_SID!;
// /start
bot.start((ctx) => {
  const user = ctx.from!;
  ctx.reply(
    `👋 Hi, *${user.first_name}*!\n\n` +
      `Your Telegram ID: \`${user.id}\`\n` +
      `Chat ID: \`${ctx.chat?.id}\`\n\n` +
      `Use /help to see all commands.`,
    { parse_mode: "Markdown" }
  );
});

// /help
bot.help((ctx) => {
  ctx.reply(
    `📌 *Available Commands*\n\n` +
      `⚙️ *Limits*\n` +
      `• /addwl <id> <amt> — Add Weekly Win Limit\n` +
      `• /subwl <id> <amt> — Subtract Weekly Win Limit\n` +
      `• /addsl <id> <amt> — Add Weekly Loss Limit\n` +
      `• /subsl <id> <amt> — Subtract Weekly Loss Limit\n` +
      `• /setwl <id> <amt> — Set Weekly Win Limit\n` +
      `• /setsl <id> <amt> — Set Weekly Loss Limit\n\n` +
      `👀 *View*\n` +
      `• /cl <id> — View Current Club Limits\n\n` +
      `💰 *Credits*\n` +
      `• /scr <id> <amt> — Send Credits to Club\n` +
      `• /ccr <id> <amt> — Claim Credits from Club\n`,
    { parse_mode: "Markdown" }
  );
});


// Utility: parse arguments
function parseArgs(text: string, expected: number) {
  const args = text.split(" ").slice(1);
  if (args.length < expected) return null;
  return args;
}

// Map bot commands to capability slugs used in your permissions table
const CAP_MAP: Record<string, string> = {
  // viewing
  cl: "view-club-limit",
  // editing limits
  addwl: "set-club-limit",
  subwl: "set-club-limit",
  setwl: "set-club-limit",
  addsl: "set-club-limit",
  subsl: "set-club-limit",
  setsl: "set-club-limit",
  // credits
  scr: "send-credit",
  ccr: "claim-credit",
};

export function canManageClub(
  ctx: Context,
  command: string,
  clubId: number
): { allowed: boolean; reason?: string } {
  const userId = ctx.from?.id;
  if (!userId) return { allowed: false, reason: "User not found" };

  const user = getUserRole(userId);
  if (!user)
    return { allowed: false, reason: "You are not authorized to use this bot" };

  // Check permission (translate command -> capability)
  const cap = CAP_MAP[command] ?? command;
  if (!hasPermission(userId, cap)) {
    return { allowed: false, reason: "Command not permitted for your role" };
  }

  // Scope check: only Union Head can access any club.
  // Region Head / Club Owner must have the club explicitly assigned.
  if (user.role !== "Union Head") {
    const list = Array.isArray(user.clubs) ? user.clubs : [];
    if (!list.includes(clubId)) {
      return {
        allowed: false,
        reason: "You do not have permission to access this club",
      };
    }
  }

  return { allowed: true };
}

// /cl #id
bot.command("cl", async (ctx) => {
  try {
    const text = "text" in ctx.message ? ctx.message.text : "";
    // robust arg parsing (handles extra spaces / NBSP / newlines / "#")
    const args = text
      .replace(/\u00A0/g, " ")
      .trim()
      .split(/\s+/)
      .slice(1);
    if (args.length < 1) return ctx.reply("Usage: /cl <clubId>");

    const clubIdStr = args[0].replace(/^#/, "").replace(/,/g, "").trim();
    if (!/^\d+$/.test(clubIdStr)) {
      return ctx.reply("❌ Invalid clubId. Use a numeric ID, e.g. /cl 250793");
    }
    const clubIdNum = parseInt(clubIdStr, 10);

    // ✅ Use canManageClub to enforce role + club scope
    const check = canManageClub(ctx, "cl", clubIdNum);
    if (!check.allowed) return ctx.reply(`❌ ${check.reason}`);

    // ✅ Correct arg order: (clubId, sid)
    const current = await getClubLimit(clubIdStr, sid);
    if (!current || !current.INFO) {
      return ctx.reply(
        "❌ Failed to fetch current limits "
      );
    }

    const { id, nm, win, loss } = current.INFO;

    return ctx.reply(
      `Club ID: ${id}\n` +
        `Club Name: ${nm}\n\n` +
        `Weekly Win Limit: ${win ?? "N/A"}\n` +
        `Weekly Loss Limit: ${loss ?? "N/A"}`
    );
  } catch (err) {
    console.error("Error in /cl:", err);
    return ctx.reply("❌ Unexpected error while fetching club limits.");
  }
});

// /addwl #id amount
bot.command("addwl", async (ctx) => {
  const args = parseArgs(ctx.message.text, 2);
  if (!args) return ctx.reply("Usage: /addwl <clubId> <amount>");

  const [clubId, amountStr] = args;
  const clubIdNum = parseInt(clubId);
  const check = canManageClub(ctx, "set-club-limit", clubIdNum);
  if (!check.allowed) return ctx.reply(`❌ ${check.reason}`);

  const amount = parseInt(amountStr, 10);

  // ✅ Correct arg order: (clubId, sid)
  const current = await getClubLimit(clubId, sid);
  if (!current || !current.INFO) {
    return ctx.reply("❌ Failed to fetch current limits ");
  }

  const prevWin = parseInt(current.INFO.win || "0", 10);
  const prevLoss = parseInt(current.INFO.loss || "0", 10);
  const newWin = prevWin + amount;

  const res = await setLimit(sid, clubId, newWin, prevLoss, 1);
  if (!res) {
    return ctx.reply("❌ Failed to update limits (no response from server)");
  }

  ctx.reply(
    `✅ Weekly Win Limit Updated Successfully\n\n` +
      `Club ID: ${clubId}\nClub Name: ${current.INFO.nm}\n\n` +
      `Previous Limits:\nWeekly Win Limit: ${prevWin}\nWeekly Loss Limit: ${prevLoss}\n\n` +
      `Current Limits:\nWeekly Win Limit: ${newWin}\nWeekly Loss Limit: ${prevLoss}`
  );
});

// /subwl #id amount
bot.command("subwl", async (ctx) => {
  try {
    const text = "text" in ctx.message ? ctx.message.text : "";
    // normalize whitespace and parse args
    const args = text
      .replace(/\u00A0/g, " ")
      .trim()
      .split(/\s+/)
      .slice(1);
    if (args.length < 2) return ctx.reply("Usage: /subwl <clubId> <amount>");

    const clubIdStr = args[0].replace(/^#/, "").replace(/,/g, "").trim();
    const amountStr = args[1].replace(/,/g, "").trim();

    if (!/^\d+$/.test(clubIdStr)) return ctx.reply("❌ Invalid clubId.");
    if (!/^-?\d+$/.test(amountStr)) return ctx.reply("❌ Invalid amount.");

    const clubIdNum = parseInt(clubIdStr, 10);
    const amount = parseInt(amountStr, 10);

    // permission check (use your real command/capability key)
    const check = canManageClub(ctx, "subwl", clubIdNum); // or "set-club-limit" if you map it
    if (!check.allowed) return ctx.reply(`❌ ${check.reason}`);

    // ✅ correct arg order: (clubId, sid)
    const current = await getClubLimit(clubIdStr, sid);
    if (!current || !current.INFO) {
      return ctx.reply(
        "❌ Failed to fetch current limits "
      );
    }

    const prevWin = parseInt(current.INFO.win || "0", 10);
    const prevLoss = parseInt(current.INFO.loss || "0", 10);
    const newWin = prevWin - amount;

    const res = await setLimit(sid, clubIdStr, newWin, prevLoss, 1);
    if (!res) return ctx.reply("❌ Failed to update limits.");

    return ctx.reply(
      `✅ Weekly Win Limit Updated Successfully\n\n` +
        `Club ID: ${clubIdStr}\nClub Name: ${current.INFO.nm}\n\n` +
        `Previous Limits:\nWeekly Win Limit: ${prevWin}\nWeekly Loss Limit: ${prevLoss}\n\n` +
        `Current Limits:\nWeekly Win Limit: ${newWin}\nWeekly Loss Limit: ${prevLoss}`
    );
  } catch (err) {
    console.error("Error in /subwl:", err);
    return ctx.reply("❌ Unexpected error while updating win limit.");
  }
});

// /addsl #id amount
bot.command("addsl", async (ctx) => {
  try {
    const text = "text" in ctx.message ? ctx.message.text : "";
    const args = text
      .replace(/\u00A0/g, " ")
      .trim()
      .split(/\s+/)
      .slice(1);
    if (args.length < 2) return ctx.reply("Usage: /addsl <clubId> <amount>");

    const clubIdStr = args[0].replace(/^#/, "").replace(/,/g, "").trim();
    const amountStr = args[1].replace(/,/g, "").trim();

    if (!/^\d+$/.test(clubIdStr)) return ctx.reply("❌ Invalid clubId.");
    if (!/^-?\d+$/.test(amountStr)) return ctx.reply("❌ Invalid amount.");

    const clubIdNum = parseInt(clubIdStr, 10);
    const amount = parseInt(amountStr, 10);

    const check = canManageClub(ctx, "addsl", clubIdNum); // or "set-club-limit" if you map commands -> caps
    if (!check.allowed) return ctx.reply(`❌ ${check.reason}`);

    // ✅ correct order
    const current = await getClubLimit(clubIdStr, sid);
    if (!current || !current.INFO) {
      return ctx.reply(
        "❌ Failed to fetch current limits "
      );
    }

    const prevWin = parseInt(current.INFO.win || "0", 10);
    const prevLoss = parseInt(current.INFO.loss || "0", 10);
    const newLoss = prevLoss + amount;

    const res = await setLimit(sid, clubIdStr, prevWin, newLoss, 1);
    if (!res) return ctx.reply("❌ Failed to update limits.");

    return ctx.reply(
      `✅ Weekly Loss Limit Updated Successfully\n\n` +
        `Club ID: ${clubIdStr}\nClub Name: ${current.INFO.nm}\n\n` +
        `Previous Limits:\nWeekly Win Limit: ${prevWin}\nWeekly Loss Limit: ${prevLoss}\n\n` +
        `Current Limits:\nWeekly Win Limit: ${prevWin}\nWeekly Loss Limit: ${newLoss}`
    );
  } catch (e) {
    console.error("Error in /addsl:", e);
    return ctx.reply("❌ Unexpected error while updating loss limit.");
  }
});

// /subsl #id amount
bot.command("subsl", async (ctx) => {
  try {
    const text = "text" in ctx.message ? ctx.message.text : "";
    const args = text
      .replace(/\u00A0/g, " ")
      .trim()
      .split(/\s+/)
      .slice(1);
    if (args.length < 2) return ctx.reply("Usage: /subsl <clubId> <amount>");

    const clubIdStr = args[0].replace(/^#/, "").replace(/,/g, "").trim();
    const amountStr = args[1].replace(/,/g, "").trim();

    if (!/^\d+$/.test(clubIdStr)) return ctx.reply("❌ Invalid clubId.");
    if (!/^-?\d+$/.test(amountStr)) return ctx.reply("❌ Invalid amount.");

    const clubIdNum = parseInt(clubIdStr, 10);
    const amount = parseInt(amountStr, 10);

    const check = canManageClub(ctx, "subsl", clubIdNum); // or "set-club-limit"
    if (!check.allowed) return ctx.reply(`❌ ${check.reason}`);

    // ✅ correct order
    const current = await getClubLimit(clubIdStr, sid);
    if (!current || !current.INFO) {
      return ctx.reply(
        "❌ Failed to fetch current limits "
      );
    }

    const prevWin = parseInt(current.INFO.win || "0", 10);
    const prevLoss = parseInt(current.INFO.loss || "0", 10);
    const newLoss = prevLoss - amount;

    const res = await setLimit(sid, clubIdStr, prevWin, newLoss, 1);
    if (!res) return ctx.reply("❌ Failed to update limits.");

    return ctx.reply(
      `✅ Weekly Loss Limit Updated Successfully\n\n` +
        `Club ID: ${clubIdStr}\nClub Name: ${current.INFO.nm}\n\n` +
        `Previous Limits:\nWeekly Win Limit: ${prevWin}\nWeekly Loss Limit: ${prevLoss}\n\n` +
        `Current Limits:\nWeekly Win Limit: ${prevWin}\nWeekly Loss Limit: ${newLoss}`
    );
  } catch (e) {
    console.error("Error in /subsl:", e);
    return ctx.reply("❌ Unexpected error while updating loss limit.");
  }
});

// /setsl #id amount
bot.command("setsl", async (ctx) => {
  try {
    const text = "text" in ctx.message ? ctx.message.text : "";
    const args = text
      .replace(/\u00A0/g, " ")
      .trim()
      .split(/\s+/)
      .slice(1);
    if (args.length < 2) return ctx.reply("Usage: /setsl <clubId> <amount>");

    const clubIdStr = args[0].replace(/^#/, "").replace(/,/g, "");
    const amountStr = args[1].replace(/,/g, "");
    if (!/^\d+$/.test(clubIdStr)) return ctx.reply("❌ Invalid clubId.");
    if (!/^-?\d+$/.test(amountStr)) return ctx.reply("❌ Invalid amount.");

    const clubIdNum = parseInt(clubIdStr, 10);
    const amount = parseInt(amountStr, 10);

    const check = canManageClub(ctx, "setsl", clubIdNum); // or "set-club-limit" if you map it
    if (!check.allowed) return ctx.reply(`❌ ${check.reason}`);

    // ✅ correct order
    const current = await getClubLimit(clubIdStr, sid);
    if (!current || !current.INFO) {
      return ctx.reply(
        "❌ Failed to fetch current limits "
      );
    }

    const prevWin = parseInt(current.INFO.win || "0", 10);
    const prevLoss = parseInt(current.INFO.loss || "0", 10);

    const res = await setLimit(sid, clubIdStr, prevWin, amount, 1);
    if (!res) return ctx.reply("❌ Failed to update limits.");

    return ctx.reply(
      `✅ Weekly Loss Limit Updated Successfully\n\n` +
        `Club ID: ${clubIdStr}\nClub Name: ${current.INFO.nm}\n\n` +
        `Previous Limits:\nWeekly Win Limit: ${prevWin}\nWeekly Loss Limit: ${prevLoss}\n\n` +
        `Current Limits:\nWeekly Win Limit: ${prevWin}\nWeekly Loss Limit: ${amount}`
    );
  } catch (e) {
    console.error("Error in /setsl:", e);
    return ctx.reply("❌ Unexpected error while updating loss limit.");
  }
});

// /setwl #id amount
bot.command("setwl", async (ctx) => {
  try {
    const text = "text" in ctx.message ? ctx.message.text : "";
    const args = text
      .replace(/\u00A0/g, " ")
      .trim()
      .split(/\s+/)
      .slice(1);
    if (args.length < 2) return ctx.reply("Usage: /setwl <clubId> <amount>");

    const clubIdStr = args[0].replace(/^#/, "").replace(/,/g, "");
    const amountStr = args[1].replace(/,/g, "");
    if (!/^\d+$/.test(clubIdStr)) return ctx.reply("❌ Invalid clubId.");
    if (!/^-?\d+$/.test(amountStr)) return ctx.reply("❌ Invalid amount.");

    const clubIdNum = parseInt(clubIdStr, 10);
    const amount = parseInt(amountStr, 10);

    const check = canManageClub(ctx, "setwl", clubIdNum); // or "set-club-limit"
    if (!check.allowed) return ctx.reply(`❌ ${check.reason}`);

    // ✅ correct order
    const current = await getClubLimit(clubIdStr, sid);
    if (!current || !current.INFO) {
      return ctx.reply(
        "❌ Failed to fetch current limits "
      );
    }

    const prevWin = parseInt(current.INFO.win || "0", 10);
    const prevLoss = parseInt(current.INFO.loss || "0", 10);

    const res = await setLimit(sid, clubIdStr, amount, prevLoss, 1);
    if (!res) return ctx.reply("❌ Failed to update limits.");

    return ctx.reply(
      `✅ Weekly Win Limit Updated Successfully\n\n` +
        `Club ID: ${clubIdStr}\nClub Name: ${current.INFO.nm}\n\n` +
        `Previous Limits:\nWeekly Win Limit: ${prevWin}\nWeekly Loss Limit: ${prevLoss}\n\n` +
        `Current Limits:\nWeekly Win Limit: ${amount}\nWeekly Loss Limit: ${prevLoss}`
    );
  } catch (e) {
    console.error("Error in /setwl:", e);
    return ctx.reply("❌ Unexpected error while updating win limit.");
  }
});

bot.command("scr", async (ctx) => {
  const text = "text" in ctx.message ? ctx.message.text : "";
  const args = text
    .replace(/\u00A0/g, " ")
    .trim()
    .split(/\s+/)
    .slice(1);
  if (args.length < 2) return ctx.reply("Usage: /scr <clubId> <amount>");

  const clubId = args[0].replace(/^#/, "").replace(/,/g, "");
  const amountStr = args[1].replace(/,/g, "");
  if (!/^\d+$/.test(clubId)) return ctx.reply("❌ Invalid clubId.");
  if (!/^\d+$/.test(amountStr)) return ctx.reply("❌ Invalid amount.");

  const amount = parseInt(amountStr, 10);

  const check = canManageClub(ctx, "scr", parseInt(clubId, 10));
  if (!check.allowed) return ctx.reply(`❌ ${check.reason}`);

  const res = await sendCredit(sid, clubId, amount);
  if (!res) return ctx.reply("❌ Failed to send credits (no response)");

  if (!res.ok) {
    return ctx.reply(
      `❌ Failed to send credits${res.message ? `: ${res.message}` : ""}`
    );
  }

  return ctx.reply(
    `✅ Sent ${amount} credits to Club ${clubId}` +
      (res.message ? `\n${res.message}` : "") +
      (typeof res.balance === "number"
        ? `\nRemaining balance: ${res.balance}`
        : "")
  );
});

// /ccr #id amount
bot.command("ccr", async (ctx) => {
  const text = "text" in ctx.message ? ctx.message.text : "";
  const args = text
    .replace(/\u00A0/g, " ")
    .trim()
    .split(/\s+/)
    .slice(1);
  if (args.length < 2) return ctx.reply("Usage: /ccr <clubId> <amount>");

  const clubId = args[0].replace(/^#/, "").replace(/,/g, "");
  const amountStr = args[1].replace(/,/g, "");
  if (!/^\d+$/.test(clubId)) return ctx.reply("❌ Invalid clubId.");
  if (!/^\d+$/.test(amountStr)) return ctx.reply("❌ Invalid amount.");

  const amount = parseInt(amountStr, 10);

  const check = canManageClub(ctx, "ccr", parseInt(clubId, 10));
  if (!check.allowed) return ctx.reply(`❌ ${check.reason}`);

  // ✅ (clubId, sid, amount)
  const res = await claimCredit(clubId, sid, amount);
  if (!res) return ctx.reply("❌ Failed to claim credits (no response)");
  if (!res.ok)
    return ctx.reply(
      `❌ Failed to claim credits${res.message ? `: ${res.message}` : ""}`
    );

  return ctx.reply(
    `✅ Claimed ${amount} credits from Club ${clubId}` +
      (res.message ? `\n${res.message}` : "")
  );
});

bot.launch().then(() => console.log("✅ Telegram bot started"));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
