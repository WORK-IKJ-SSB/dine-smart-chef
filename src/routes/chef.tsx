import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StationShell } from "@/components/StationShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/chef")({
  head: () => ({ meta: [{ title: "Chef — TRUST MOMOS" }] }),
  component: ChefPage,
});

type Order = { id: string; table_number: number; status: string; total: number; created_at: string };
type Item = { id: string; order_id: string; name: string; quantity: number };

function ChefPage() {
  const qc = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ["chef-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders").select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Order[];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["chef-items", orders.map((o) => o.id).join(",")],
    enabled: orders.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items").select("*")
        .in("order_id", orders.map((o) => o.id));
      if (error) throw error;
      return data as Item[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("chef-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["chef-orders"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_items" }, () => {
        qc.invalidateQueries({ queryKey: ["chef-items"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  async function markReady(id: string, tableNumber: number) {
    const { error } = await supabase
      .from("orders")
      .update({ status: "ready", ready_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else toast.success(`Table ${tableNumber} marked ready`);
    qc.invalidateQueries({ queryKey: ["chef-orders"] });
  }

  return (
    <StationShell title="Chef's Kitchen" subtitle="Incoming orders — tap Ready when plated">
      {orders.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No pending orders. 🍳</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orders.map((o) => {
            const ois = items.filter((i) => i.order_id === o.id);
            const minutes = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
            return (
              <Card key={o.id} className="p-5 border-l-4 border-l-primary">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl font-serif font-bold">Table {o.table_number}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {minutes}m
                  </span>
                </div>
                <ul className="space-y-1 mb-4">
                  {ois.map((it) => (
                    <li key={it.id} className="flex justify-between text-sm">
                      <span>{it.name}</span>
                      <span className="font-semibold">× {it.quantity}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full" onClick={() => markReady(o.id, o.table_number)}>
                  <Check className="h-4 w-4 mr-2" /> Ready
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </StationShell>
  );
}