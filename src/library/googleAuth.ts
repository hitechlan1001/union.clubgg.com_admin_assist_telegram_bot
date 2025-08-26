// src/gmail/auth.ts
import { google } from "googleapis";

export function gmailAuthFromEnv() {
  const client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID!,
    process.env.GMAIL_CLIENT_SECRET!,
    "urn:ietf:wg:oauth:2.0:oob" // not used at runtime; refresh token powers this
  );
  client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN! });
  return google.gmail({ version: "v1", auth: client });
}
