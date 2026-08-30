-- Run this in the Supabase SQL editor.

-- ---------- USERS ----------
create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  business_name text,
  business_address text,
  business_phone text,
  created_at timestamptz default now()
);

-- ---------- INVOICES ----------
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  invoice_no text not null,
  business_name text,
  business_address text,
  business_email text,
  business_phone text,
  client_name text,
  client_email text,
  client_address text,
  issue_date date,
  due_date date,
  status text default 'draft' check (status in ('draft', 'sent', 'paid')),
  notes text,
  created_at timestamptz default now()
);

-- ---------- INVOICE ITEMS ----------
create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text,
  quantity numeric default 1,
  unit_price numeric default 0,
  total numeric default 0
);

-- ---------- ROW LEVEL SECURITY ----------
alter table users enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;

-- Users can only read/write their own profile
create policy "users: own row only" on users
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Users can only read/write their own invoices
create policy "invoices: own rows only" on invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Invoice items inherit access from their parent invoice
create policy "invoice_items: own rows only" on invoice_items
  for all using (
    exists (
      select 1 from invoices
      where invoices.id = invoice_items.invoice_id
      and invoices.user_id = auth.uid()
    )
  );
