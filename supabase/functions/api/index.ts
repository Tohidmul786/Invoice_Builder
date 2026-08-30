// Supabase Edge Function: all invoice reads/writes go through here.
// The frontend never holds the Supabase service role key — only this
// server-side function does. Every request must carry a valid Firebase
// ID token, and every query is scoped to that token's UID.
//
// Deploy with: supabase functions deploy api
// Required secrets (supabase secrets set):
//   FIREBASE_PROJECT_ID
//   SUPABASE_URL              (auto-provided by Supabase, no need to set)
//   SB_SERVICE_ROLE_KEY       (set manually — never expose to frontend.
//                               Named SB_ not SUPABASE_ because Supabase
//                               reserves the SUPABASE_ prefix for secrets
//                               it injects automatically.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { verifyFirebaseToken } from "./_shared/verifyFirebaseToken.ts";

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SB_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function authenticate(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) throw new Error("Missing Authorization header");
  const claims = await verifyFirebaseToken(token, FIREBASE_PROJECT_ID);
  return claims; // claims.sub is the Firebase UID
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  // Path looks like /api/invoices or /api/invoices/<id>
  const segments = url.pathname.split("/").filter(Boolean); // ["api", "invoices", id?]
  const resource = segments[1];
  const resourceId = segments[2];

  let claims;
  try {
    claims = await authenticate(req);
  } catch (err) {
    return json({ error: `Unauthorized: ${err.message}` }, 401);
  }
  const uid = claims.sub;

  try {
    // ---- Ensure the user row exists / is up to date ----
    if (resource === "me" && req.method === "POST") {
      const body = await req.json();
      const { error } = await supabase
        .from("users")
        .upsert(
          {
            id: uid,
            email: claims.email || body.email,
            name: claims.name || body.name,
            ...(body.business_name !== undefined && { business_name: body.business_name }),
            ...(body.business_address !== undefined && { business_address: body.business_address }),
            ...(body.business_phone !== undefined && { business_phone: body.business_phone }),
          },
          { onConflict: "id" }
        );
      if (error) throw error;
      return json({ ok: true });
    }

    // ---- Fetch the current user's profile (used to prefill the invoice form) ----
    if (resource === "me" && req.method === "GET") {
      const { data, error } = await supabase.from("users").select("*").eq("id", uid).single();
      if (error) throw error;
      return json(data);
    }

    // ---- List invoices for the authenticated user only ----
    if (resource === "invoices" && req.method === "GET" && !resourceId) {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, invoice_items(*)")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json(data);
    }

    // ---- Get one invoice, only if it belongs to this user ----
    if (resource === "invoices" && req.method === "GET" && resourceId) {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, invoice_items(*)")
        .eq("id", resourceId)
        .eq("user_id", uid)
        .single();
      if (error) throw error;
      return json(data);
    }

    // ---- Create an invoice + items, forcing user_id to the verified UID ----
    if (resource === "invoices" && req.method === "POST" && !resourceId) {
      const body = await req.json();
      const { items, ...invoiceFields } = body;

      const { data: invoiceRow, error: invoiceError } = await supabase
        .from("invoices")
        .insert({ ...invoiceFields, user_id: uid }) // user_id is never trusted from the client
        .select()
        .single();
      if (invoiceError) throw invoiceError;

      if (Array.isArray(items) && items.length > 0) {
        const itemRows = items.map((item) => ({ ...item, invoice_id: invoiceRow.id }));
        const { error: itemsError } = await supabase.from("invoice_items").insert(itemRows);
        if (itemsError) throw itemsError;
      }

      return json(invoiceRow, 201);
    }

    // ---- Update invoice status, only if owned by this user ----
    if (resource === "invoices" && req.method === "PATCH" && resourceId) {
      const body = await req.json();
      const { data: existing, error: fetchError } = await supabase
        .from("invoices")
        .select("id")
        .eq("id", resourceId)
        .eq("user_id", uid)
        .single();
      if (fetchError || !existing) return json({ error: "Not found" }, 404);

      const { error } = await supabase
        .from("invoices")
        .update({ status: body.status })
        .eq("id", resourceId);
      if (error) throw error;
      return json({ ok: true });
    }

    // ---- Delete invoice, only if owned by this user ----
    if (resource === "invoices" && req.method === "DELETE" && resourceId) {
      const { data: existing, error: fetchError } = await supabase
        .from("invoices")
        .select("id")
        .eq("id", resourceId)
        .eq("user_id", uid)
        .single();
      if (fetchError || !existing) return json({ error: "Not found" }, 404);

      const { error } = await supabase.from("invoices").delete().eq("id", resourceId);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});
