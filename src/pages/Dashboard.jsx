import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { listInvoices, deleteInvoice } from "../lib/supabase";

const STATUS_STYLES = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-50 text-blue-700",
  paid: "bg-emerald-50 text-emerald-700",
};

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount || 0);
}

function invoiceTotal(invoice) {
  return (invoice.invoice_items || []).reduce((sum, item) => sum + Number(item.total || 0), 0);
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    listInvoices(user.id).then(setInvoices).finally(() => setLoading(false));
  }, [user]);

  async function handleDelete(id) {
    if (!confirm("Delete this invoice? This can't be undone.")) return;
    await deleteInvoice(id);
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
  }

  const filtered = invoices.filter((inv) =>
    inv.client_name?.toLowerCase().includes(query.toLowerCase())
  );
  const totalRevenue = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + invoiceTotal(i), 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-mono text-sm font-bold text-white">IB</div>
            <span className="font-bold text-ink">Invoice Builder</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">{user?.email}</span>
            <button onClick={logout} className="text-sm font-medium text-slate-500 hover:text-ink">Sign out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[["Total invoices", invoices.length], ["Paid", invoices.filter((i) => i.status === "paid").length], ["Revenue collected", formatCurrency(totalRevenue)]].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
            </div>
          ))}
        </div>

        <div className="mb-4 flex items-center justify-between gap-4">
          <input type="text" placeholder="Search by client name…" value={query} onChange={(e) => setQuery(e.target.value)} className="input-field max-w-xs" />
          <Link to="/invoices/new" className="btn-primary">+ New Invoice</Link>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-400">Loading invoices…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-medium text-ink">{query ? "No invoices match that search" : "No invoices yet"}</p>
              <p className="mt-1 text-sm text-slate-500">{query ? "Try a different client name." : "Create your first invoice to get started."}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{inv.invoice_no}</td>
                    <td className="px-5 py-3 font-medium text-ink">{inv.client_name}</td>
                    <td className="px-5 py-3 text-slate-500">{inv.issue_date}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[inv.status] || STATUS_STYLES.draft}`}>{inv.status}</span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-ink">{formatCurrency(invoiceTotal(inv))}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(inv.id); }} className="text-xs font-medium text-red-500 hover:text-red-700">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
