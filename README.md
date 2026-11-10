# Planning de l'équipe

Planning partagé de Léo, Julien et Justine : qui fait quoi chaque semaine, tâches à prendre, tâches communes, tâches répétitives, et récap par email chaque vendredi à 12 h.

- **Site** : une page web statique (`index.html`), hébergée gratuitement sur GitHub Pages.
- **Données et connexion** : Supabase (gratuit). Connexion par lien envoyé par email, sans mot de passe. Seules les adresses de l'équipe ont accès.
- **Emails** : envoyés depuis une boîte o2switch, déclenchés chaque vendredi par GitHub Actions.

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

## Étape 4 : récap du vendredi midi (vous)

GitHub envoie l'email chaque vendredi à 12 h (heure de Paris), depuis votre boîte Gmail (ou une boîte o2switch).

1. **Mot de passe d'application Gmail** : la validation en deux étapes doit être active sur le compte Google. Ouvrez https://myaccount.google.com/apppasswords, créez un mot de passe nommé « Planning » et copiez les 16 lettres.
2. **Clé secrète Supabase** : Supabase > Project Settings > API Keys > **Secret keys**, copiez la clé `sb_secret_…`.
3. **Secrets GitHub** : ouvrez **Settings > Secrets and variables > Actions > New repository secret** et créez :

   | Nom | Valeur |
   |---|---|
   | `SUPABASE_SECRET_KEY` | la clé `sb_secret_…` |
   | `SMTP_HOST` | `smtp.gmail.com` (ou le serveur sortant o2switch) |
   | `SMTP_USER` | l'adresse Gmail |
   | `SMTP_PASS` | le mot de passe d'application (sans espaces) |

Pour tester sans attendre vendredi : onglet **Actions > Récap du vendredi > Run workflow**, en indiquant votre adresse dans le champ pour n'envoyer qu'à vous.

Le code est dans `scripts/recap-hebdo.mjs` et `.github/workflows/recap-hebdo.yml`. Les fichiers `supabase/functions/recap-hebdo` et `supabase/cron.sql` sont une autre méthode (Resend), non utilisée.

---

## Utilisation au quotidien

- **Ajouter une tâche** : clic dans la case d'une personne et d'un jour, bouton « Nouvelle tâche », ou touche `N`.
- **S'attribuer une tâche** : la glisser depuis « Tâches à prendre » sur sa ligne, ou cliquer sur « Prendre ».
- **Tâche commune** : cocher plusieurs personnes dans la fiche de la tâche.
- **Tâche répétitive** : « Répéter » à la création, avec une date de fin.
- **Dupliquer** : ouvrir la tâche, puis « Dupliquer ».
- **Liste de la semaine** : onglet du même nom, avec les tâches à cocher une fois faites.
- **Annuler** la dernière action : bouton dans le message qui s'affiche en bas.

## Ajouter ou retirer une personne

1. Dans Supabase, table `team` : ajoutez ou supprimez la ligne (identifiant, prénom, email).
2. Dans `index.html`, liste `PEOPLE` : ajoutez ou retirez la personne, avec le même identifiant. Pour une nouvelle personne, ajoutez aussi ses couleurs `--p-<id>` et `--p-<id>-soft` dans les styles.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | le planning |
| `config.js` | adresse et clé publique Supabase |
| `supabase/schema.sql` | tables, sécurité, temps réel |
| `scripts/recap-hebdo.mjs` | email du vendredi |
| `.github/workflows/recap-hebdo.yml` | déclenchement chaque vendredi à 12 h |
| `.github/workflows/garder-supabase-actif.yml` | évite la mise en pause de Supabase |
