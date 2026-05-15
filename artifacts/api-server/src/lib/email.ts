// Resend integration via Replit Connectors.
// Credentials are fetched dynamically per the Resend blueprint instructions —
// never cached because access tokens can rotate.
import { Resend } from "resend";

interface ResendCredentials {
  apiKey: string;
  fromEmail: string;
}

let cachedFromEmail: string | undefined;

async function getResendCredentials(): Promise<ResendCredentials> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) throw new Error("X-Replit-Token not found for repl/depl");
  if (!hostname) throw new Error("REPLIT_CONNECTORS_HOSTNAME not set");

  const res = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    },
  );
  const data = (await res.json()) as { items?: Array<{ settings?: { api_key?: string; from_email?: string } }> };
  const item = data?.items?.[0];
  if (!item || !item.settings?.api_key) {
    throw new Error("Resend not connected");
  }
  const fromEmail = item.settings.from_email ?? "onboarding@resend.dev";
  cachedFromEmail = fromEmail;
  return {
    apiKey: item.settings.api_key,
    fromEmail,
  };
}

export async function sendPasswordResetEmail(args: {
  to: string;
  code: string;
  username?: string | null;
}): Promise<void> {
  const { apiKey, fromEmail } = await getResendCredentials();
  const client = new Resend(apiKey);

  const greeting = args.username ? `Hi ${args.username},` : "Hi,";
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <h1 style="font-size: 22px; margin: 0 0 16px;">Reset your Survivor Pick'em password</h1>
      <p style="margin: 0 0 16px;">${greeting}</p>
      <p style="margin: 0 0 16px;">Use this 6-digit code to reset your password. It expires in 15 minutes.</p>
      <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; text-align: center; padding: 20px; background: #f6f3ec; border-radius: 8px; margin: 24px 0;">
        ${args.code}
      </div>
      <p style="margin: 0 0 8px; color: #666; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `.trim();

  const text = `${greeting}\n\nUse this 6-digit code to reset your Survivor Pick'em password. It expires in 15 minutes.\n\nCode: ${args.code}\n\nIf you didn't request this, you can ignore this email.`;

  await client.emails.send({
    from: fromEmail,
    to: args.to,
    subject: "Reset your Survivor Pick'em password",
    html,
    text,
  });
}

export function getResendFromEmailHint(): string | undefined {
  return cachedFromEmail;
}
