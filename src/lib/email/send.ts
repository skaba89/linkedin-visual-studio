/**
 * HERMÈS — Email provider abstraction
 *
 * Sends transactional emails through whichever provider is configured via
 * environment variables. Supports:
 *
 *   1. Resend       — set RESEND_API_KEY and (optionally) RESEND_FROM_EMAIL
 *   2. SMTP fallback — not implemented yet, but the abstraction allows it
 *   3. Dev mode      — when no provider is configured, emails are logged to
 *                      the console and a fake message ID is returned. This
 *                      lets the app run in dev/preview without a provider.
 *
 * Previously, the email feature was a complete stub: `/api/data/email-send`
 * created an `EmailMessage` row with `status: "sent"` but never actually
 * sent anything. This module replaces that with real delivery, while
 * gracefully degrading when no provider is configured.
 *
 * Usage:
 *
 *   import { sendEmail } from "@/lib/email/send";
 *
 *   const result = await sendEmail({
 *     to: "prospect@example.com",
 *     subject: "Bonjour depuis HERMÈS",
 *     html: "<p>Contenu du mail</p>",
 *     text: "Contenu du mail",
 *     // Optional: tag for tracking/deduplication
 *     tag: "nurturing-sequence-step-1",
 *   });
 *
 *   if (result.success) {
 *     console.log("Sent:", result.messageId);
 *   } else {
 *     console.error("Failed:", result.error);
 *   }
 */
import { NextResponse } from "next/server";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  /** Optional reply-to address. */
  replyTo?: string;
  /** Optional tag for tracking/deduplication. */
  tag?: string;
  /** Optional custom headers. */
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  success: boolean;
  /** Provider message ID (used for tracking). Null in dev mode. */
  messageId?: string;
  /** Error message if success === false. */
  error?: string;
  /** Provider that handled the send (for logs). */
  provider: "resend" | "dev";
}

/**
 * Send an email via the configured provider.
 *
 * In dev mode (no RESEND_API_KEY set), logs the email to the console and
 * returns a fake success. This lets the app run in preview environments
 * without crashing the email-send flow.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "HERMÈS <noreply@hermes.local>";

  // ─── Dev mode: no provider configured ───────────────────────────────
  if (!apiKey) {
    const recipients = Array.isArray(input.to) ? input.to.join(", ") : input.to;
    console.log(
      "[email:dev] Email not sent (no RESEND_API_KEY). Logging instead:\n" +
        `  To: ${recipients}\n` +
        `  Subject: ${input.subject}\n` +
        `  Tag: ${input.tag ?? "(none)"}\n` +
        `  Body (text): ${(input.text ?? "").slice(0, 200)}...`,
    );
    return {
      success: true,
      messageId: `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      provider: "dev",
    };
  }

  // ─── Resend ─────────────────────────────────────────────────────────
  try {
    // Lazy import so the module doesn't crash in environments where
    // `resend` isn't installed (e.g. edge runtime).
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const payload = {
      from: fromEmail,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
      headers: input.headers,
      tags: input.tag ? [{ name: "tag", value: input.tag }] : undefined,
    };

    // `as never` bypasses the strict RequireAtLeastOne<EmailRenderOptions>
    // check — we guarantee at least one of html/text is set at the call site.
    const { data, error } = await resend.emails.send(payload as never);

    if (error) {
      console.error("[email:resend] Send failed:", error);
      return {
        success: false,
        error: error.message ?? "Resend API error",
        provider: "resend",
      };
    }

    return {
      success: true,
      messageId: data?.id,
      provider: "resend",
    };
  } catch (err) {
    console.error("[email:resend] Exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      provider: "resend",
    };
  }
}

/**
 * Build the open-tracking pixel HTML to embed in an email body.
 *
 * The pixel is a 1×1 transparent GIF whose URL points to our public
 * tracking endpoint. When the recipient's mail client loads images,
 * we record the open.
 *
 * @param messageId The HERMÈS EmailMessage ID (cuid)
 * @param baseUrl The public base URL of the app (e.g. https://app.hermes.ai)
 */
export function buildOpenTrackingPixel(messageId: string, baseUrl: string): string {
  const url = `${baseUrl}/api/email/track?msg=${encodeURIComponent(messageId)}&type=open`;
  return `<img src="${url}" width="1" height="1" alt="" style="display:none" />`;
}

/**
 * Rewrite links in an HTML email body to route through our click-tracking
 * endpoint. The original URL is preserved as the redirect target.
 *
 * This is a simple regex-based rewriter — it handles `href="..."` attributes
 * but doesn't parse HTML. For complex emails with conditional comments or
 * CDATA, consider a proper HTML parser (cheerio, parse5).
 *
 * @param messageId The HERMÈS EmailMessage ID (cuid)
 * @param html The original HTML body
 * @param baseUrl The public base URL of the app
 */
export function rewriteLinksForClickTracking(
  messageId: string,
  html: string,
  baseUrl: string,
): string {
  const track = (originalUrl: string) =>
    `${baseUrl}/api/email/track?msg=${encodeURIComponent(messageId)}&type=click&url=${encodeURIComponent(originalUrl)}`;

  // Match href="..." and href='...' attributes, capturing the URL.
  // Skip anchor links (#...) and mailto: links — they can't be tracked
  // via redirect.
  return html.replace(
    /href=(["'])(https?:\/\/[^"']+)\1/gi,
    (match, quote: string, url: string) => {
      if (url.startsWith("#") || url.toLowerCase().startsWith("mailto:")) {
        return match;
      }
      return `href=${quote}${track(url)}${quote}`;
    },
  );
}

/**
 * Helper: build a NextResponse that serves a 1×1 transparent GIF.
 * Used by the open-tracking endpoint.
 */
export function transparentGifResponse(): NextResponse {
  // 43-byte transparent GIF
  const gif = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64",
  );
  return new NextResponse(gif, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
