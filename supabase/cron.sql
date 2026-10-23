-- Récap du vendredi midi : à exécuter APRÈS avoir déployé la fonction recap-hebdo.
-- Remplacez VOTRE-PROJET et LE-SECRET (la même valeur que CRON_SECRET dans les secrets de la fonction).
-- La tâche tourne toutes les heures le vendredi ; la fonction n'envoie qu'à 12 h, heure de Paris
-- (cela gère seule le passage heure d'été / heure d'hiver).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('recap-hebdo') where exists (select 1 from cron.job where jobname = 'recap-hebdo');
select cron.schedule(
  'recap-hebdo',
  '0 * * * 5',
  $$
  select net.http_post(
    url     := 'https://VOTRE-PROJET.supabase.co/functions/v1/recap-hebdo',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'LE-SECRET'),
    body    := '{}'::jsonb
  );
  $$
);
