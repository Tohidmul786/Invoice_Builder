import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ---- Auth ----
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function subscribeToAuthChanges(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
  return data.subscription.unsubscribe;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user || null;
}

// ---- Users ----
export async function upsertProfile(fields) {
  const { error } = await supabase.from("users").upsert(fields, { onConflict: "id" });
  if (error) throw error;
}

export async function getProfile(userId) {
  const { data, error } = await supabase.from("users").select("*").eq("id", userId).single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

// ---- Invoices ----
export async function listInvoices(userId) {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, invoice_items(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getInvoice(invoiceId) {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, invoice_items(*)")
    .eq("id", invoiceId)
    .single();
  if (error) throw error;
  return data;
}

export async function createInvoice(invoiceFields, items) {
  const { data: invoiceRow, error: invoiceError } = await supabase
    .from("invoices")
    .insert(invoiceFields)
    .select()
    .single();
  if (invoiceError) throw invoiceError;

  if (items.length > 0) {
    const itemRows = items.map((item) => ({ ...item, invoice_id: invoiceRow.id }));
    const { error: itemsError } = await supabase.from("invoice_items").insert(itemRows);
    if (itemsError) throw itemsError;
  }
  return invoiceRow;
}

export async function updateInvoiceStatus(invoiceId, status) {
  const { error } = await supabase.from("invoices").update({ status }).eq("id", invoiceId);
  if (error) throw error;
}

export async function deleteInvoice(invoiceId) {
  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
  if (error) throw error;
}
