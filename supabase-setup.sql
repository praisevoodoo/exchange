-- One-time setup for the exchange app's sync.
-- Paste all of this into Supabase → SQL Editor → New query, then click Run.

-- Your app data: one row per account, holding everything as JSON.
create table if not exists public.app_state (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

-- Only you can see or change your own row.
drop policy if exists "read own state" on public.app_state;
drop policy if exists "add own state" on public.app_state;
drop policy if exists "change own state" on public.app_state;
drop policy if exists "delete own state" on public.app_state;
create policy "read own state" on public.app_state for select to authenticated using (auth.uid() = user_id);
create policy "add own state" on public.app_state for insert to authenticated with check (auth.uid() = user_id);
create policy "change own state" on public.app_state for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own state" on public.app_state for delete to authenticated using (auth.uid() = user_id);

-- Attached document files: a private bucket, one folder per account.
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "read own files" on storage.objects;
drop policy if exists "add own files" on storage.objects;
drop policy if exists "change own files" on storage.objects;
drop policy if exists "delete own files" on storage.objects;
create policy "read own files" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "add own files" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "change own files" on storage.objects for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own files" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
