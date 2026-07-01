-- HERMÈS — Add provider tracking fields to EmailMessage
--
-- Previously, EmailMessage only tracked "sent" status and timestamps.
-- Real email delivery (R-013) needs to persist the provider's message ID
-- (for cross-referencing with Resend/SendGrid webhooks) and an error
-- message field for failed sends.
--
-- Both columns are nullable so existing rows are unaffected.

ALTER TABLE "EmailMessage" ADD COLUMN "providerMessageId" TEXT;
ALTER TABLE "EmailMessage" ADD COLUMN "errorMessage" TEXT;
