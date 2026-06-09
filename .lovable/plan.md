Add a live 90-day order history view to the Owner dashboard.

## What changes

**Owner dashboard** (`src/routes/owner.tsx`) — add an "Order History (last 90 days)" section that:
- Fetches all orders with `created_at >= now() - 90 days`, newest first
- Subscribes to realtime changes on the `orders` table so new/updated orders appear live without refresh
- Shows table number, time, status badge, total, and item summary per order
- Lazy-loads order items per row (expandable) to keep the initial query light

## Technical details

- Use `useQuery` with key `["owner-history-90d"]` and a Supabase select filtered on `created_at`.
- Add a `supabase.channel("owner-orders-history")` subscription on `postgres_changes` for `orders` (INSERT/UPDATE/DELETE) → `qc.invalidateQueries(["owner-history-90d"])`. Also subscribe to `order_items` INSERTs to refresh the expanded row's items.
- Realtime is already used elsewhere (chef, waiter), so the `orders` table is already in the `supabase_realtime` publication — no migration needed. If a row doesn't arrive live, add `ALTER PUBLICATION supabase_realtime ADD TABLE public.orders, public.order_items;` migration.
- Keep all existing owner widgets intact; this is purely additive.
- Retention: no deletion — orders remain in DB forever; the UI just windows to 90 days.

No schema changes required (pending verification of realtime publication).
