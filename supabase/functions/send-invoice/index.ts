// Supabase Edge Function: sends the invoice PDF to the customer via Resend.
// The Resend API key never touches the browser. The frontend sends the
// already-generated PDF as base64 (rendered from the same on-screen
// preview the user sees), plus the recipient and invoice metadata.
//
// Deploy with: supabase functions deploy send-invoice
// Required secrets:
//   FIREBASE_PROJECT_ID
//   RESEND_API_KEY
//   FROM_EMAIL   (must be a verified sender/domain in Resend)

import { verifyFirebaseToken } from "../api/_shared/verifyFirebaseToken.ts";

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL_ADDRESS = Deno.env.get("FROM_EMAIL")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) throw new Error("Missing Authorization header");
    await verifyFirebaseToken(token, FIREBASE_PROJECT_ID); // throws if invalid

    const { to, invoiceNo, clientName, pdfBase64, businessName, businessEmail } =
      await req.json();

    if (!to || !pdfBase64) {
      return json({ error: "Missing required fields: to, pdfBase64" }, 400);
    }

    // The technical sender must stay on our verified domain — providers
    // like Gmail/Outlook reject mail claiming to be "from" a domain we
    // don't own (SPF/DKIM). Instead we make it LOOK like it's from the
    // logged-in user's business, and route replies straight to them.
    const senderDisplayName = businessName || "Invoice Builder";
    const fromHeader = `${senderDisplayName} <${FROM_EMAIL_ADDRESS}>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromHeader,
        to: [to],
        reply_to: businessEmail || undefined, // customer's replies go to the user, not us
        subject: `Invoice ${invoiceNo || ""} from ${senderDisplayName}`,
        html: `<p>Hi ${clientName || "there"},</p><p>Please find your invoice from ${senderDisplayName} attached.</p>`,
        attachments: [
          {
            filename: `${invoiceNo || "invoice"}.pdf`,
            content: pdfBase64,
          },
        ],
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      throw new Error(`Resend API error: ${errBody}`);
    }

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});
