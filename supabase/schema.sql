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
  -- OBSOLETAS: no se leen ni se escriben. Aquí solo cabía un trozo de audio
  -- por palabra, y la misma palabra sale en varias frases sonando en segundos
  -- distintos: la segunda aparición acababa mandando al usuario a la primera.
  -- Los segundos viven ahora en `word_audio`, con la frase en la clave.
  audio_start numeric,
  audio_end   numeric,
  created_at  timestamptz not null default now(),

  -- Una misma palabra no se guarda dos veces por usuario.
  unique (user_id, word)
);

-- Para bases de datos creadas antes de que existiera el ajuste de audio.
-- Se dejan por no tirar datos viejos, pero ya no se usan (ver arriba).
alter table public.words add column if not exists audio_start numeric;
alter table public.words add column if not exists audio_end   numeric;

create index if not exists words_user_created_idx
  on public.words (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Ajuste del trozo de audio de una palabra, compartido entre todos
--
-- Cuadrar a mano dónde suena una palabra es trabajo que no tiene sentido
-- repetir: es la misma historia y el mismo audio para todo el mundo. Quien lo
-- ajuste lo deja hecho para los demás.
-- ---------------------------------------------------------------------------
create table if not exists public.word_audio (
  lesson_id   text not null,
  sentence_id integer not null,
  -- Siempre en minúsculas: "Written" y "written" son el mismo trozo de audio.
  term        text not null,
  audio_start numeric not null,
  audio_end   numeric not null,
  -- Visto bueno: lo marca el usuario a mano cuando el trozo suena bien.
  -- Mover las flechas no lo pone solo; para eso está el botón.
  confirmed   boolean not null default false,
  updated_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now(),

  primary key (lesson_id, sentence_id, term)
);

-- Para bases de datos creadas antes de que existiera el visto bueno.
alter table public.word_audio
  add column if not exists confirmed boolean not null default false;

alter table public.word_audio enable row level security;

drop policy if exists "word_audio: leer" on public.word_audio;
create policy "word_audio: leer" on public.word_audio
  for select
  to authenticated
  using (true);

drop policy if exists "word_audio: escribir" on public.word_audio;
create policy "word_audio: escribir" on public.word_audio
  for insert
  to authenticated
  with check (auth.uid() = updated_by);

drop policy if exists "word_audio: corregir" on public.word_audio;
create policy "word_audio: corregir" on public.word_audio
  for update
  to authenticated
  using (true)
  with check (auth.uid() = updated_by);

drop policy if exists "word_audio: borrar" on public.word_audio;
create policy "word_audio: borrar" on public.word_audio
  for delete
  to authenticated
  using (true);

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
-- Por dónde va el usuario en cada lección
-- ---------------------------------------------------------------------------
create table if not exists public.lesson_position (
  user_id     uuid not null references auth.users (id) on delete cascade,
  lesson_id   text not null,
  sentence_id integer not null,
  updated_at  timestamptz not null default now(),

  -- Una sola marca por usuario y lección: siempre la última.
  primary key (user_id, lesson_id)
);

-- ---------------------------------------------------------------------------
-- Row Level Security: cada usuario solo ve y edita lo suyo
-- ---------------------------------------------------------------------------
alter table public.words           enable row level security;
alter table public.progress        enable row level security;
alter table public.lesson_position enable row level security;

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

drop policy if exists "lesson_position: propia" on public.lesson_position;
create policy "lesson_position: propia" on public.lesson_position
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
