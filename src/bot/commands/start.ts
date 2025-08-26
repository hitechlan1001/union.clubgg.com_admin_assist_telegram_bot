// src/bot/commands/start.ts
import type { Telegraf, Context } from "telegraf";

export default function registerStart(bot: Telegraf<Context>) {
  bot.start((ctx) => {
    const user = ctx.from!;
    ctx.reply(
      `👋 Welcome, *${user.first_name}*!\n\n` +
        `📌 *Your Details:*\n` +
        `• 🆔 Telegram ID: \`${user.id}\`\n` +
        `• 💬 Chat ID: \`${ctx.chat?.id}\`\n\n` +
        `⚡ Use /help anytime to see the list of available commands.`,
      { parse_mode: "Markdown" }
    );
  });
}
