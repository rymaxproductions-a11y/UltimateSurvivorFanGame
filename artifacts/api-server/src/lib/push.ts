import { eq, inArray } from "drizzle-orm";
import { db, pushTokensTable } from "@workspace/db";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Send an Expo push notification to the given tokens.
 * Removes tokens Expo reports as no longer registered.
 * Never throws — push delivery is best-effort.
 */
export async function sendPush(tokens: string[], message: PushMessage): Promise<void> {
  if (tokens.length === 0) {
    console.info("[push] sendPush called with 0 tokens — nothing to send");
    return;
  }

  console.info(`[push] Sending to ${tokens.length} token(s): title="${message.title}"`);

  const staleTokens: string[] = [];

  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(
          chunk.map((to) => ({
            to,
            title: message.title,
            body: message.body,
            data: message.data ?? {},
            sound: "default",
          })),
        ),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(`[push] Expo push HTTP ${res.status}: ${text}`);
        continue;
      }
      const json = (await res.json()) as { data?: Array<{ status: string; id?: string; details?: { error?: string; message?: string } }> };
      console.info(`[push] Expo raw response: ${JSON.stringify(json)}`);
      json.data?.forEach((ticket, idx) => {
        if (ticket.status === "error") {
          const errCode = ticket.details?.error;
          console.error(`[push] Ticket error for token ...${chunk[idx].slice(-10)}: error=${errCode} msg=${ticket.details?.message}`);
          if (errCode === "DeviceNotRegistered") {
            staleTokens.push(chunk[idx]);
          }
          // InvalidCredentials = APNs/FCM creds not configured in EAS project.
          // Fix: run `eas credentials` in artifacts/survivor-mobile, upload push
          // credentials, then rebuild the app.
          if (errCode === "InvalidCredentials") {
            console.error("[push] ACTION REQUIRED: EAS project missing APNs/FCM credentials. Run `eas credentials` in artifacts/survivor-mobile and rebuild.");
          }
        } else {
          console.info(`[push] Ticket ok for token ...${chunk[idx].slice(-10)}: receiptId=${ticket.id}`);
        }
      });
    } catch (err) {
      console.error("[push] Expo push request threw:", err);
    }
  }

  if (staleTokens.length > 0) {
    try {
      await db.delete(pushTokensTable).where(inArray(pushTokensTable.token, staleTokens));
    } catch (err) {
      console.error("Failed to prune stale push tokens:", err);
    }
  }
}

/** All push tokens registered by the given users. */
export async function tokensForUsers(userIds: number[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({ token: pushTokensTable.token })
    .from(pushTokensTable)
    .where(inArray(pushTokensTable.userId, userIds));
  return rows.map((r) => r.token);
}

/** Every registered push token (for admin broadcasts). */
export async function allTokens(): Promise<{ tokens: string[]; userCount: number }> {
  const rows = await db
    .select({ token: pushTokensTable.token, userId: pushTokensTable.userId })
    .from(pushTokensTable);
  return {
    tokens: rows.map((r) => r.token),
    userCount: new Set(rows.map((r) => r.userId)).size,
  };
}
