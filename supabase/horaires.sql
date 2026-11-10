-- Ajoute les heures de début et de fin aux tâches (à passer une seule fois).
-- Supabase > SQL Editor > New query : collez ce fichier, puis cliquez sur Run.
-- Sans ce fichier, le planning fonctionne comme avant (durées seules) ; avec, il contrôle
-- les chevauchements, le repos de 11 h, l'amplitude de la journée et les pauses.
alter table public.tasks
  add column if not exists debut text check (debut ~ '^[0-2][0-9]:[0-5][0-9]$'),
  add column if not exists fin   text check (fin ~ '^[0-2][0-9]:[0-5][0-9]$');
