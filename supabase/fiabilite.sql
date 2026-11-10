-- Historique des modifications du planning (à passer une seule fois).
-- Supabase > SQL Editor > New query : collez ce fichier, puis cliquez sur Run.
-- La base note elle-même chaque ajout, modification et suppression, avec l'auteur et l'heure.
-- Rien n'est modifiable depuis le site : l'historique est en lecture seule pour l'équipe.

create table if not exists public.historique (
  id      bigserial primary key,
  task_id text not null,
  action  text not null,                         -- ajout, modif, suppression
  champs  text[],                                -- champs modifiés
  avant   jsonb,
  apres   jsonb,
  par     text default (auth.jwt() ->> 'email'), -- adresse de la personne connectée
  le      timestamptz not null default now()
);
create index if not exists historique_tache_idx on public.historique (task_id, le desc);

alter table public.historique enable row level security;
drop policy if exists "equipe lit l'historique" on public.historique;
create policy "equipe lit l'historique" on public.historique for select to authenticated using (public.is_team());

create or replace function public.journaliser() returns trigger
language plpgsql security definer set search_path = public as $$
declare ch text[];
begin
  if tg_op = 'INSERT' then
    insert into historique (task_id, action, apres) values (new.id, 'ajout', to_jsonb(new));
  elsif tg_op = 'DELETE' then
    insert into historique (task_id, action, avant) values (old.id, 'suppression', to_jsonb(old));
  else
    select array_agg(n.key) into ch
      from jsonb_each(to_jsonb(new)) n
     where n.key <> 'updated_at' and n.value is distinct from (to_jsonb(old) -> n.key);
    if ch is not null then
      insert into historique (task_id, action, champs, avant, apres) values (new.id, 'modif', ch, to_jsonb(old), to_jsonb(new));
    end if;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists tasks_journal on public.tasks;
create trigger tasks_journal after insert or update or delete on public.tasks
  for each row execute function public.journaliser();

-- Ménage : on garde 18 mois d'historique (à relancer de temps en temps si besoin).
delete from public.historique where le < now() - interval '18 months';
