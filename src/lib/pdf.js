import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// A4 width in pixels at 96dpi — this is what we force the invoice to
// render at regardless of screen size, so the PDF always looks correct.
const A4_WIDTH_PX = 794;

async function captureInvoice(elementId) {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Invoice preview element not found");

  // Save original styles so we can restore them after capture
  const originalWidth = element.style.width;
  const originalMinWidth = element.style.minWidth;
  const originalMaxWidth = element.style.maxWidth;
  const originalPosition = element.style.position;
  const originalLeft = element.style.left;
  const originalTop = element.style.top;
  const originalZIndex = element.style.zIndex;
  const originalBoxSizing = element.style.boxSizing;

  // Force A4 width for capture — position offscreen so it doesn't
  // visually jump on screen during the capture
  element.style.width = `${A4_WIDTH_PX}px`;
  element.style.minWidth = `${A4_WIDTH_PX}px`;
  element.style.maxWidth = `${A4_WIDTH_PX}px`;
  element.style.boxSizing = "border-box";
  element.style.position = "fixed";
  element.style.left = "-9999px";
  element.style.top = "0px";
  element.style.zIndex = "-1";

  // Wait one frame for layout to reflow at A4 width
  await new Promise((r) => setTimeout(r, 100));

  const canvas = await html2canvas(element, {
    scale: 3,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    allowTaint: false,
    width: A4_WIDTH_PX,
    windowWidth: A4_WIDTH_PX,
  });

  // Restore original styles
  element.style.width = originalWidth;
  element.style.minWidth = originalMinWidth;
  element.style.maxWidth = originalMaxWidth;
  element.style.position = originalPosition;
  element.style.left = originalLeft;
  element.style.top = originalTop;
  element.style.zIndex = originalZIndex;
  element.style.boxSizing = originalBoxSizing;

  return canvas;
}

export async function downloadInvoiceAsPDF(elementId, filename = "invoice.pdf") {
  const canvas = await captureInvoice(elementId);
  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  // If invoice is taller than one A4 page, split across pages
  if (imgHeight <= pageHeight) {
    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, imgHeight);
  } else {
    let yOffset = 0;
    let remainingHeight = imgHeight;
    let isFirstPage = true;

    while (remainingHeight > 0) {
      if (!isFirstPage) pdf.addPage();
      const sliceHeight = Math.min(pageHeight, remainingHeight);
      pdf.addImage(imgData, "PNG", 0, -yOffset, pageWidth, imgHeight);
      yOffset += pageHeight;
      remainingHeight -= sliceHeight;
      isFirstPage = false;
    }
  }

  pdf.save(filename);
}

export async function generateInvoicePDFBase64(elementId) {
  const canvas = await captureInvoice(elementId);
  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;
  pdf.addImage(imgData, "PNG", 0, 0, pageWidth, imgHeight);
  return pdf.output("datauristring").split(",")[1];
}
