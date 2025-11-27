-- Create rooms table and add room_id to messages
-- Run this migration on your Supabase project.

create extension if not exists "pgcrypto";

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_by text not null,
  private boolean not null default true,
  created_at timestamp with time zone default now()
);

alter table if exists messages
  add column if not exists room_id uuid references rooms(id) on delete cascade;

create index if not exists idx_messages_room_created_at on messages(room_id, created_at desc);
