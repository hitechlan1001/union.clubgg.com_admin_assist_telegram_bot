// src/bot/bot.ts
import { Telegraf } from "telegraf";
import type { Context } from "telegraf";
import { TELEGRAM_BOT_TOKEN } from "../config";
import { registerAllCommands } from "./commands";
import { commands } from "./commandsList";
import { loginAndGetSid } from "../library/login";

const bot = new Telegraf<Context>(TELEGRAM_BOT_TOKEN);

bot.telegram.setMyCommands(commands);

// keep sid in memory
let sid: string | null = null;

async function refreshSid() {
  try {
    console.log("🔄 Refreshing connect.sid...");
    sid = await loginAndGetSid();
    console.log("✅ New sid =", sid);
  } catch (err) {
    console.error("❌ Failed to refresh sid:", err);
  }
}

async function main() {
  // refresh sid at startup
  await refreshSid();

  // repeat every hour
  setInterval(refreshSid, 60 * 10 * 1000);
  // const sid = process.env.CONNECT_SID!;

  // middleware: inject sid into ctx.state
  bot.use(async (ctx, next) => {
    (ctx.state as any).sid = sid;
    return next();
  });

  registerAllCommands(bot);
  bot.launch();
}

main();
