// src/bot/commandsList.ts
import type { BotCommand } from "telegraf/types";

export const commands: BotCommand[] = [
  { command: "start", description: "Start the bot" },
  { command: "help", description: "Show available commands" },

  // Club limit management
  { command: "cl", description: "View current limits for a club" },
  { command: "addwl", description: "Add to Weekly Win Limit" },
  { command: "subwl", description: "Subtract from Weekly Win Limit" },
  { command: "setwl", description: "Set Weekly Win Limit" },
  { command: "addsl", description: "Add to Weekly Loss Limit" },
  { command: "subsl", description: "Subtract from Weekly Loss Limit" },
  { command: "setsl", description: "Set Weekly Loss Limit" },

  // Credit management
  { command: "scr", description: "Send credits to a club" },
  { command: "ccr", description: "Claim credits from a club" },
];
