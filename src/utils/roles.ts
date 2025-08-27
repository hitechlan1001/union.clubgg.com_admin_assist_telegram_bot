export type Role = "Union Head" | "Region Head" | "Club Owner";

export interface UserRole {
  userId: number;
  role: Role;
  clubs?: number[]; // Club IDs this user can manage/view
}

export const userRoles: UserRole[] = [
  { userId: 7978542634, role: "Union Head" },
  { userId: 846248501, role: "Union Head" },
  { userId: 684211566, role: "Union Head" },
  { userId: 326695362, role: "Union Head" },
  { userId: 7978542634, role: "Region Head", clubs: [250793, 102, 103] },
  { userId: 7978542634, role: "Club Owner", clubs: [250793] },
  // Add more as needed
];

export const permissions: Record<Role, string[]> = {
  "Union Head": ["set-global-limit", "set-region-limit", "set-club-limit", "send-credit", "claim-credit", "view-club-limit"],
  "Region Head": ["set-region-limit", "set-club-limit", "view-club-limit"],
  "Club Owner": ["view-club-limit"], // 👈 only this
};

const COMMAND_TO_CAP: Record<string, string> = {
  addwl: "set-club-limit",
  subwl: "set-club-limit",
  setwl: "set-club-limit",
  addsl: "set-club-limit",
  subsl: "set-club-limit",
  setsl: "set-club-limit",
  cl: "view-club-limit",   // 👈 map /cl to "view-club-limit"
  scr: "send-credit",
  ccr: "claim-credit",
};

export function hasPermission(userId: number, command: string): boolean {
  const user = userRoles.find((u) => u.userId === userId);
  if (!user) return false;

  const cap = COMMAND_TO_CAP[command] ?? command;
  return permissions[user.role].includes(cap);
}

export function getUserRole(userId: number): UserRole | undefined {
  return userRoles.find((u) => u.userId === userId);
}
