-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard → your project → SQL Editor)

-- Items table
create table if not exists items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  price       numeric(12, 2) not null default 0,
  qty         integer not null default 0,
  category    text not null default 'Other',
  image_url   text,
  created_at  timestamptz default now()
);

-- Transactions table
create table if not exists transactions (
  id        uuid primary key default gen_random_uuid(),
  item_id   uuid references items(id) on delete set null,
  qty_sold  integer not null,
  total     numeric(12, 2) not null,
  notes     text,
  date      timestamptz not null default now()
);

-- Expenses table
create table if not exists expenses (
  id         uuid primary key default gen_random_uuid(),
  amount     numeric(12, 2) not null,
  reason     text not null,
  date       date not null default current_date,
  created_at timestamptz default now()
);

-- Enable real-time for all three tables
-- (In Supabase dashboard: Database → Replication → enable items, transactions, expenses)
alter publication supabase_realtime add table items;
alter publication supabase_realtime add table transactions;
alter publication supabase_realtime add table expenses;

-- Migration: add one-time offer support
-- Run this in Supabase SQL Editor if your tables already exist:
-- alter table items add column if not exists is_one_time boolean not null default false;
