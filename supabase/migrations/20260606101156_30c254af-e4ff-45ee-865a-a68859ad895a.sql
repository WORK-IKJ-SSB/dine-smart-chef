
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  category TEXT NOT NULL DEFAULT 'Main',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ready_at TIMESTAMPTZ
);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO anon, authenticated;
GRANT ALL ON public.menu_items TO service_role;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.order_items TO service_role;

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read menu" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "public write menu" ON public.menu_items FOR INSERT WITH CHECK (true);
CREATE POLICY "public update menu" ON public.menu_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete menu" ON public.menu_items FOR DELETE USING (true);

CREATE POLICY "public read orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "public write orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "public update orders" ON public.orders FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete orders" ON public.orders FOR DELETE USING (true);

CREATE POLICY "public read items" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "public write items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "public update items" ON public.order_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete items" ON public.order_items FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;

INSERT INTO public.menu_items (name, price, category) VALUES
  ('Margherita Pizza', 12.50, 'Main'),
  ('Pepperoni Pizza', 14.00, 'Main'),
  ('Caesar Salad', 8.50, 'Starter'),
  ('Garlic Bread', 5.00, 'Starter'),
  ('Spaghetti Carbonara', 13.50, 'Main'),
  ('Grilled Salmon', 18.00, 'Main'),
  ('Tiramisu', 6.50, 'Dessert'),
  ('Chocolate Lava Cake', 7.00, 'Dessert'),
  ('Espresso', 3.00, 'Drink'),
  ('Fresh Lemonade', 4.50, 'Drink');
