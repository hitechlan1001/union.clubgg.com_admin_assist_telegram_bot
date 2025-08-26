// src/utils/canManageClub.ts
import type { Context } from "telegraf";
import { getUserRole, hasPermission } from "./roles";

const CAP_MAP: Record<string, string> = {
  cl: "view-club-limit",
  addwl: "set-club-limit",
  subwl: "set-club-limit",
  setwl: "set-club-limit",
  addsl: "set-club-limit",
  subsl: "set-club-limit",
  setsl: "set-club-limit",
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
  if (!user) return { allowed: false, reason: "You are not authorized to use this bot" };

  const cap = CAP_MAP[command] ?? command;
  if (!hasPermission(userId, cap)) {
    return { allowed: false, reason: "Command not permitted for your role" };
  }

  if (user.role !== "Union Head") {
    const list = Array.isArray(user.clubs) ? user.clubs : [];
    if (!list.includes(clubId)) {
      return { allowed: false, reason: "You do not have permission to access this club" };
    }
  }

  return { allowed: true };
}
