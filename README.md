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

## Étape 4 : récap du vendredi midi (désactivé depuis le 10/11/2026, remplacé par l'écran mural)

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

- **Ajouter une tâche** : clic dans la case d'une personne et d'un jour, bouton « Nouvelle tâche », ou ou le bouton « + Ajouter » de chaque case.
- **S'attribuer une tâche** : la glisser depuis « Tâches à prendre » sur sa ligne, ou cliquer sur « Prendre ».
- **Tâche commune** : cocher plusieurs personnes dans la fiche de la tâche.
- **Tâche répétitive** : « Répéter » à la création, avec une date de fin.
- **Dupliquer** : ouvrir la tâche, puis « Dupliquer ».
- **Liste de la semaine** : onglet du même nom, avec les tâches à cocher une fois faites.
- **Aujourd'hui** : onglet qui montre, pour chacun, la tâche en cours (ou la première à faire), la suivante, toute la journée à cocher et les échéances des 3 prochains jours. Sa propre carte est en premier.
- **Prioritaire et échéance** : dans la fiche d'une tâche, « Prioritaire » la place en tête de sa journée (badge rouge) et « À rendre pour le » ajoute une échéance, qui passe en orange 3 jours avant et en rouge une fois dépassée (rappelée aussi dans « Points de vigilance »). Ces deux champs apparaissent une fois `supabase/priorites.sql` passé dans Supabase (SQL Editor > New query > coller > Run).
- **Jauge de charge** : sous chaque journée, les heures prévues sur les heures disponibles, avec une barre verte (moins de 85 %), orange (85 à 100 %) ou rouge (dépassé). Un congé ou une absence retire ses heures de la journée : une absence d'une demi-journée laisse 3 h 30 à planifier.
- **Plan de charge** : onglet qui montre 4 semaines d'un coup (à partir de la semaine affichée), par personne, avec un carré coloré par jour. Un clic sur une semaine l'ouvre dans le planning. Sur l'écran mural : `?ecran=1&vue=charge`.
- **Jours d'école de Léo** : une tâche « École (CFA PROMEO) » de type formation par jour au centre (calendrier BTS session 2028, année 2026-2027), ajoutée par le fichier `taches/2026-11-14-ecole-leo-2026-2027.json`. Pour la 2e année, il suffira d'un fichier du même genre.
- **Annuler** la dernière action : bouton dans le message qui s'affiche en bas.

## Écran mural

Le planning se met à jour tout seul : les modifications arrivent en direct, et la page relit tout en plus toutes les 2 minutes et après une coupure réseau. À minuit, la colonne « aujourd'hui » avance d'elle-même.

Le plus simple : bouton **Mode écran** en haut du planning, cochez les plannings à afficher (une, deux ou trois personnes), choisissez planning ou liste, puis **Afficher sur l'écran**. La touche Échap ramène au planning normal. La fenêtre donne aussi l'adresse à mettre au démarrage de l'écran.

