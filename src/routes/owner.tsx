import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { StationShell } from "@/components/StationShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, DollarSign, ShoppingBag, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, Label } from "recharts";
import { generateInsights } from "@/lib/insights.functions";
import { MenuManager } from "@/components/MenuManager";
import { money, hour12 } from "@/lib/format";
import { BillDialog, type BillData } from "@/components/BillDialog";
import { Receipt, Download } from "lucide-react";
import { Trash2 } from "lucide-react";
import { downloadDailyBillsPdf, type BillRow } from "@/lib/billsPdf";
import { toast } from "sonner";

export const Route = createFileRoute("/owner")({
  head: () => ({ meta: [{ title: "Owner — TRUST MOMOS" }] }),
  component: OwnerPage,
});

type Order = { id: string; table_number: number; status: string; total: number; created_at: string };
type Item = { id: string; order_id: string; name: string; price: number; quantity: number };

const COLORS = ["#c2410c", "#ea580c", "#f97316", "#fb923c", "#fdba74", "#fed7aa"];

function OwnerPage() {
  const qc = useQueryClient();
  const { data: orders = [] } = useQuery({
    queryKey: ["orders-today"],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("orders").select("*")
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
    refetchInterval: 5000,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["items-today"],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("order_items").select("*")
        .gte("created_at", start.toISOString());
      if (error) throw error;
      return data as Item[];
    },
    refetchInterval: 5000,
  });

  // 90-day live history
  const { data: history = [] } = useQuery({
    queryKey: ["owner-history-90d"],
    queryFn: async () => {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const { data, error } = await supabase
        .from("orders").select("*")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("owner-orders-history")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["owner-history-90d"] });
        qc.invalidateQueries({ queryKey: ["orders-today"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        qc.invalidateQueries({ queryKey: ["items-today"] });
        qc.invalidateQueries({ queryKey: ["history-items"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const [bill, setBill] = useState<BillData | null>(null);
  const [billOpen, setBillOpen] = useState(false);

  async function viewBill(orderId: string, tableNumber: number, createdAt: string) {
    const { data, error } = await supabase.from("order_items").select("*").eq("order_id", orderId);
    if (error) return toast.error(error.message);
    setBill({
      tableNumber,
      createdAt,
      orderIds: [orderId],
      items: (data ?? []).map((i: any) => ({ name: i.name, price: Number(i.price), quantity: i.quantity })),
    });
    setBillOpen(true);
  }

  async function deleteBill(orderId: string, tableNumber: number) {
    if (!confirm(`Delete bill for Table ${tableNumber}? This cannot be undone.`)) return;
    const { error: ie } = await supabase.from("order_items").delete().eq("order_id", orderId);
    if (ie) return toast.error(ie.message);
    const { error: oe } = await supabase.from("orders").delete().eq("id", orderId);
    if (oe) return toast.error(oe.message);
    toast.success(`Bill for Table ${tableNumber} deleted`);
    qc.invalidateQueries({ queryKey: ["owner-history-90d"] });
    qc.invalidateQueries({ queryKey: ["orders-today"] });
    qc.invalidateQueries({ queryKey: ["items-today"] });
  }

  async function exportDayPdf(silent = false) {
    if (orders.length === 0) {
      if (!silent) toast.error("No bills to export yet.");
      return;
    }
    const byOrder = new Map<string, BillRow["items"]>();
    for (const it of items) {
      const arr = byOrder.get(it.order_id) ?? [];
      arr.push({ name: it.name, quantity: it.quantity, price: Number(it.price) });
      byOrder.set(it.order_id, arr);
    }
    const rows: BillRow[] = orders.map((o) => ({
      table_number: o.table_number,
      created_at: o.created_at,
      total: Number(o.total),
      items: byOrder.get(o.id) ?? [],
    }));
    downloadDailyBillsPdf(rows);
    if (!silent) toast.success("Daily bills PDF downloaded.");
  }

  // Auto-save end-of-day PDF (once per day, after 23:55 local time)
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const key = `bills-autosaved-${now.toISOString().slice(0, 10)}`;
      if (now.getHours() === 23 && now.getMinutes() >= 55 && !localStorage.getItem(key) && orders.length > 0) {
        exportDayPdf(true);
        localStorage.setItem(key, "1");
      }
    };
    const id = setInterval(check, 60_000);
    check();
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, items]);

  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0);
    const itemMap = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const it of items) {
      const cur = itemMap.get(it.name) ?? { name: it.name, qty: 0, revenue: 0 };
      cur.qty += it.quantity;
      cur.revenue += Number(it.price) * it.quantity;
      itemMap.set(it.name, cur);
    }
    const topItems = [...itemMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 6);
    const hours = new Array(24).fill(0).map((_, h) => ({ hour: h, orders: 0 }));
    for (const o of orders) hours[new Date(o.created_at).getHours()].orders++;
    const byHour = hours.filter((h) => h.orders > 0);
    return { totalOrders, totalRevenue, topItems, byHour };
  }, [orders, items]);

  const generate = useServerFn(generateInsights);
  const [insights, setInsights] = useState<string>("");
  const [loadingAi, setLoadingAi] = useState(false);

  async function runAI() {
    setLoadingAi(true);
    try {
      const res = await generate({ data: { stats } });
      setInsights(res.insights);
    } finally {
      setLoadingAi(false);
    }
  }

  return (
    <StationShell title="Owner Dashboard" subtitle="Today's performance & AI insights">
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <StatCard icon={ShoppingBag} label="Orders Today" value={stats.totalOrders.toString()} />
        <StatCard icon={DollarSign} label="Revenue" value={money(stats.totalRevenue)} />
        <StatCard icon={TrendingUp} label="Avg Ticket" value={money(stats.totalOrders ? stats.totalRevenue / stats.totalOrders : 0)} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card className="p-6">
          <h3 className="font-serif text-lg font-semibold mb-4">Orders by Hour</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={stats.byHour} margin={{ top: 10, right: 16, bottom: 28, left: 8 }}>
                <XAxis dataKey="hour" tickFormatter={hour12} stroke="hsl(var(--muted-foreground))" height={40}>
                  <Label value="Time of Day" position="insideBottom" offset={-8} fill="hsl(var(--muted-foreground))" />
                </XAxis>
                <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false}>
                  <Label value="Orders" angle={-90} position="insideLeft" fill="hsl(var(--muted-foreground))" />
                </YAxis>
                <Tooltip labelFormatter={(h: number) => hour12(h)} />
                <Bar dataKey="orders" fill="#ea580c" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="font-serif text-lg font-semibold mb-4">Top Items (by quantity)</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={stats.topItems} dataKey="qty" nameKey="name" outerRadius={90}>
                  {stats.topItems.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> AI Insights
          </h3>
          <Button onClick={runAI} disabled={loadingAi || stats.totalOrders === 0}>
            {loadingAi ? "Analyzing…" : "Generate"}
          </Button>
        </div>
        {insights ? (
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground">{insights}</div>
        ) : (
          <p className="text-muted-foreground text-sm">
            {stats.totalOrders === 0 ? "Take some orders first to unlock AI insights." : "Click Generate for AI-driven analysis of today's sales."}
          </p>
        )}
      </Card>

      <Card className="p-6 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg font-semibold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Today's Bills
          </h3>
          <Button size="sm" variant="outline" onClick={() => exportDayPdf(false)} disabled={orders.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Download PDF
          </Button>
        </div>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet today.</p>
        ) : (
          <ul className="divide-y divide-border">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">Table {o.table_number}</span>
                <span className="text-muted-foreground">{new Date(o.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                <span className="font-semibold">{money(o.total)}</span>
                <Button size="sm" variant="outline" onClick={() => viewBill(o.id, o.table_number, o.created_at)}>
                  <Receipt className="h-3 w-3 mr-1" /> Bill
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <BillDialog open={billOpen} onOpenChange={setBillOpen} bill={bill} showConfirm={false} />

      <Card className="p-6 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg font-semibold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Order History (last 90 days)
          </h3>
          <span className="text-xs text-muted-foreground">{history.length} order{history.length === 1 ? "" : "s"} · live</span>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders in the past 90 days.</p>
        ) : (
          <div className="max-h-[28rem] overflow-y-auto">
            <ul className="divide-y divide-border">
              {history.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="font-medium w-20">Table {o.table_number}</span>
                  <span className="text-muted-foreground flex-1">
                    {new Date(o.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    o.status === "ready" ? "bg-accent text-accent-foreground"
                    : o.status === "paid" ? "bg-muted text-muted-foreground"
                    : "bg-secondary text-secondary-foreground"
                  }`}>{o.status}</span>
                  <span className="font-semibold w-20 text-right">{money(o.total)}</span>
                  <Button size="sm" variant="outline" onClick={() => viewBill(o.id, o.table_number, o.created_at)}>
                    <Receipt className="h-3 w-3 mr-1" /> Bill
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="mt-8">
        <MenuManager />
      </div>
    </StationShell>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
      </div>
    </Card>
  );
}