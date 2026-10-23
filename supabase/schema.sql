-- Planning de l'équipe : à exécuter une fois dans Supabase > SQL Editor.

-- 1. L'équipe : seules ces adresses peuvent voir et modifier le planning.
--    Les identifiants (leo, julien, justine) doivent correspondre à ceux de index.html.
create table if not exists public.team (
  id    text primary key,
  name  text not null,
  email text not null unique
);

insert into public.team (id, name, email) values
  ('leo',     'Léo',     'EMAIL-DE-LEO'),
  ('julien',  'Julien',  'EMAIL-DE-JULIEN'),
  ('justine', 'Justine', 'EMAIL-DE-JUSTINE')
on conflict (id) do update set name = excluded.name, email = excluded.email;

-- 2. Les tâches.
create table if not exists public.tasks (
  id         text primary key,
  title      text not null,
  client     text not null default '',
  dur        numeric not null default 1,          -- durée en heures
  date       date,                                -- null = dans la liste « à prendre »
  people     text[] not null default '{}',        -- identifiants de l'équipe
  done       boolean not null default false,
  series     text,                                -- même valeur pour toutes les occurrences d'une tâche répétée
  rep        text,                                -- day, week, 2week, month
  updated_at timestamptz not null default now()
);
create index if not exists tasks_date_idx on public.tasks (date);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();

-- 3. Sécurité : un utilisateur connecté n'a accès à rien s'il n'est pas dans l'équipe.
create or replace function public.is_team() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team where lower(email) = lower(auth.jwt() ->> 'email'))
$$;

alter table public.team  enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "equipe lit l'equipe" on public.team;
create policy "equipe lit l'equipe" on public.team for select to authenticated using (public.is_team());

drop policy if exists "equipe gere les taches" on public.tasks;
create policy "equipe gere les taches" on public.tasks for all to authenticated
  using (public.is_team()) with check (public.is_team());

-- 4. Mises à jour en direct entre les navigateurs.
do $$ begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null; end $$;
