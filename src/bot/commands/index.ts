// src/bot/commands/index.ts
import type { Telegraf, Context } from "telegraf";

import registerStart from "./start";
import registerHelp from "./help";
import registerCl from "./cl";
import registerAddwl from "./addwl";
import registerSubwl from "./subwl";
import registerAddsl from "./addsl";
import registerSubsl from "./subsl";
import registerSetwl from "./setwl";
import registerSetsl from "./setsl";
import registerScr from "./scr";
import registerCcr from "./ccr";

export function registerAllCommands(bot: Telegraf<Context>) {
  registerStart(bot);
  registerHelp(bot);
  registerCl(bot);
  registerAddwl(bot);
  registerSubwl(bot);
  registerAddsl(bot);
  registerSubsl(bot);
  registerSetwl(bot);
  registerSetsl(bot);
  registerScr(bot);
  registerCcr(bot);
}
