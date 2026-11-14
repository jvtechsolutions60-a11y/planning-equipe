-- Priorité et échéance des tâches (à passer une seule fois).
-- Supabase > SQL Editor > New query : collez ce fichier, puis cliquez sur Run (après interventions.sql).
-- Sans ce fichier, le planning fonctionne comme avant ; avec, la fiche d'une tâche propose
-- « Prioritaire » (tâche placée en tête de la journée) et « À rendre pour le » (échéance).
alter table public.tasks
  add column if not exists prio     text check (prio in ('haute')),
  add column if not exists echeance date;

-- Jours d'école de Léo ajoutés le 14/11/2026 avant le passage de interventions.sql : ils sont arrivés sans type.
-- Une fois interventions.sql passé (à faire AVANT ce fichier), on leur redonne le type « formation ».
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tasks' and column_name = 'kind') then
    update public.tasks set kind = 'formation' where title = 'École (CFA PROMEO)' and kind <> 'formation';
  end if;
end $$;
