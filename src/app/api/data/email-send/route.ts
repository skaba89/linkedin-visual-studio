import { NextRequest, NextResponse } from "next/server";
import { db, ensureDefaultUser, DEFAULT_USER_ID } from "@/lib/db";

export async function POST(req: NextRequest) {
  await ensureDefaultUser();
  const body = await req.json();

  const { contactId, subject, body: emailBody, sequenceId } = body;

  if (!contactId || !subject || !emailBody) {
    return NextResponse.json({ error: "contactId, subject, and body are required" }, { status: 400 });
  }

  // Verify contact exists
  const contact = await db.contact.findUnique({ where: { id: contactId } });
  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  // Create and send email
  const message = await db.emailMessage.create({
    data: {
      userId: DEFAULT_USER_ID,
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
      userId: DEFAULT_USER_ID,
      agentId: "email-agent",
      agentName: "Email Agent",
      type: "success",
      message: `Email envoyé à ${contact.prenom} ${contact.nom}`,
      details: `Sujet: ${subject}`,
    },
  });

  return NextResponse.json(message, { status: 201 });
}
