import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { money } from "@/lib/format";

export type BillItem = { name: string; price: number; quantity: number };
export type BillData = {
  tableNumber: number;
  items: BillItem[];
  createdAt: string;
  orderIds: string[];
};

export function BillDialog({
  open,
  onOpenChange,
  bill,
  onConfirm,
  confirmLabel = "Mark as Paid",
  showConfirm = true,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bill: BillData | null;
  onConfirm?: () => void;
  confirmLabel?: string;
  showConfirm?: boolean;
}) {
  if (!bill) return null;
  const subtotal = bill.items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  function print() {
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    w.document.write(`
      <html><head><title>Bill - Table ${bill!.tableNumber}</title>
      <style>
        body{font-family:ui-monospace,Menlo,monospace;padding:16px;color:#111}
        h2{text-align:center;margin:0 0 4px}
        .muted{color:#666;font-size:12px;text-align:center}
        table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
        td{padding:4px 0}
        .r{text-align:right}
        .line{border-top:1px dashed #999;margin:8px 0}
        .tot{font-weight:700;font-size:15px}
      </style></head><body>
      <h2>Tavola</h2>
      <div class="muted">Table ${bill!.tableNumber} · ${new Date(bill!.createdAt).toLocaleString()}</div>
      <div class="line"></div>
      <table>
        ${bill!.items.map(i => `<tr><td>${i.name} × ${i.quantity}</td><td class="r">₹${(Number(i.price)*i.quantity).toFixed(2)}</td></tr>`).join("")}
      </table>
      <div class="line"></div>
      <table>
        <tr><td>Subtotal</td><td class="r">₹${subtotal.toFixed(2)}</td></tr>
        <tr><td>GST (5%)</td><td class="r">₹${tax.toFixed(2)}</td></tr>
        <tr class="tot"><td>Total</td><td class="r">₹${total.toFixed(2)}</td></tr>
      </table>
      <div class="line"></div>
      <div class="muted">Thank you!</div>
      </body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bill — Table {bill.tableNumber}</DialogTitle>
        </DialogHeader>
        <div className="font-mono text-sm">
          <ul className="space-y-1">
            {bill.items.map((it, idx) => (
              <li key={idx} className="flex justify-between">
                <span>{it.name} × {it.quantity}</span>
                <span>{money(Number(it.price) * it.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-dashed my-3" />
          <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          <div className="flex justify-between"><span>GST (5%)</span><span>{money(tax)}</span></div>
          <div className="flex justify-between font-bold text-base mt-1"><span>Total</span><span>{money(total)}</span></div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={print}><Printer className="h-4 w-4 mr-2" /> Print</Button>
          {showConfirm && onConfirm && (
            <Button onClick={onConfirm}>{confirmLabel}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}