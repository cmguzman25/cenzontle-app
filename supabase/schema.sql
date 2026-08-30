-- Frase a Frase — esquema de la base de datos
-- Ejecuta este archivo en Supabase → SQL Editor → New query → Run.

-- ---------------------------------------------------------------------------
-- Banco de palabras desconocidas
-- ---------------------------------------------------------------------------
create table if not exists public.words (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  word        text not null,
  meaning     text not null default '',
  lesson_id   text,
  sentence_id integer,
  context     text,
  known       boolean not null default false,
  created_at  timestamptz not null default now(),

  -- Una misma palabra no se guarda dos veces por usuario.
  unique (user_id, word)
);

create index if not exists words_user_created_idx
  on public.words (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Progreso: resultado de la evaluación de comprensión
-- ---------------------------------------------------------------------------
create table if not exists public.progress (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  lesson_id    text not null,
  score        integer not null check (score between 0 and 100),
  correct      integer,
  total        integer,
  completed_at timestamptz not null default now()
);

create index if not exists progress_user_lesson_idx
  on public.progress (user_id, lesson_id, completed_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: cada usuario solo ve y edita lo suyo
-- ---------------------------------------------------------------------------
alter table public.words    enable row level security;
alter table public.progress enable row level security;

drop policy if exists "words: propias" on public.words;
create policy "words: propias" on public.words
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "progress: propio" on public.progress;
create policy "progress: propio" on public.progress
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
