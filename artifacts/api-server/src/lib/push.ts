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
  if (tokens.length === 0) return;

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
        console.error(`Expo push request failed: ${res.status} ${await res.text().catch(() => "")}`);
        continue;
      }
      const json = (await res.json()) as { data?: Array<{ status: string; details?: { error?: string } }> };
      json.data?.forEach((ticket, idx) => {
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
          staleTokens.push(chunk[idx]);
        }
      });
    } catch (err) {
      console.error("Expo push request failed:", err);
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
