import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ChefHat, Utensils, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TRUST MOMOS — Restaurant Orders" },
      { name: "description", content: "Manage restaurant orders across owner, waiter, and chef in one place." },
      { property: "og:title", content: "TRUST MOMOS — Restaurant Orders" },
      { property: "og:description", content: "Manage restaurant orders across owner, waiter, and chef in one place." },
    ],
  }),
  component: Index,
});

function Index() {
  const roles = [
    { to: "/owner", label: "Owner", desc: "Daily stats & AI insights", icon: BarChart3, accent: "from-primary to-accent" },
    { to: "/waiter", label: "Waiter", desc: "Take orders by table", icon: Utensils, accent: "from-accent to-primary" },
    { to: "/chef", label: "Chef", desc: "Kitchen queue & ready", icon: ChefHat, accent: "from-primary/80 to-accent/80" },
  ] as const;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-10 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Tavola</p>
        <h1 className="mt-3 text-5xl md:text-6xl font-serif font-bold text-foreground">
          Restaurant Orders, Orchestrated
        </h1>
        <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
          Pick your station to get started.
        </p>
      </header>
      <main className="flex-1 px-6 pb-16">
        <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-3">
          {roles.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className="group rounded-2xl border border-border bg-card p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all"
            >
              <div className={`inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${r.accent} text-primary-foreground shadow-md`}>
                <r.icon className="h-7 w-7" />
              </div>
              <h2 className="mt-6 text-2xl font-serif font-semibold text-foreground">{r.label}</h2>
              <p className="mt-2 text-muted-foreground">{r.desc}</p>
              <span className="mt-6 inline-block text-sm font-medium text-primary group-hover:underline">
                Enter →
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
