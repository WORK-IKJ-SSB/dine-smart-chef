import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StationShell } from "@/components/StationShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Minus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/waiter")({
  head: () => ({ meta: [{ title: "Waiter — Tavola" }] }),
  component: WaiterPage,
});

type MenuItem = { id: string; name: string; price: number; category: string; image_url: string | null };
type Order = { id: string; table_number: number; status: string; total: number; created_at: string };

const TABLES = Array.from({ length: 12 }, (_, i) => i + 1);

function WaiterPage() {
  const qc = useQueryClient();
  const [table, setTable] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<string, { item: MenuItem; qty: number }>>({});
  const [submitting, setSubmitting] = useState(false);

  const { data: menu = [] } = useQuery({
    queryKey: ["menu"],
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_items").select("*").order("category");
      if (error) throw error;
      return data as MenuItem[];
    },
  });

  const { data: myOrders = [] } = useQuery({
    queryKey: ["waiter-orders"],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase.from("orders").select("*")
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });

  // Realtime — notify on status change to ready
  useEffect(() => {
    const ch = supabase
      .channel("waiter-orders")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        const o = payload.new as Order;
        if (o.status === "ready") {
          toast.success(`Table ${o.table_number} — order ready!`, { duration: 6000 });
        }
        qc.invalidateQueries({ queryKey: ["waiter-orders"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["waiter-orders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const categories = useMemo(() => {
    const m = new Map<string, MenuItem[]>();
    for (const it of menu) {
      if (!m.has(it.category)) m.set(it.category, []);
      m.get(it.category)!.push(it);
    }
    return [...m.entries()];
  }, [menu]);

  const total = useMemo(
    () => Object.values(cart).reduce((s, c) => s + Number(c.item.price) * c.qty, 0),
    [cart],
  );

  function add(item: MenuItem) {
    setCart((c) => ({ ...c, [item.id]: { item, qty: (c[item.id]?.qty ?? 0) + 1 } }));
  }
  function dec(id: string) {
    setCart((c) => {
      const cur = c[id]; if (!cur) return c;
      if (cur.qty <= 1) { const { [id]: _, ...rest } = c; return rest; }
      return { ...c, [id]: { ...cur, qty: cur.qty - 1 } };
    });
  }

  async function submitOrder() {
    if (!table || Object.keys(cart).length === 0) return;
    setSubmitting(true);
    try {
      const { data: order, error: oErr } = await supabase
        .from("orders")
        .insert({ table_number: table, status: "pending", total })
        .select().single();
      if (oErr) throw oErr;
      const rows = Object.values(cart).map((c) => ({
        order_id: order.id, menu_item_id: c.item.id, name: c.item.name, price: c.item.price, quantity: c.qty,
      }));
      const { error: iErr } = await supabase.from("order_items").insert(rows);
      if (iErr) throw iErr;
      toast.success(`Order sent to kitchen for Table ${table}`);
      setCart({});
      qc.invalidateQueries({ queryKey: ["waiter-orders"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StationShell title="Waiter Station" subtitle="Pick a table, build the order, send to kitchen">
      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div>
          <Card className="p-5 mb-6">
            <h3 className="font-serif text-lg font-semibold mb-3">Table</h3>
            <div className="flex flex-wrap gap-2">
              {TABLES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTable(t)}
                  className={`h-12 w-12 rounded-lg border font-semibold transition ${
                    table === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-serif text-lg font-semibold mb-3">Menu</h3>
            <div className="space-y-6">
              {categories.map(([cat, list]) => (
                <div key={cat}>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{cat}</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {list.map((it) => (
                      <button
                        key={it.id}
                        onClick={() => add(it)}
                        className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 text-left hover:border-primary hover:bg-accent/10 transition"
                      >
                        {it.image_url ? (
                          <img src={it.image_url} alt={it.name} className="h-12 w-12 rounded-md object-cover shrink-0" />
                        ) : (
                          <div className="h-12 w-12 rounded-md bg-muted shrink-0" />
                        )}
                        <span className="flex-1 min-w-0">
                          <span className="font-medium text-foreground block truncate">{it.name}</span>
                          <span className="block text-xs text-muted-foreground">${Number(it.price).toFixed(2)}</span>
                        </span>
                        <Plus className="h-4 w-4 text-primary shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-lg font-semibold">Order {table ? `· Table ${table}` : ""}</h3>
              {Object.keys(cart).length > 0 && (
                <button onClick={() => setCart({})} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            {Object.keys(cart).length === 0 ? (
              <p className="text-sm text-muted-foreground">No items yet.</p>
            ) : (
              <ul className="space-y-2 mb-4">
                {Object.values(cart).map(({ item, qty }) => (
                  <li key={item.id} className="flex items-center justify-between text-sm">
                    <span className="flex-1 truncate">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => dec(item.id)} className="h-6 w-6 rounded border border-border flex items-center justify-center">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center">{qty}</span>
                      <button onClick={() => add(item)} className="h-6 w-6 rounded border border-border flex items-center justify-center">
                        <Plus className="h-3 w-3" />
                      </button>
                      <span className="w-14 text-right text-muted-foreground">${(Number(item.price) * qty).toFixed(2)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-border pt-3 flex items-center justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-lg">${total.toFixed(2)}</span>
            </div>
            <Button
              className="w-full mt-4"
              disabled={!table || Object.keys(cart).length === 0 || submitting}
              onClick={submitOrder}
            >
              <Send className="h-4 w-4 mr-2" /> Send to Kitchen
            </Button>
          </Card>

          <Card className="p-5">
            <h3 className="font-serif text-lg font-semibold mb-3">Today's Orders</h3>
            {myOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <ul className="space-y-2">
                {myOrders.slice(0, 8).map((o) => (
                  <li key={o.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                    <span>Table {o.table_number}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      o.status === "ready" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
                    }`}>{o.status}</span>
                    <span className="text-muted-foreground">${Number(o.total).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </StationShell>
  );
}