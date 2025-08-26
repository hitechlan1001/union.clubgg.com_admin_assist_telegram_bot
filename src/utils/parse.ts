// src/utils/parse.ts
export function parseArgsSafe(text: string, min = 0) {
  const clean = (text || "").replace(/\u00A0/g, " ").trim();
  const parts = clean.split(/\s+/);
  const args = parts.slice(1); // skip command itself
  return args.length >= min ? args : null;
}

export function cleanId(s: string) {
  return s.replace(/^#/, "").replace(/,/g, "").trim();
}
