import dotenv from "dotenv";
dotenv.config();

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
export const AUTHORIZED_USERS = (process.env.AUTHORIZED_USERS || "")
  .split(",")
  .map((id) => parseInt(id));
