# Planning de l'équipe

Planning partagé de Léo, Julien et Justine : qui fait quoi chaque semaine, tâches à prendre, tâches communes, tâches répétitives, et récap par email chaque vendredi à 12 h.

- **Site** : une page web statique (`index.html`), hébergée gratuitement sur GitHub Pages.
- **Données et connexion** : Supabase (gratuit). Connexion par lien envoyé par email, sans mot de passe. Seules les adresses de l'équipe ont accès.
- **Emails** : Resend (gratuit jusqu'à 3 000 emails par mois), déclenché par Supabase.

Comptez environ 30 minutes la première fois. Les étapes marquées **(vous)** demandent votre compte ; pour le reste, Claude peut s'en charger.

---

## Étape 1 : dépôt GitHub (vous)

1. Sur GitHub, créez un dépôt nommé `planning-equipe`. Il peut être privé. Ne cochez rien : pas de README, pas de licence.
2. Donnez le nom du dépôt à Claude, qui y déposera le code.

## Étape 2 : Supabase (vous)

1. Créez un compte sur [supabase.com](https://supabase.com), puis un projet. Choisissez la région **Paris (eu-west-3)** et notez le mot de passe de la base.
2. Ouvrez **SQL Editor**, collez le contenu de `supabase/schema.sql` et remplacez `EMAIL-DE-LEO`, `EMAIL-DE-JULIEN` et `EMAIL-DE-JUSTINE` par les vraies adresses. Cliquez sur **Run**.
3. Ouvrez **Project Settings > API** et copiez :
   - l'**URL** du projet (`https://xxxx.supabase.co`) ;
   - la clé **anon public**.

   Ces deux valeurs vont dans `config.js`. Elles peuvent être transmises à Claude : la clé « anon » est publique par conception, et l'accès est protégé par les règles de la base. Ne transmettez jamais la clé **service_role**.

## Étape 3 : mise en ligne avec GitHub Pages (vous, un clic)

1. Sur GitHub, dans le dépôt `planning-equipe`, ouvrez **Settings > Pages**.
2. Sous **Build and deployment > Branch**, choisissez `main` et `/ (root)`, puis cliquez sur **Save**.
3. Une à deux minutes plus tard, le site est en ligne à l'adresse
   `https://jvtechsolutions60-a11y.github.io/planning-equipe/`.
4. De retour dans Supabase, ouvrez **Authentication > URL Configuration** :
   - **Site URL** : `https://jvtechsolutions60-a11y.github.io/planning-equipe/` ;
   - **Redirect URLs** : ajoutez la même adresse.

À ce stade, le planning fonctionne. Chacun ouvre l'adresse, saisit son email, clique sur le lien reçu, et c'est parti.

Vercel reste possible à la place de GitHub Pages (Add New > Project, import du dépôt, Deploy) : remplacez alors l'adresse ci-dessus par celle de Vercel.

## Étape 4 : récap du vendredi midi (vous, puis Claude)

1. Créez un compte sur [resend.com](https://resend.com).
2. **Domains > Add domain** : ajoutez le domaine de vos adresses (par exemple `jvtech.fr`) et créez chez votre hébergeur DNS les enregistrements indiqués. Sans domaine vérifié, Resend n'envoie qu'à votre propre adresse.
3. **API Keys > Create** : créez une clé et gardez-la pour vous.
4. Dans Supabase, ouvrez **Edge Functions > Secrets** et ajoutez :

   | Nom | Valeur |
   |---|---|
   | `RESEND_API_KEY` | la clé Resend |
   | `MAIL_FROM` | `Planning <planning@votre-domaine.fr>` |
   | `APP_URL` | l'adresse du site |
   | `CRON_SECRET` | une longue suite de caractères au hasard |

5. Dans **Edge Functions > Deploy a new function > Via Editor**, nommez la fonction `recap-hebdo`, collez le contenu de `supabase/functions/recap-hebdo/index.ts` et déployez. Dans les réglages de la fonction, **désactivez « Enforce JWT verification »** : la fonction est protégée par `CRON_SECRET`.
6. Dans **SQL Editor**, collez `supabase/cron.sql`, remplacez `VOTRE-PROJET` et `LE-SECRET`, puis cliquez sur **Run**.

Pour tester sans attendre vendredi :

```
curl -X POST "https://VOTRE-PROJET.supabase.co/functions/v1/recap-hebdo?force=1" -H "x-cron-secret: LE-SECRET"
```

---

## Utilisation au quotidien

- **Ajouter une tâche** : clic dans la case d'une personne et d'un jour, bouton « Nouvelle tâche », ou touche `N`.
- **S'attribuer une tâche** : la glisser depuis « Tâches à prendre » sur sa ligne, ou cliquer sur « Prendre ».
- **Tâche commune** : cocher plusieurs personnes dans la fiche de la tâche.
- **Tâche répétitive** : « Répéter » à la création, avec une date de fin.
- **Dupliquer** : ouvrir la tâche, puis « Dupliquer ».
- **Liste de la semaine** : onglet du même nom, avec les tâches à cocher une fois faites.
- **Annuler** la dernière action : bouton dans le message qui s'affiche en bas.

## Écran mural

Le planning se met à jour tout seul : les modifications arrivent en direct, et la page relit tout en plus toutes les 2 minutes et après une coupure réseau. À minuit, la colonne « aujourd'hui » avance d'elle-même.

Pour un écran d'affichage, ajoutez `?ecran=1` à l'adresse : plein écran, gros caractères, heure affichée, lecture seule (rien ne se modifie en touchant l'écran), écran maintenu allumé, et le week-end l'écran montre déjà la semaine suivante.

| Adresse | Affiche |
|---|---|
| `…/planning-equipe/?ecran=1` | toute l'équipe |
| `…/planning-equipe/?ecran=1&qui=leo` | une seule personne (`leo`, `julien` ou `justine`) |
| `…/planning-equipe/?ecran=1&qui=leo&vue=liste` | une seule personne, en liste par jour |

Mise en place, une fois :

1. Sur l'appareil de l'écran, ouvrez l'adresse normale du planning et connectez-vous avec une adresse de l'équipe (ouvrez l'email de connexion sur ce même appareil). La connexion reste ensuite mémorisée.
2. Ouvrez l'adresse avec `?ecran=1` en plein écran (touche F11), ou réglez le navigateur pour l'ouvrir au démarrage en mode kiosque, par exemple `chromium --kiosk "https://…/planning-equipe/?ecran=1&qui=leo"`.
3. Désactivez la mise en veille de l'écran dans les réglages de l'appareil.

## Ajouter ou retirer une personne

1. Dans Supabase, table `team` : ajoutez ou supprimez la ligne (identifiant, prénom, email).
2. Dans `index.html`, liste `PEOPLE` : ajoutez ou retirez la personne, avec le même identifiant. Pour une nouvelle personne, ajoutez aussi ses couleurs `--p-<id>` et `--p-<id>-soft` dans les styles.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | le planning |
| `config.js` | adresse et clé publique Supabase |
| `supabase/schema.sql` | tables, sécurité, temps réel |
| `supabase/functions/recap-hebdo/index.ts` | email du vendredi |
| `supabase/cron.sql` | déclenchement chaque vendredi |
