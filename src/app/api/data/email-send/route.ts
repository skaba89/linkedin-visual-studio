/**
 * HERMÈS — R-001 / R-002 — /api/data/email-send
 * Migré vers requireUser() + assertOwnership (le contact doit appartenir au user).
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, assertOwnership } from "@/lib/session";
import { HttpError, isHttpError } from "@/lib/http-error";

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

    // Create and send email
    const message = await db.emailMessage.create({
      data: {
        userId: user.id,
        contactId,
        sequenceId,
        subject,
        body: emailBody,
        status: "sent",
        sentAt: new Date(),
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
        details: `Sujet: ${subject}`,
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
    throw err;
  }
}
