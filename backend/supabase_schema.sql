-- StudyPilot AI — Supabase / PostgreSQL schema
-- Run this in the Supabase SQL editor, then set SUPABASE_URL + SUPABASE_KEY
-- (service-role key) on the backend to switch from in-memory to Postgres.
--
-- The backend scopes every query by user_id and connects with the service-role
-- key, so it operates below row-level security. `id` on `users` is the Firebase
-- uid (text); other ids are server-generated UUID strings.

create table if not exists users (
  id          text primary key,
  name        text,
  email       text,
  university  text,
  semester    text,
  created_at  timestamptz not null default now()
);

create table if not exists uploaded_materials (
  id           uuid primary key,
  user_id      text not null references users (id) on delete cascade,
  file_name    text not null,
  file_url     text,
  chunk_count  integer not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists quizzes (
  id             uuid primary key,
  user_id        text not null references users (id) on delete cascade,
  material_id    uuid,
  score          double precision,
  topic_mastery  jsonb,
  created_at     timestamptz not null default now()
);

create table if not exists doubt_notebook (
  id              uuid primary key,
  user_id         text not null references users (id) on delete cascade,
  material_id     uuid,
  question_text   text not null,
  ai_answer_text  text not null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_materials_user on uploaded_materials (user_id);
create index if not exists idx_quizzes_user   on quizzes (user_id);
create index if not exists idx_doubts_user    on doubt_notebook (user_id);
