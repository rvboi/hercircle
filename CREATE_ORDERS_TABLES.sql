-- Create distributor_admin_orders table
create table if not exists public.distributor_admin_orders (
  id uuid not null default gen_random_uuid (),
  distributor_id uuid not null,
  order_date timestamp with time zone null default now(),
  status text not null default 'Pending'::text,
  total_amount numeric(10, 2) null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint distributor_admin_orders_pkey primary key (id),
  constraint distributor_admin_orders_distributor_id_fkey foreign KEY (distributor_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

-- Create distributor_admin_order_items table
create table if not exists public.distributor_admin_order_items (
  id uuid not null default gen_random_uuid (),
  order_id uuid null,
  product_id uuid null,
  quantity integer not null,
  price numeric(10, 2) not null,
  constraint distributor_admin_order_items_pkey primary key (id),
  constraint distributor_admin_order_items_order_id_fkey foreign KEY (order_id) references distributor_admin_orders (id) on delete CASCADE,
  constraint distributor_admin_order_items_product_id_fkey foreign KEY (product_id) references products (id)
) TABLESPACE pg_default;
