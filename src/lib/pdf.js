import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function downloadInvoiceAsPDF(elementId, filename = "invoice.pdf") {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Invoice preview element not found");
  const canvas = await html2canvas(element, { scale: 3, backgroundColor: "#ffffff",useCORS:true,logging:false,allowTaint:false,});
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;
  pdf.addImage(imgData, "PNG", 0, 0, pageWidth, imgHeight);
  pdf.save(filename);
}

export async function generateInvoicePDFBase64(elementId) {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Invoice preview element not found");
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#ffffff",useCORS: true,logging: false,allowTaint: false,});
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;
  pdf.addImage(imgData, "PNG", 0, 0, pageWidth, imgHeight);
  return pdf.output("datauristring").split(",")[1];
}
