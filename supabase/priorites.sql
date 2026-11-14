-- Priorité et échéance des tâches (à passer une seule fois).
-- Supabase > SQL Editor > New query : collez ce fichier, puis cliquez sur Run.
-- Sans ce fichier, le planning fonctionne comme avant ; avec, la fiche d'une tâche propose
-- « Prioritaire » (tâche placée en tête de la journée) et « À rendre pour le » (échéance).
alter table public.tasks
  add column if not exists prio     text check (prio in ('haute')),
  add column if not exists echeance date;
