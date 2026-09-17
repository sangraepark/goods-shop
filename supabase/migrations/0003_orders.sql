create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id),
  order_id text not null unique,
  amount integer not null check (amount > 0),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PAID', 'FAILED')),
  payment_key text,
  method text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create index orders_user_id_idx on public.orders(user_id);