On peut aussi taper l'adresse directement : ajoutez `?ecran=1` à l'adresse : plein écran, gros caractères, heure affichée, lecture seule (rien ne se modifie en touchant l'écran), écran maintenu allumé, et le week-end l'écran montre déjà la semaine suivante.

| Adresse | Affiche |
|---|---|
| `…/planning-equipe/?ecran=1` | toute l'équipe |
| `…/planning-equipe/?ecran=1&qui=leo` | une seule personne (`leo`, `julien` ou `justine`) |
| `…/planning-equipe/?ecran=1&qui=leo,julien` | plusieurs personnes |
| `…/planning-equipe/?ecran=1&qui=leo&vue=liste` | une seule personne, en liste par jour |
| `…/planning-equipe/?ecran=1&qui=leo&vue=jour` | vue « Aujourd'hui » en grand : tâche en cours, la suivante, puis la journée |

Mise en place, une fois :

1. Sur l'appareil de l'écran, ouvrez l'adresse normale du planning et connectez-vous avec une adresse de l'équipe (ouvrez l'email de connexion sur ce même appareil). La connexion reste ensuite mémorisée.
2. Ouvrez l'adresse avec `?ecran=1` en plein écran (touche F11), ou réglez le navigateur pour l'ouvrir au démarrage en mode kiosque, par exemple `chromium --kiosk "https://…/planning-equipe/?ecran=1&qui=leo"`.
3. Désactivez la mise en veille de l'écran dans les réglages de l'appareil.

## Planning à la voix sur l'écran mural

Ajoutez `&voix=1` à l'adresse de l'écran (ou cochez « Ajout de tâches à la voix » dans la fenêtre **Mode écran**), par exemple `…/planning-equipe/?ecran=1&voix=1`. Un petit encadré « 🎤 Planning à la voix » apparaît en bas à droite. Un seul bouton sert à tout : barre d'espace, Entrée, ou bouton « suivant » d'une télécommande de présentation. Touche « précédent » (ou flèche gauche, Retour arrière) pour annuler.

**Ajouter une tâche**

1. On appuie sur le bouton.
2. On dit la tâche, par exemple « Julien jeudi 8 h 30 10 h 30 Dunkerque », « Léo et Justine demain de 14 h à 16 h installation chez Foyette », « tout le monde lundi de 9 h à midi réunion », « Justine le 19 novembre toute la journée formation », « Léo vendredi à 9 h pendant 2 heures maintenance Calais ».
3. L'écran affiche ce qu'il a compris (qui, jour, heure, tâche) et prévient s'il y a un chevauchement ou un dépassement d'horaires.
4. On appuie de nouveau pour enregistrer. Sans rien faire, la proposition s'efface au bout de 20 secondes et rien n'est enregistré.

Ce qui est compris : les prénoms (et « tout le monde »), aujourd'hui, demain, après-demain, un jour de la semaine (« jeudi », « jeudi 19 », « mardi semaine prochaine »), une date (« le 19 novembre », « 3/12 »), un créneau (« 8 h 30 10 h 30 », « de 14 h à 16 h », « à 9 h pendant 2 heures », « midi »), « toute la journée », « demi-journée ». Le reste de la phrase devient le nom de la tâche. Les mots formation, congé, absence ou atelier donnent le type de tâche. La phrase dite est gardée dans les notes de la tâche.

**Demander son programme** : « Qu'est-ce que je fais aujourd'hui ? » (ou « qu'est-ce que Léo fait demain ? »). L'écran affiche les tâches et les lit à voix haute (haut-parleurs ou son de l'écran). Sans prénom, ce sont les plannings affichés sur l'écran.

**Terminer une tâche** : « J'ai fini Dunkerque » (ou « Léo a terminé l'inventaire »). L'écran retrouve la tâche du jour par son nom et propose de la marquer faite ; un second appui valide.

Matériel et réglages :

- **Google Chrome** sur un mini PC Windows ou Linux. La reconnaissance vocale ne fonctionne pas dans Chromium (Raspberry Pi) ni dans Firefox.
- Un micro USB ou une webcam avec micro, des haut-parleurs (ou le son de l'écran) pour la lecture à voix haute, et, si l'écran n'a pas de clavier, une télécommande de présentation sans fil (elle envoie les touches Page suiv. et Page préc.). Évitez le bouton « diaporama » de la télécommande : il envoie Échap, qui quitte le mode écran.
- Au premier appui, Chrome demande l'autorisation d'utiliser le micro : cliquez sur « Autoriser », c'est mémorisé. En mode kiosque, où la question ne peut pas s'afficher, ouvrez d'abord une fois la page sans `--kiosk` pour donner l'autorisation.
- Confidentialité : le micro n'écoute que pendant les quelques secondes qui suivent l'appui. La phrase est transcrite par le service de reconnaissance vocale de Chrome (serveurs de Google), puis comprise et enregistrée par le planning. La lecture à voix haute se fait sur l'ordinateur. Aucun abonnement ni clé n'est nécessaire.

## Fiabilité des données

- **Où sont les données** : dans la base Supabase (PostgreSQL), pas dans le navigateur. Vider le navigateur ou changer d'ordinateur ne perd rien. Seules les adresses de la table `team` y ont accès.
- **Coupure de connexion** : les modifications restent à l'écran et dans le navigateur (« N modifications en attente d'envoi ») et partent seules au retour du réseau, même après avoir fermé la page.
- **Modifications simultanées** : seuls les champs modifiés sont envoyés. Si un collègue a changé la même tâche entre-temps, ses changements sont gardés et un message indique les champs où votre version l'a emporté.
- **Historique** : une fois `supabase/fiabilite.sql` passé dans Supabase (SQL Editor > Run), la fiche de chaque tâche montre qui a modifié quoi et quand.
- **Sauvegarde manuelle** : bouton « Télécharger une sauvegarde » en bas du planning (fichier JSON : tâches, clients et modèles ; ni l'historique ni la liste de l'équipe) et « Restaurer depuis un fichier ». Le fichier contient les adresses, téléphones et notes des clients en clair : à garder sur un ordinateur protégé.
- **Sauvegarde de nuit** (facultative) : créez les secrets GitHub `SUPABASE_SECRET_KEY` et `BACKUP_PASSWORD` ; chaque nuit, une copie chiffrée des tâches, clients, modèles et de l'historique (fichier .7z protégé par ce mot de passe) est gardée 90 jours dans l'onglet **Actions > Sauvegarde de nuit**. Pour restaurer : ouvrir le .7z avec 7-Zip et le mot de passe, puis « Restaurer depuis un fichier ».
- Le client Supabase est copié dans le dépôt (`vendor/`) : le planning ne dépend plus d'un serveur tiers au chargement.

## Sécurité

- **Restauration** : le fichier est vérifié en entier avant toute modification (format, identifiants, personnes, types, statuts, dates, heures, durées, doublons, 5 Mo et 5 000 tâches au plus). Une seule ligne douteuse et rien n'est appliqué.
- **Affichage** : toute tâche (base, direct, fichier, copie locale) est nettoyée avant affichage ; textes et identifiants sont échappés.
- **Politique de sécurité du contenu** (balise `meta` dans `index.html`) : seuls les scripts du site s'exécutent (le code est dans `app.js`, aucun script en ligne), connexions limitées à Supabase. GitHub Pages ne permet pas d'ajouter des en-têtes HTTP : `frame-ancestors` et les autres protections par en-tête demanderaient un autre hébergeur.
- **Contrôles en base** : une fois `supabase/securite.sql` passé (SQL Editor > Run), la base refuse aussi les identifiants douteux, les durées hors 15 min à 70 h et les heures impossibles.
- **Copie locale** : si le navigateur refuse de garder les modifications en attente (stockage plein ou désactivé), le planning l'affiche et demande de ne pas fermer la page.
- La clé dans `config.js` est la clé publique de Supabase : la sécurité repose sur les règles de la base (`is_team()`). Ne jamais y mettre la clé secrète.

## Horaires et contrôles RH

Chaque tâche peut avoir une heure de début et de fin (facultatives). Pour les activer, une seule fois : Supabase > **SQL Editor** > collez `supabase/horaires.sql` > **Run**, puis rechargez le planning.

Le panneau « Points de vigilance » et les cases signalent :

| Contrôle | Seuil (adulte) | Seuil (mineur) |
|---|---|---|
| Travail dans la journée | 10 h | 8 h |
| Chevauchement de deux créneaux | dès 1 minute | dès 1 minute |
| Repos entre deux journées | 11 h | 12 h |
| Amplitude (début → fin de journée) | 13 h | 12 h |
| Pause | 20 min après 6 h d'affilée | 30 min après 4 h 30 |
| Semaine | 48 h | 35 h |
| Heures au-delà du contrat | signalées (supplémentaires ou complémentaires) | idem |

Les seuils viennent du Code du travail et sont à vérifier avec votre convention collective. On les change dans `index.html`, objet `LIMITS`. La base de chaque personne (35 h, ou moins pour un temps partiel) et l'indication « mineur » se règlent dans la liste `PEOPLE`.

## Interventions, clients et modèles

À activer une seule fois : Supabase > **SQL Editor** > collez `supabase/interventions.sql` > **Run**, puis rechargez le planning. Les tâches existantes sont reprises telles quelles (celles avec un client deviennent des interventions client, les autres des tâches internes, et une fiche client est créée pour chaque nom déjà saisi). Tant que ce fichier n'est pas passé, le planning fonctionne comme avant.

- **Type** : intervention client, tâche interne, formation, absence ou congé. Une absence ou un congé posé sur une journée est signalé si du travail y est aussi prévu.
- **Statut** : planifiée, en cours, terminée, reportée, en attente, à revoir, annulée. « Terminée » coche la tâche comme avant.
- **Fiche client** : en tapant le nom, le planning propose les clients connus et remplit l'adresse et le téléphone. Sous le champ : lien d'itinéraire Google Maps et les 5 dernières interventions chez ce client.
- **Plusieurs jours** : champ « Jusqu'au » ; l'intervention apparaît chaque jour (jour 1/3, 2/3…), week-end sauté.
- **Reporter** : bouton dans la fiche ; on choisit le nouveau jour, la tâche garde la trace « reportée du … ».
- **Notes** et case **À distance** pour les interventions sans déplacement.
- **Modèles** : « Enregistrer comme modèle » dans une fiche ; le modèle est ensuite proposé en haut des nouvelles tâches.
- **Jours travaillés** : dans `PEOPLE`, `jours: [1, 1, 1, 1, 1]` du lundi au vendredi (1 = journée, 0.5 = demi-journée, 0 = non travaillé, par exemple un jour d'école pour un apprenti). Le planning grise ces jours et signale le travail prévu dessus.

## Clavier

- **Tab** amène dans le planning (une seule tabulation pour tout le tableau), puis les **flèches** vont de case en case ; **Origine** / **Fin** : début ou fin de ligne ; **Page préc.** / **Page suiv.** : semaine précédente ou suivante.
- **Entrée** entre dans une case : flèches haut et bas d'une tâche à l'autre, **Entrée** ouvre la tâche, **Échap** revient à la case.
- **Espace** sur une tâche la saisit : les flèches choisissent la personne et le jour (flèche bas après la dernière personne = tâches à prendre), **Entrée** pose, **Échap** annule.
- Chaque action est annoncée aux lecteurs d'écran, avec les nouvelles anomalies éventuelles.

## Accessibilité

La page suit le RGAA 4.1 (niveau AA) : contrastes vérifiés en thème clair et sombre, tout est utilisable au clavier (Entrée ou Espace sur une tâche pour l'ouvrir, et dans la fiche on choisit la personne et le jour sans glisser-déposer), fenêtres annoncées comme dialogues avec le focus gardé dedans, erreurs liées aux champs, planning lu comme un tableau par les lecteurs d'écran, zoom à 200 % sans défilement horizontal, pas de raccourci à une seule lettre. Vérifié avec axe-core. Le mode « contraste élevé » du système (`prefers-contrast`) renforce bordures et textes secondaires.

## Ajouter ou retirer une personne

1. Dans Supabase, table `team` : ajoutez ou supprimez la ligne (identifiant, prénom, email).
2. Dans `index.html`, liste `PEOPLE` : ajoutez ou retirez la personne, avec le même identifiant. Pour une nouvelle personne, ajoutez aussi ses couleurs `--p-<id>` et `--p-<id>-soft` dans les styles.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | le planning (structure et styles) |
| `app.js` | le code du planning |
| `voix.js` | compréhension des phrases dites sur l'écran mural |
| `config.js` | adresse et clé publique Supabase |
| `supabase/schema.sql` | tables, sécurité, temps réel |
| `scripts/recap-hebdo.mjs` | email du vendredi |
| `.github/workflows/recap-hebdo.yml` | déclenchement chaque vendredi à 12 h |
| `.github/workflows/garder-supabase-actif.yml` | évite la mise en pause de Supabase |
| `.github/workflows/sauvegarde-nuit.yml` | sauvegarde chiffrée chaque nuit |
| `supabase/horaires.sql` | ajoute les heures de début et de fin |
| `supabase/fiabilite.sql` | ajoute l'historique des modifications |
| `supabase/interventions.sql` | ajoute types, statuts, clients, modèles et interventions sur plusieurs jours |
| `supabase/securite.sql` | contrôles de format et de bornes sur les tâches |
| `vendor/supabase-js-2.117.3.js` | client Supabase |

## Ajouter des tâches en vocal (par Claude)

Dictez la tâche à Claude dans le projet : il dépose un fichier dans `taches/` et l'action **Ajouter des tâches** l'écrit dans le planning. Il faut une seule fois le secret GitHub `SUPABASE_SECRET_KEY` (Settings > Secrets and variables > Actions), le même que pour la sauvegarde de nuit.
