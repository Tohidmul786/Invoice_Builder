function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function toWords(num) {
  const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen",
    "Seventeen","Eighteen","Nineteen"];
  const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  if (!num || num === 0) return "Zero Rupees Only";
  function inWords(n) {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n/10)] + (n % 10 ? " " + a[n%10] : "");
    if (n < 1000) return a[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + inWords(n%100) : "");
    if (n < 100000) return inWords(Math.floor(n/1000)) + " Thousand" + (n%1000 ? " " + inWords(n%1000) : "");
    if (n < 10000000) return inWords(Math.floor(n/100000)) + " Lakh" + (n%100000 ? " " + inWords(n%100000) : "");
    return inWords(Math.floor(n/10000000)) + " Crore" + (n%10000000 ? " " + inWords(n%10000000) : "");
  }
  return inWords(Math.floor(num)) + " Rupees Only";
}

export default function InvoicePreview({ business, client, meta, items, subtotal, taxAmount, total }) {
  const grandTotal = total || 0;

  return (
    <div id="invoice-preview" style={{ background: "#fff", fontFamily: "Arial, sans-serif", fontSize: "12px", color: "#000", border: "2px solid #000", padding: "20px", minHeight: "700px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #000", paddingBottom: "10px", marginBottom: "10px" }}>
        <div>
          <div style={{ fontSize: "20px", fontWeight: "900", letterSpacing: "1px", textTransform: "uppercase" }}>
            {business?.name || "Your Business Name"}
          </div>
          {business?.phone && <div style={{ marginTop: "2px" }}>Mob No : {business.phone}</div>}
          {business?.email && <div>Email : {business.email}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "26px", fontWeight: "900", letterSpacing: "3px", color: "#000" }}>
            {meta?.docType || "INVOICE"}
          </div>
        </div>
      </div>

      {/* Ref / Date / Address */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "10px" }}>
        <div>
          <table style={{ borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ fontWeight: "700", paddingRight: "4px", paddingBottom: "4px", whiteSpace: "nowrap" }}>Ref No.</td>
                <td style={{ paddingBottom: "4px", minWidth: "60px" }}>{meta?.invoiceNo || "—"}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: "700", paddingRight: "4px", paddingBottom: "4px" }}>Date :</td>
                <td style={{ paddingBottom: "4px" }}>{formatDate(meta?.issueDate)}</td>
              </tr>
              {meta?.dueDate && (
                <tr>
                  <td style={{ fontWeight: "700", paddingRight: "4px",paddingBottom: "4px" }}>Due Date :</td>
                  <td style={{ paddingBottom: "1px" }}>{formatDate(meta.dueDate)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ flex: 2 }}>
          <span style={{ fontWeight: "700" }}>Address : </span>
          {business?.address || "—"}
        </div>
      </div>

      {/* Client Details */}
      <div style={{ border: "1px solid #000", padding: "8px", marginBottom: "10px" }}>
        <table style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ fontWeight: "700", width: "auto", whiteSpace: "nowrap", paddingRight: "8px", paddingBottom: "3px" }}>Client Name :</td>
              <td style={{ paddingBottom: "3px" }}>{client?.name || "—"}</td>
            </tr>
            {client?.phone && (
              <tr>
                <td style={{ fontWeight: "700", whiteSpace: "nowrap", paddingRight: "8px", paddingBottom: "3px" }}>Contact No :</td>
                <td style={{ paddingBottom: "3px" }}>{client.phone}</td>
              </tr>
            )}
            {client?.address && (
              <tr>
                <td style={{ fontWeight: "700", whiteSpace: "nowrap", paddingRight: "8px", paddingBottom: "3px" }}>Address :</td>
                <td style={{ paddingBottom: "3px" }}>{client.address}</td>
              </tr>
            )}
            {client?.email && (
              <tr>
                <td style={{ fontWeight: "700", whiteSpace: "nowrap", paddingRight: "8px" }}>Email :</td>
                <td>{client.email}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Items Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px", borderSpacing: 0, outline: "1.5px solid #000" }}>
        <thead>
          <tr style={{ backgroundColor: "#e8e8e8" }}>
            <th style={{ borderRight: "1px solid #000", borderBottom: "1.5px solid #000", padding: "5px 6px", textAlign: "center", width: "45px" }}>SrNo.</th>
            <th style={{ borderRight: "1px solid #000", borderBottom: "1.5px solid #000", padding: "5px 6px", textAlign: "left" }}>Description</th>
            <th style={{ borderRight: "1px solid #000", borderBottom: "1.5px solid #000", padding: "5px 6px", textAlign: "center", width: "50px" }}>Qty</th>
            <th style={{ borderRight: "1px solid #000", borderBottom: "1.5px solid #000", padding: "5px 6px", textAlign: "right", width: "90px" }}>Amount</th>
            <th style={{ borderBottom: "1.5px solid #000", padding: "5px 6px", textAlign: "right", width: "100px" }}>Total Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id || idx}>
              <td style={{ borderRight: "1px solid #000", borderBottom: "1.5px solid #000", padding: "5px 6px", textAlign: "center" }}>{idx + 1}</td>
              <td style={{ borderRight: "1px solid #000", borderBottom: "1.5px solid #000", padding: "5px 6px" }}>{item.description || ""}</td>
              <td style={{ borderRight: "1px solid #000", borderBottom: "1.5px solid #000", padding: "5px 6px", textAlign: "center" }}>{item.quantity || 0}</td>
              <td style={{ borderRight: "1px solid #000", borderBottom: "1.5px solid #000", padding: "5px 6px", textAlign: "right" }}>{formatCurrency(item.unit_price)}</td>
              <td style={{ borderBottom: "1.5px solid #000", padding: "5px 6px", textAlign: "right" }}>{formatCurrency((item.quantity || 0) * (item.unit_price || 0))}</td>
            </tr>
          ))}
          {Array.from({ length: Math.max(0, 6 - items.length) }).map((_, i) => (
            <tr key={`empty-${i}`} style={{ height: "24px" }}>
              <td style={{ borderRight: "1px solid #000", borderBottom: "1.5px solid #000" }}></td>
              <td style={{ borderRight: "1px solid #000", borderBottom: "1.5px solid #000" }}></td>
              <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000" }}></td>
              <td style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000" }}></td>
              <td style={{ borderBottom: "1px solid #000" }}></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {taxAmount > 0 && (
            <tr>
              <td colSpan={4} style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", padding: "5px 6px", textAlign: "right", fontWeight: "700" }}>Tax ({meta?.taxPercent}%)</td>
              <td style={{ borderBottom: "1px solid #000", padding: "5px 6px", textAlign: "right" }}>{formatCurrency(taxAmount)}</td>
            </tr>
          )}
          {Number(meta?.discount) > 0 && (
            <tr>
              <td colSpan={4} style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", padding: "5px 6px", textAlign: "right", fontWeight: "700" }}>Discount</td>
              <td style={{ borderBottom: "1px solid #000", padding: "5px 6px", textAlign: "right" }}>−{formatCurrency(meta.discount)}</td>
            </tr>
          )}
          <tr style={{ backgroundColor: "#e8e8e8" }}>
            <td colSpan={4} style={{ borderRight: "1px solid #000", borderBottom: "1px solid #000", padding: "5px 6px", textAlign: "right", fontWeight: "700", fontSize: "13px" }}>Total Amount</td>
            <td style={{ borderBottom: "1px solid #000", padding: "5px 6px", textAlign: "right", fontWeight: "700", fontSize: "13px" }}>{formatCurrency(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Amount in Words */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "10px" }}>
        <tbody>
          <tr>
            <td style={{ fontWeight: "700", width: "200px", paddingBottom: "4px" }}>Total Amount (In Words)</td>
            <td style={{ paddingBottom: "1px", fontStyle: "bold" }}>
              {toWords(grandTotal)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Terms & Conditions */}
      {meta?.notes && (
        <div style={{ fontSize: "10px", marginBottom: "20px", borderTop: "1px solid #000", paddingTop: "6px" }}>
          <span style={{ fontWeight: "700" }}>Terms And Condition </span>
          <span style={{ whiteSpace: "pre-line" }}>{meta.notes}</span>
        </div>
      )}

      {/* Signature */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "30px", paddingTop: "8px", borderTop: "1px solid #000" }}>
        <div>
          <div style={{ fontWeight: "700" }}>Customer Signature</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: "700" }}>FOR {(business?.name || "YOUR BUSINESS").toUpperCase()},</div>
          <div style={{ fontSize: "10px", marginTop: "2px" }}>Authorized Signatory</div>
        </div>
      </div>
    </div>
  );
}
