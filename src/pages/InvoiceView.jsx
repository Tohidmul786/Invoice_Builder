import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getInvoice, updateInvoiceStatus } from "../lib/supabase";
import { downloadInvoiceAsPDF, generateInvoicePDFBase64 } from "../lib/pdf";
import InvoicePreview from "../components/InvoicePreview/InvoicePreview";

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;

export default function InvoiceView() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  useEffect(() => {
    getInvoice(id).then(setInvoice).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-12 text-center text-sm text-slate-400">Loading…</div>;
  if (!invoice) return <div className="p-12 text-center text-sm text-slate-400">Invoice not found.</div>;

  const items = invoice.invoice_items || [];
  const subtotal = items.reduce((s, i) => s + Number(i.total || 0), 0);

  async function handleDownload() {
    await downloadInvoiceAsPDF("invoice-preview", `${invoice.invoice_no}.pdf`);
  }

  async function handleSendEmail() {
    if (!invoice.client_email) { alert("No client email on this invoice."); return; }
    setSending(true); setSendResult(null);
    try {
      const pdfBase64 = await generateInvoicePDFBase64("invoice-preview");
      const res = await fetch(`${FUNCTIONS_URL}/send-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: invoice.client_email,
          invoiceNo: invoice.invoice_no,
          clientName: invoice.client_name,
          businessName: invoice.business_name,
          businessEmail: invoice.business_email,
          pdfBase64,
        }),
      });
      if (!res.ok) throw new Error("Send failed");
      await updateInvoiceStatus(invoice.id, "sent");
      setInvoice((prev) => ({ ...prev, status: "sent" }));
      setSendResult("sent");
    } catch (err) {
      console.error(err);
      setSendResult("error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-sm font-medium text-slate-500 hover:text-ink">← Back to invoices</Link>
          <div className="flex gap-3">
            <button onClick={handleDownload} className="btn-secondary">Download PDF</button>
            <button onClick={handleSendEmail} disabled={sending} className="btn-primary">{sending ? "Sending…" : "Send to Customer"}</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {sendResult === "sent" && <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">Invoice sent to {invoice.client_email}.</p>}
        {sendResult === "error" && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">Couldn't send — email not configured yet. PDF download still works.</p>}

        <InvoicePreview
          business={{ name: invoice.business_name, address: invoice.business_address, email: invoice.business_email, phone: invoice.business_phone }}
          client={{ name: invoice.client_name, email: invoice.client_email, address: invoice.client_address }}
          meta={{ invoiceNo: invoice.invoice_no, issueDate: invoice.issue_date, dueDate: invoice.due_date, notes: invoice.notes }}
          items={items}
          subtotal={subtotal}
          taxAmount={0}
          total={subtotal}
        />
      </main>
    </div>
  );
}
