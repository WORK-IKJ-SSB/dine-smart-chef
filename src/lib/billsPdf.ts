import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type BillRow = {
  table_number: number;
  created_at: string;
  total: number;
  items: { name: string; quantity: number; price: number }[];
};

export function generateDailyBillsPdf(bills: BillRow[], dateLabel: string): jsPDF {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("Tavola — Daily Bills", 14, 18);
  doc.setFontSize(11);
  doc.text(dateLabel, 14, 26);

  const grandTotal = bills.reduce((s, b) => s + Number(b.total), 0);

  autoTable(doc, {
    startY: 32,
    head: [["Time", "Table", "Items", "Total (INR)"]],
    body: bills.map((b) => [
      new Date(b.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }),
      `T${b.table_number}`,
      b.items.map((i) => `${i.name} x${i.quantity}`).join(", "),
      `Rs. ${Number(b.total).toFixed(2)}`,
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [234, 88, 12] },
    columnStyles: { 3: { halign: "right" } },
  });

  const endY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40;
  doc.setFontSize(12);
  doc.text(`Total Bills: ${bills.length}`, 14, endY + 10);
  doc.text(`Grand Total: Rs. ${grandTotal.toFixed(2)}`, 14, endY + 17);

  return doc;
}

export function downloadDailyBillsPdf(bills: BillRow[]) {
  const now = new Date();
  const dateLabel = now.toLocaleDateString();
  const doc = generateDailyBillsPdf(bills, dateLabel);
  const fname = `tavola-bills-${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(fname);
}