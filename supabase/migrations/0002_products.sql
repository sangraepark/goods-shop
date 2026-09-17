create extension if not exists pgcrypto;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price integer not null check (price > 0),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
