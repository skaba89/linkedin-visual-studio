/**
 * HERMÈS — R-001 / R-002 — /api/data/email-send
 * Migré vers requireUser() + assertOwnership (le contact doit appartenir au user).
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, assertOwnership } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";
import {
  sendEmail,
  buildOpenTrackingPixel,
  rewriteLinksForClickTracking,
} from "@/lib/email/send";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const { contactId, subject, body: emailBody, sequenceId } = body;

    if (!contactId || !subject || !emailBody) {
      throw new HttpError(
        422,
        "contactId, subject, and body are required",
        "VALIDATION_ERROR",
      );
    }

    // Verify contact exists AND belongs to the user
    const contact = await db.contact.findUnique({ where: { id: contactId } });
    assertOwnership(contact, user.id);

    if (!contact.email) {
      return NextResponse.json(
        { error: "Ce contact n'a pas d'adresse email" },
        { status: 400 },
      );
    }

    // ─── Create the EmailMessage row first (status: "queued") ──────────
    // We need the row ID to build the tracking pixel URL.
    const message = await db.emailMessage.create({
      data: {
        userId: user.id,
        contactId,
        sequenceId,
        subject,
        body: emailBody,
        status: "queued",
      },
    });

    // ─── Inject tracking pixel + rewrite links ─────────────────────────
    // The tracking endpoint is public (no auth) and uses the message ID
    // (cuid) to identify which email was opened/clicked.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://linkedin-visual-studio.onrender.com";
    const htmlWithClickTracking = rewriteLinksForClickTracking(
      message.id,
      emailBody,
      baseUrl,
    );
    const htmlWithPixel =
      htmlWithClickTracking + buildOpenTrackingPixel(message.id, baseUrl);

    // ─── Send via the configured provider (Resend or dev mode) ─────────
    const result = await sendEmail({
      to: contact.email,
      subject,
      html: htmlWithPixel,
      text: emailBody, // fallback for plain-text clients
      tag: sequenceId ? `sequence-${sequenceId}` : undefined,
    });

    // ─── Update the EmailMessage row with the result ───────────────────
    if (result.success) {
      const updated = await db.emailMessage.update({
        where: { id: message.id },
        data: {
          status: "sent",
          sentAt: new Date(),
          providerMessageId: result.messageId ?? null,
        },
      });

      // Log activity
      await db.activityLog.create({
        data: {
          userId: user.id,
          agentId: "email-agent",
          agentName: "Email Agent",
          type: "success",
          message: `Email envoyé à ${contact.prenom} ${contact.nom}`,
          details: `Sujet: ${subject} | Provider: ${result.provider} | ID: ${result.messageId ?? "n/a"}`,
        },
      });

      return NextResponse.json(updated, { status: 201 });
    } else {
      // Mark as failed but keep the row for retry / audit
      const updated = await db.emailMessage.update({
        where: { id: message.id },
        data: {
          status: "failed",
          errorMessage: result.error ?? "Unknown error",
        },
      });

      await db.activityLog.create({
        data: {
          userId: user.id,
          agentId: "email-agent",
          agentName: "Email Agent",
          type: "error",
          message: `Échec envoi email à ${contact.prenom} ${contact.nom}`,
          details: `Sujet: ${subject} | Erreur: ${result.error}`,
        },
      });

      return NextResponse.json(
        {
          error: "Échec de l'envoi de l'email",
          details: result.error,
          message: updated,
        },
        { status: 502 },
      );
    }
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}
