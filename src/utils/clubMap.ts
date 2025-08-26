// src/utils/clubMap.ts
export const clubIdMap: Record<string, string> = {
  "492536": "320052",
  "205255": "314660",
  "664054": "309432",
  "451214": "320050",
  "865840": "309424",
  "819983": "188141",
  "949506": "250793",
};

export function resolveClubId(userInput: string): string {
  return clubIdMap[userInput] ?? userInput;
}
