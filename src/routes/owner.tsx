import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { StationShell } from "@/components/StationShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, DollarSign, ShoppingBag, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { generateInsights } from "@/lib/insights.functions";

export const Route = createFileRoute("/owner")({
  head: () => ({ meta: [{ title: "Owner — Tavola" }] }),
  component: OwnerPage,
});

type Order = { id: string; table_number: number; status: string; total: number; created_at: string };
type Item = { id: string; order_id: string; name: string; price: number; quantity: number };

const COLORS = ["#c2410c", "#ea580c", "#f97316", "#fb923c", "#fdba74", "#fed7aa"];

function OwnerPage() {
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
        <StatCard icon={DollarSign} label="Revenue" value={`$${stats.totalRevenue.toFixed(2)}`} />
        <StatCard icon={TrendingUp} label="Avg Ticket" value={`$${(stats.totalOrders ? stats.totalRevenue / stats.totalOrders : 0).toFixed(2)}`} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card className="p-6">
          <h3 className="font-serif text-lg font-semibold mb-4">Orders by Hour</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={stats.byHour}>
                <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip />
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