// Ajoute au planning les tâches décrites dans les fichiers taches/*.json (utilisé par Claude pour les demandes vocales).
// Lancé par .github/workflows/ajouter-taches.yml à chaque envoi d'un fichier dans taches/.
// Secret GitHub nécessaire : SUPABASE_SECRET_KEY.
// Chaque fichier contient une liste de tâches, avec les mêmes noms que les colonnes de la table tasks :
//   [{ "title": "Intervention", "date": "2026-11-19", "people": ["julien"], "debut": "08:30", "dur": 2,
//      "client": "", "notes": "2 rue des Brasseries, 59140 Dunkerque" }]
// Une tâche déjà ajoutée n'est jamais ajoutée deux fois ni écrasée (identifiant tiré du nom du fichier).
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

const URL_BASE = "https://fjnhuytztxxpbdajvhbq.supabase.co/rest/v1/tasks";
const KEY = process.env.SUPABASE_SECRET_KEY;
const fichiers = readdirSync("taches").filter(f => f.endsWith(".json")).sort();
if (!fichiers.length) { console.log("Aucune tâche à ajouter."); process.exit(0); }
if (!KEY) { console.error("Secret SUPABASE_SECRET_KEY manquant (Settings > Secrets and variables > Actions)."); process.exit(1); }

const EQUIPE = ["leo", "julien", "justine"];
const CHAMPS = ["title", "client", "dur", "date", "people", "debut", "fin", "notes", "kind", "lieu", "prio", "echeance"];
const FACULTATIFS = ["debut", "fin", "notes", "kind", "lieu", "prio", "echeance"]; // retirés si la colonne n'existe pas encore en base

function verifier(t, ou) {
  if (!t.title || typeof t.title !== "string") throw new Error(ou + " : titre manquant");
  if (t.date != null && !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) throw new Error(ou + " : date au format AAAA-MM-JJ attendue");
  for (const h of ["debut", "fin"]) if (t[h] != null && !/^[0-2]\d:[0-5]\d$/.test(t[h])) throw new Error(ou + " : " + h + " au format HH:MM attendu");
  if (t.echeance != null && !/^\d{4}-\d{2}-\d{2}$/.test(t.echeance)) throw new Error(ou + " : échéance au format AAAA-MM-JJ attendue");
  if (t.prio != null && t.prio !== "haute") throw new Error(ou + " : prio vaut \"haute\" ou rien");
  for (const p of t.people || []) if (!EQUIPE.includes(p)) throw new Error(ou + " : personne inconnue « " + p + " »");
}

async function inserer(ligne) {
  const l = { ...ligne };
  for (;;) {
    const r = await fetch(URL_BASE + "?on_conflict=id", {
      method: "POST",
      headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify(l)
    });
    const txt = await r.text();
    if (r.ok) return JSON.parse(txt || "[]").length ? "ajoutée" : "déjà présente";
    const manque = FACULTATIFS.find(c => c in l && txt.includes("'" + c + "'"));
    if (manque) { console.log("  (colonne « " + manque + " » absente en base, ignorée)"); if (manque === "notes" && l.notes) l.client = [l.client, l.notes].filter(Boolean).join(" · "); delete l[manque]; continue; }
    throw new Error("Supabase a refusé (" + r.status + ") : " + txt);
  }
}

let erreurs = 0;
for (const f of fichiers) {
  let liste;
  try { liste = JSON.parse(readFileSync("taches/" + f, "utf8")); } catch (e) { console.error(f + " : JSON illisible : " + e.message); erreurs++; continue; }
  if (!Array.isArray(liste)) liste = [liste];
  for (const [i, t] of liste.entries()) {
    const ou = f + " #" + (i + 1);
    try {
      verifier(t, ou);
      const ligne = { id: "v" + createHash("sha1").update(f + "#" + i).digest("hex").slice(0, 10) };
      for (const c of CHAMPS) if (t[c] != null) ligne[c] = t[c];
      ligne.people ??= [];
      ligne.dur ??= 1;
      console.log(ou + " « " + t.title + " » " + (t.date || "à prendre") + " : " + await inserer(ligne));
    } catch (e) { console.error(e.message); erreurs++; }
  }
}
if (erreurs) process.exit(1);
