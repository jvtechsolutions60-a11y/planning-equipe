// Planning de l'équipe : compréhension d'une phrase dictée, par exemple « Julien jeudi 8h30 10h30 Dunkerque ».
// Aucune donnée ne sort d'ici : la fonction lit le texte reconnu et renvoie la tâche comprise, ou ce qui manque.
(function (root) {
  const pad = n => String(n).padStart(2, "0");
  const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
  const strip = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

  const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
  // nombres dits en toutes lettres que la reconnaissance laisse parfois tels quels
  const NOMBRES = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14,
    quinze: 15, seize: 16, "dix-sept": 17, "dix-huit": 18, "dix-neuf": 19, vingt: 20, trente: 30, quarante: 40, cinquante: 50, premier: 1 };
  const KINDS = [[/\bformations?\b/, "formation"], [/\bconges?\b|\bvacances\b|\brtt\b/, "conge"], [/\babsences?\b|\babsente?s?\b|\bmaladie\b/, "absence"], [/\binterne\b|\bbureau\b|\batelier\b/, "interne"]];

  // people : [{ id, name }] ; now : date du jour (pour « demain », « jeudi »...)
  function parse(text, people, now) {
    now = now || new Date();
    const out = { people: [], date: null, debut: null, fin: null, dur: null, kind: null, title: "", missing: [], heard: String(text || "").trim() };
    // on travaille sur une copie en minuscules sans accents, en gardant la même longueur pour retrouver le texte d'origine
    const orig = " " + out.heard.replace(/\s+/g, " ") + " ";
    let low = strip(orig.toLowerCase());
    const used = new Array(low.length).fill(false);
    const take = (re, fn) => {
      re.lastIndex = 0; let m;
      const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
      while ((m = g.exec(low))) {
        if (used.slice(m.index, m.index + m[0].length).some(Boolean)) continue;
        if (fn(m) === false) continue;
        for (let i = m.index; i < m.index + m[0].length; i++) used[i] = true;
      }
    };
    // « huit heures trente » → « 8 heures 30 »
    low = low.replace(/\b(dix-sept|dix-huit|dix-neuf|vingt et une|vingt-et-une|vingt et un|vingt-deux|vingt-trois|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|premier)\b/g, w => {
      const v = /vingt.*(un|une)$/.test(w) ? 21 : w === "vingt-deux" ? 22 : w === "vingt-trois" ? 23 : NOMBRES[w];
      const s = String(v); return s.length <= w.length ? s.padEnd(w.length, " ") : w;
    });
    if (low.length !== orig.length) low = strip(orig.toLowerCase());

    // personnes
    if (/\b(tout le monde|toute l'equipe|toute l equipe|l'equipe entiere|tous les trois)\b/.test(low)) {
      take(/\b(tout le monde|toute l'equipe|toute l equipe|l'equipe entiere|tous les trois)\b/, () => { out.people = people.map(p => p.id); });
    }
    people.forEach(p => {
      const n = strip(p.name.toLowerCase());
      take(new RegExp("\\b" + n + "\\b"), () => { if (!out.people.includes(p.id)) out.people.push(p.id); });
    });

    // heures : 8h30, 8 h 30, 8:30, 8 heures 30, 14h, midi
    const T = "(\\d{1,2})\\s*(?:heures?|h(?![a-z])|:)\\s*(\\d{2})?(?!\\d)";
    const hm = (h, m) => { h = +h; m = m ? +m : 0; return h <= 23 && m <= 59 ? pad(h) + ":" + pad(m) : null; };
    low = low.replace(/\bmidi\b/g, "12h ").replace(/\bminuit\b/g, "0h    ");
    take(new RegExp("(?:\\bde\\s+|\\bentre\\s+)?" + T + "\\s*(?:a|-|–|jusqu'a|jusqu a|et)?\\s*" + T, "i"), m => {
      const a = hm(m[1], m[2]), b = hm(m[3], m[4]); if (!a || !b) return false; out.debut = a; out.fin = b;
    });
    // durée : « pendant 2 heures », « 1h30 », « 2 h », « toute la journée », « une demi-journée »
    take(/\b(toute la journee|la journee|journee entiere|une journee)\b/, () => { out.dur = 7; });
    take(/\b(une demi-journee|demi-journee|une demi journee|demi journee|la matinee|le matin|l'apres-midi|l apres-midi|l'apres midi|apres-midi)\b/, () => { out.dur = 3.5; });
    take(/\b(?:pendant|pour|duree)\s+(\d{1,2})(?:[.,](\d))?\s*(?:heures?|h(?![a-z]))\s*(\d{2})?/, m => { out.dur = +m[1] + (m[2] ? +m[2] / 10 : 0) + (m[3] ? +m[3] / 60 : 0); });
    take(/\b(?:pendant|pour)\s+(?:une|1)\s+(?:demi-heure|demi heure)\b/, () => { out.dur = 0.5; });
    take(/\b(?:pendant|pour)\s+(\d{2})\s*(?:min|minutes)\b/, m => { out.dur = +m[1] / 60; });
    if (!out.debut) take(new RegExp("(?:\\ba\\s+|\\bdes\\s+|\\bvers\\s+)?" + T, "i"), m => { const a = hm(m[1], m[2]); if (!a || out.debut) return false; out.debut = a; });
    if (out.debut && out.fin) {
      const [a, b] = [out.debut, out.fin].map(s => +s.slice(0, 2) * 60 + +s.slice(3));
      if (b <= a) { out.missing.push("une heure de fin après l'heure de début"); }
      else out.dur = (b - a) / 60;
    } else if (out.debut && out.dur) {
      const a = +out.debut.slice(0, 2) * 60 + +out.debut.slice(3), b = a + Math.round(out.dur * 60);
      if (b < 24 * 60) out.fin = pad(Math.floor(b / 60)) + ":" + pad(b % 60); else out.debut = null;
    } else if (out.debut) {
      const a = +out.debut.slice(0, 2) * 60 + +out.debut.slice(3), b = a + 60;
      out.dur = 1; out.durDevinee = true;
      if (b < 24 * 60) out.fin = pad(Math.floor(b / 60)) + ":" + pad(b % 60); else out.debut = null;
    }

    // jour
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    take(/\b(apres-demain|apres demain)\b/, () => { out.date = iso(addDays(today, 2)); });
    take(/\bdemain\b/, () => { out.date = iso(addDays(today, 1)); });
    take(/\baujourd'hui\b|\baujourd hui\b|\bce jour\b/, () => { out.date = iso(today); });
    // « le 19 novembre », « 19/11 », « le 3 »
    take(/\b(?:le\s+)?(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?\b/, m => {
      const d = +m[1], mo = +m[2] - 1; let y = m[3] ? +m[3] : today.getFullYear(); if (y < 100) y += 2000;
      const x = new Date(y, mo, d); if (x.getMonth() !== mo) return false;
      if (!m[3] && x < today) x.setFullYear(y + 1);
      out.date = iso(x);
    });
    take(new RegExp("\\b(?:(?:" + JOURS.join("|") + ")\\s+)?(?:le\\s+)?(\\d{1,2})(?:er)?\\s+(" + MOIS.join("|") + ")(?:\\s+(\\d{4}))?\\b"), m => {
      const d = +m[1], mo = MOIS.indexOf(m[2]); let y = m[3] ? +m[3] : today.getFullYear();
      const x = new Date(y, mo, d); if (x.getMonth() !== mo) return false;
      if (!m[3] && x < today) x.setFullYear(y + 1);
      out.date = iso(x);
    });
    take(new RegExp("\\b(" + JOURS.join("|") + ")(?:\\s+(prochain|de la semaine prochaine|en huit))?(?:\\s+(\\d{1,2})(?:er)?(?!\\s*(?:h|heures?|:)))?\\b"), m => {
      if (out.date) return; // date déjà dite (« jeudi 19 novembre ») : le jour de semaine est seulement lu
      const wd = JOURS.indexOf(m[1]);
      if (m[3]) {
        // « jeudi 19 » : le prochain 19 qui tombe un jeudi
        for (let k = 0; k < 400; k++) { const x = addDays(today, k); if (x.getDate() === +m[3] && x.getDay() === wd) { out.date = iso(x); return; } }
        return false;
      }
      let k = (wd - today.getDay() + 7) % 7;
      if (m[2] === "de la semaine prochaine" || m[2] === "en huit" || /\bsemaine prochaine\b/.test(low)) k = ((wd + 6) % 7) - ((today.getDay() + 6) % 7) + 7;
      out.date = iso(addDays(today, k));
    });
    take(/\bsemaine prochaine\b/, () => { if (!out.date) { const k = 7 - ((today.getDay() + 6) % 7); out.date = iso(addDays(today, k)); } });

    // type de tâche (le mot reste dans le titre)
    for (const [re, k] of KINDS) if (re.test(low)) { out.kind = k; break; }

    // titre : le reste de la phrase, sans les petits mots de liaison laissés en bord
    let rest = "";
    for (let i = 0; i < orig.length; i++) rest += used[i] ? " " : orig[i];
    const LINK = "(?:et|avec|pour|le|la|les|de|du|des|a|à|au|en|ce|cette|on|met|mets|mettre|ajoute|ajouter|planifie|planifier|prevoir|prévoir|il y a|y a|il faut|faut|,|\\.|-|–)";
    rest = rest.replace(/\s+/g, " ").trim();
    let prev;
    do { prev = rest; rest = rest.replace(new RegExp("^" + LINK + "(?:\\s+|$)", "i"), "").replace(new RegExp("(?:^|\\s+)" + LINK + "$", "i"), "").trim(); } while (rest !== prev);
    out.title = rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : "";

    if (!out.people.length) out.missing.push("pour qui");
    if (!out.date) out.missing.push("quel jour");
    else { const g = new Date(+out.date.slice(0, 4), +out.date.slice(5, 7) - 1, +out.date.slice(8)).getDay(); if (g === 0 || g === 6) out.missing.push("un jour de semaine (le planning ne montre pas le week-end)"); }
    if (!out.title) out.missing.push("quoi faire (par exemple le lieu ou le client)");
    if (!out.dur) { out.dur = out.kind === "conge" || out.kind === "absence" ? 7 : 1; out.durDevinee = true; }
    return out;
  }
  root.PlanningVoix = { parse };
  if (typeof module !== "undefined") module.exports = { parse };
})(typeof window !== "undefined" ? window : globalThis);
