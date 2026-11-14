-- Contrôles de sécurité et de cohérence sur les tâches (à passer une fois : Supabase > SQL Editor > Run).
-- Les contraintes sont ajoutées « not valid » : elles s'appliquent à toute nouvelle écriture sans bloquer
-- sur d'anciennes lignes. Pour vérifier aussi l'existant, voir la requête en bas du fichier.

-- identifiant : lettres, chiffres, tiret et souligné seulement (jamais de guillemet ni de balise)
alter table public.tasks drop constraint if exists tasks_id_format;
alter table public.tasks add constraint tasks_id_format check (id ~ '^[A-Za-z0-9_-]{1,80}$') not valid;

-- durée : de 15 min à 70 h
alter table public.tasks drop constraint if exists tasks_dur_bornes;
alter table public.tasks add constraint tasks_dur_bornes check (dur >= 0.25 and dur <= 70) not valid;

-- personnes : uniquement des identifiants de l'équipe (lettres minuscules)
alter table public.tasks drop constraint if exists tasks_people_format;
alter table public.tasks add constraint tasks_people_format check (array_to_string(people, ',') ~ '^([a-z0-9_-]+(,[a-z0-9_-]+)*)?$') not valid;

-- horaires (si supabase/horaires.sql a été passé) : heures de 00:00 à 23:59, fin après début quand les deux sont donnés
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tasks' and column_name = 'debut') then
    alter table public.tasks drop constraint if exists tasks_heures_valides;
    alter table public.tasks add constraint tasks_heures_valides check (
      (debut is null or debut ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
      and (fin is null or fin ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
      and (debut is null or fin is null or fin > debut)) not valid;
  end if;
end $$;

-- Vérification de l'existant (facultatif) : liste les lignes qui ne respectent pas ces règles.
-- select id, title, dur, people from public.tasks
--   where id !~ '^[A-Za-z0-9_-]{1,80}$' or dur < 0.25 or dur > 70;
