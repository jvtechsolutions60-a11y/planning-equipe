-- Interventions : type, statut, fiche client, notes, plusieurs jours, report, modèles (à passer une seule fois).
-- Supabase > SQL Editor > New query : collez ce fichier, puis cliquez sur Run.
-- Les tâches existantes sont reprises : celles qui ont un client deviennent « intervention client », les autres « tâche interne »,
-- les tâches cochées deviennent « terminée », et une fiche client est créée pour chaque nom de client déjà saisi.

-- 1. Fiches clients
create table if not exists public.clients (
  id         text primary key,
  nom        text not null,
  adresse    text not null default '',
  telephone  text not null default '',
  notes      text not null default '',
  updated_at timestamptz not null default now()
);
create unique index if not exists clients_nom_idx on public.clients (lower(nom));

-- 2. Modèles d'intervention (titre, durée, type… enregistrés pour être réutilisés)
create table if not exists public.modeles (
  id         text primary key,
  nom        text not null,
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- 3. Nouveaux champs des tâches, ajoutés une seule fois avec la reprise des données existantes
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tasks' and column_name = 'kind') then
    alter table public.tasks
      add column kind       text not null default 'client'    check (kind in ('client', 'interne', 'formation', 'absence', 'conge')),
      add column status     text not null default 'planifiee' check (status in ('planifiee', 'en_cours', 'terminee', 'reportee', 'attente', 'a_revoir', 'annulee')),
      add column notes      text not null default '',
      add column lieu       text not null default 'site'      check (lieu in ('site', 'distance')),
      add column client_id  text references public.clients (id) on delete set null,
      add column fin_date   date,
      add column reporte_de date;
    update public.tasks set kind = 'interne' where client = '';
    update public.tasks set status = 'terminee' where done;
    insert into public.clients (id, nom)
      select 'c' || substr(md5(lower(client)), 1, 10), min(client) from public.tasks where client <> '' group by lower(client)
      on conflict do nothing;
    update public.tasks t set client_id = c.id from public.clients c where t.client <> '' and lower(t.client) = lower(c.nom);
  end if;
end $$;

-- 4. Sécurité : mêmes règles que les tâches (équipe uniquement)
alter table public.clients enable row level security;
alter table public.modeles enable row level security;
drop policy if exists "equipe gere les clients" on public.clients;
create policy "equipe gere les clients" on public.clients for all to authenticated using (public.is_team()) with check (public.is_team());
drop policy if exists "equipe gere les modeles" on public.modeles;
create policy "equipe gere les modeles" on public.modeles for all to authenticated using (public.is_team()) with check (public.is_team());

drop trigger if exists clients_touch on public.clients;
create trigger clients_touch before update on public.clients for each row execute function public.touch_updated_at();
drop trigger if exists modeles_touch on public.modeles;
create trigger modeles_touch before update on public.modeles for each row execute function public.touch_updated_at();
