import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuid } from "uuid";
import { useAuth } from "../context/AuthContext";
import { createInvoice, getProfile, upsertProfile } from "../lib/supabase";
import InvoicePreview from "../components/InvoicePreview/InvoicePreview";
import AIAssistant from "../components/AIAssistant/AIAssistant";

const emptyItem = () => ({ id: uuid(), description: "", quantity: 1, unit_price: 0 });
const todayISO = () => new Date().toISOString().slice(0, 10);
const dueDateISO = (days = 14) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };

export default function InvoiceEditor() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [business, setBusiness] = useState({ name: "", address: "", email: user?.email || "", phone: "" });
  const [client, setClient] = useState({ name: "", email: "", phone: "", address: "" });
  const [meta, setMeta] = useState({
    invoiceNo: `INV-${Date.now().toString().slice(-6)}`,
    issueDate: todayISO(), dueDate: dueDateISO(),
    taxPercent: 0, discount: 0,
    docType: "INVOICE",
    notes: "\n1) Payment to be made by cash or account payee's cheque.\n2) Subject to local jurisdiction.\n3)No warranty covered pn physical damage and burned.\n4)Cheque return charges will be RS.350/-",
  });
  const [items, setItems] = useState([emptyItem()]);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id).then((p) => {
      if (!p) return;
      setBusiness((prev) => ({
        ...prev,
        name: p.business_name || prev.name,
        address: p.business_address || prev.address,
        phone: p.business_phone || prev.phone,
      }));
    }).catch(() => { });
  }, [user]);

  const updateItem = (id, field, value) => setItems((prev) => prev.map((i) => i.id === id ? { ...i, [field]: value } : i));
  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (id) => setItems((prev) => prev.length > 1 ? prev.filter((i) => i.id !== id) : prev);

  const subtotal = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
  const taxAmount = subtotal * (Number(meta.taxPercent || 0) / 100);
  const total = subtotal + taxAmount - Number(meta.discount || 0);

  async function handleSave(status) {
    setSaving(true);
    try {
      await upsertProfile({
        id: user.id, email: user.email,
        name: user.user_metadata?.full_name || "",
        business_name: business.name,
        business_address: business.address,
        business_phone: business.phone,
      });
      const invoiceRow = await createInvoice(
        {
          user_id: user.id,
          invoice_no: meta.invoiceNo,
          business_name: business.name,
          business_address: business.address,
          business_email: business.email,
          business_phone: business.phone,
          client_name: client.name,
          client_email: client.email,
          client_address: client.address,
          issue_date: meta.issueDate,
          due_date: meta.dueDate,
          status, 
          notes: meta.notes,
          doc_type:meta.docType || "INVOICE",
        },
        items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          total: Number(item.quantity) * Number(item.unit_price),
        }))
      );
      navigate(`/invoices/${invoiceRow.id}`);
    } catch (err) {
      alert("Couldn't save the invoice. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-bold text-ink">New Invoice</h1>
          <div className="flex gap-3">
            <button onClick={() => handleSave("draft")} disabled={saving} className="btn-secondary">Save as Draft</button>
            <button onClick={() => handleSave("sent")} disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save & Continue"}</button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-2">
        <div className="space-y-6">
          {/* AI Assistant */}
          <AIAssistant
            onFill={({ client: c, items: its, meta: m }) => {
              if (c) setClient((prev) => ({ ...prev, ...c }));
              if (its) setItems(its.map((i) => ({ ...emptyItem(), ...i })));
              if (m) setMeta((prev) => ({ ...prev, ...m }));
            }}
          />
          {/* Business Info */}
          <Section title="Your Business">
            <Field label="Business Name"><input className="input-field" value={business.name} onChange={(e) => setBusiness({ ...business, name: e.target.value })} placeholder="Shakil Patel" /></Field>
            <Field label="Address"><input className="input-field" value={business.address} onChange={(e) => setBusiness({ ...business, address: e.target.value })} placeholder="301, B-Wing, Your Address..." /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email"><input className="input-field" value={business.email} onChange={(e) => setBusiness({ ...business, email: e.target.value })} /></Field>
              <Field label="Mobile No"><input className="input-field" value={business.phone} onChange={(e) => setBusiness({ ...business, phone: e.target.value })} placeholder="9876543210" /></Field>
            </div>
          </Section>

          {/* Client Info */}
          <Section title="Bill To (Client)">
            <Field label="Client Name"><input className="input-field" value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} placeholder="VIDUSHI WIRES PVT LTD" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact No"><input className="input-field" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} placeholder="9876543210" /></Field>
              <Field label="Client Email"><input className="input-field" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} /></Field>
            </div>
            <Field label="Client Address"><input className="input-field" value={client.address} onChange={(e) => setClient({ ...client, address: e.target.value })} placeholder="Client address..." /></Field>
          </Section>

          {/* Invoice Details */}
          <Section title="Invoice Details">
            <Field label="Document Type">
              <div className="flex gap-2">
                {["INVOICE", "QUOTATION", "ESTIMATE", "RECEIPT"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMeta({ ...meta, docType: type })}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${meta.docType === type
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <input
                className="input-field mt-2"
                value={meta.docType}
                onChange={(e) => setMeta({ ...meta, docType: e.target.value.toUpperCase() })}
                placeholder="Or type custom e.g. PROFORMA INVOICE"
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Ref No."><input className="input-field" value={meta.invoiceNo} onChange={(e) => setMeta({ ...meta, invoiceNo: e.target.value })} /></Field>
              <Field label="Date"><input type="date" className="input-field" value={meta.issueDate} onChange={(e) => setMeta({ ...meta, issueDate: e.target.value })} /></Field>
              <Field label="Due Date"><input type="date" className="input-field" value={meta.dueDate} onChange={(e) => setMeta({ ...meta, dueDate: e.target.value })} /></Field>
            </div>
          </Section>

          {/* Items */}
          <Section title="Items">
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 items-center gap-2">
                  <input className="input-field col-span-6" placeholder="Description" value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} />
                  <input type="number" min="0" className="input-field col-span-2" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", e.target.value)} />
                  <input type="number" className="input-field col-span-3" placeholder="Amount" value={item.unit_price} onChange={(e) => updateItem(item.id, "unit_price", e.target.value)} />
                  <button onClick={() => removeItem(item.id)} className="col-span-1 text-slate-400 hover:text-red-500">✕</button>
                </div>
              ))}
            </div>
            <button onClick={addItem} className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700">+ Add item</button>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
              <Field label="Tax (%)"><input type="number" min="0" className="input-field" value={meta.taxPercent} onChange={(e) => setMeta({ ...meta, taxPercent: e.target.value })} /></Field>
              <Field label="Discount (₹)"><input type="number" min="0" className="input-field" value={meta.discount} onChange={(e) => setMeta({ ...meta, discount: e.target.value })} /></Field>
            </div>
            <Field label="Terms & Conditions">
              <textarea className="input-field" rows={4} value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} />
            </Field>
          </Section>
        </div>

        {/* Live Preview */}
        <div className="lg:sticky lg:top-8 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Live Preview</p>
          <InvoicePreview business={business} client={client} meta={meta} items={items} subtotal={subtotal} taxAmount={taxAmount} total={total} />
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Field({ label, children }) {
  return <label className="block"><span className="label-text">{label}</span>{children}</label>;
}
