// Planning de l'équipe : application (chargée par index.html après le client Supabase et config.js).
(function () {
  // base : heures par semaine prévues au contrat (35 = temps plein). mineur : true pour un salarié ou apprenti de moins de 18 ans (seuils plus stricts).
  // jours : du lundi au vendredi, 1 = journée travaillée, 0.5 = demi-journée, 0 = non travaillé.
  const PEOPLE = [
    { id: "leo", name: "Léo", color: "var(--p-leo)", soft: "var(--p-leo-soft)", base: 35, mineur: false, jours: [1, 1, 1, 1, 1] },
    { id: "julien", name: "Julien", color: "var(--p-julien)", soft: "var(--p-julien-soft)", base: 35, mineur: false, jours: [1, 1, 1, 1, 1] },
    { id: "justine", name: "Justine", color: "var(--p-justine)", soft: "var(--p-justine-soft)", base: 35, mineur: false, jours: [1, 1, 1, 1, 1] }
  ];
  const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
  const KEY = "planning-equipe-v5";

  const pad = n => String(n).padStart(2, "0");
  const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const mondayOf = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); };
  const fmtShort = d => pad(d.getDate()) + "/" + pad(d.getMonth() + 1);
  const durLabel = n => { const h = Math.floor(n), m = Math.round((n - h) * 60); return h + " h" + (m ? " " + pad(m) : ""); };
  const DAY_H = 7, WEEK_H = 35;
  const REP_LABEL = { day: "chaque jour", week: "chaque semaine", "2week": "toutes les 2 sem.", month: "chaque mois" };
  // dates d'une série, jours ouvrés uniquement (un samedi ou un dimanche passe au lundi) ;
  // au-delà de MAX_OCC occurrences, la liste renvoyée en contient une de plus pour signaler le dépassement
  const MAX_OCC = 260;
  function seriesDates(start, rep, until) {
    const out = [], end = parse(until), first = parse(start);
    let k = 1;
    while (out.length <= MAX_OCC) {
      let d;
      if (rep === "day") { d = addDays(first, k); if (d.getDay() === 0 || d.getDay() === 6) { k++; continue; } }
      else if (rep === "week") d = addDays(first, 7 * k);
      else if (rep === "2week") d = addDays(first, 14 * k);
      else {
        // le 31 devient le dernier jour des mois plus courts (30, 29 ou 28), sans glisser au mois suivant
        const last = new Date(first.getFullYear(), first.getMonth() + k + 1, 0).getDate();
        d = new Date(first.getFullYear(), first.getMonth() + k, Math.min(first.getDate(), last));
        if (d.getDay() === 6) d = addDays(d, 2); if (d.getDay() === 0) d = addDays(d, 1);
      }
      if (d > end) break;
      out.push(iso(d)); k++;
    }
    return out;
  }
  const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const isoWeek = d => { const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const n = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - n); const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); return Math.ceil(((x - y0) / 86400000 + 1) / 7); };
  const uid = () => Math.random().toString(36).slice(2, 9);
  const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/, ISO_DATE = /^\d{4}-\d{2}-\d{2}$/, HHMM = /^([01]\d|2[0-3]):[0-5]\d$/, MAX_DUR = 70;
  // recherche d'une carte par identifiant sans construire de sélecteur avec la donnée
  const taskEl = (id, from) => [...document.querySelectorAll(".task")].find(el => el.dataset.id === id && el.dataset.from === (from || ""));
  const person = id => PEOPLE.find(p => p.id === id);

  // ---- données partagées (Supabase) ----
  const CFG = window.PLANNING_CONFIG || {};
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(CFG.supabaseUrl || "") || /VOTRE/.test(CFG.supabaseAnonKey || "VOTRE")) {
    document.getElementById("gate").hidden = false;
    document.getElementById("login").hidden = true;
    document.getElementById("login-btn").hidden = true;
    document.getElementById("gate-msg").textContent = "Le planning n'est pas encore relié à sa base de données : renseignez l'adresse et la clé Supabase dans config.js.";
    return;
  }
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
  // les colonnes debut et fin n'existent qu'une fois supabase/horaires.sql passé : on ne les envoie qu'à ce moment-là
  let HAS_TIMES = false, HAS_HISTORY = false, HAS_LOT2 = false;
  const LOT2 = ["kind", "status", "notes", "lieu", "client_id", "fin_date", "reporte_de"];
  const KINDS = { client: "Intervention client", interne: "Tâche interne", formation: "Formation", absence: "Absence", conge: "Congé" };
  const KIND_SHORT = { client: "", interne: "Interne", formation: "Formation", absence: "Absence", conge: "Congé" };
  const STATUS = { planifiee: "Planifiée", en_cours: "En cours", terminee: "Terminée", reportee: "Reportée", attente: "En attente (matériel ou client)", a_revoir: "À revoir (nouvelle visite)", annulee: "Annulée" };
  const STATUS_SHORT = { en_cours: "En cours", reportee: "Reportée", attente: "En attente", a_revoir: "À revoir", annulee: "Annulée" };
  const isOff = t => t.kind === "absence" || t.kind === "conge";
  const isDone = t => t.status === "terminee" || t.done;
  const counts = t => !isOff(t) && t.status !== "annulee";       // compte dans les heures de travail
  const weekday = di => { const d = parse(di).getDay(); return d > 0 && d < 6; };
  // une intervention sur plusieurs jours apparaît chaque jour ouvré entre date et fin_date
  // tâche datée d'un samedi ou d'un dimanche (import, ancienne saisie) : invisible dans la semaine, donc rangée dans « à prendre »
  const offWeek = t => !!t.date && !weekday(t.date) && !(t.fin_date && t.fin_date > t.date);
  const inBacklog = t => !t.people.length || !t.date || offWeek(t);
  const occursOn = (t, di) => !!t.date && (t.date === di || (!!t.fin_date && t.fin_date > t.date && di > t.date && di <= t.fin_date && weekday(di)));
  function dayRank(t, di) {
    if (!t.fin_date || t.fin_date <= t.date) return null;
    let n = 0, k = 0;
    for (let d = parse(t.date); iso(d) <= t.fin_date; d = addDays(d, 1)) { const x = iso(d); if (x === t.date || weekday(x)) { n++; if (x === di) k = n; } }
    return n > 1 ? k + "/" + n : null;
  }
  let clients = [], modeles = [];
  const findClient = name => { const n = String(name || "").trim().toLowerCase(); return n ? clients.find(c => c.nom.toLowerCase() === n) : null; };
  const EMAIL_NAME = {};
  const fields = () => ["id", "title", "client", "dur", "date", "people", "done", "series", "rep"].concat(HAS_TIMES ? ["debut", "fin"] : [], HAS_LOT2 ? LOT2 : []);
  // toute tâche (base, direct, import, copie locale) passe par norm() : seules des valeurs connues arrivent à l'affichage
  const own = (o, k) => typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k);
  const okDate = v => typeof v === "string" && ISO_DATE.test(v) && iso(parse(v)) === v ? v : null;
  const okTime = v => typeof v === "string" && HHMM.test(v) ? v : null;
  const okText = v => typeof v === "string" ? v : (v == null ? "" : String(v));
  const norm = r => ({ id: String(r.id), title: okText(r.title), client: okText(r.client), dur: Math.min(MAX_DUR, Math.max(0.25, Number(r.dur) || 1)), date: okDate(r.date),
    people: Array.isArray(r.people) ? [...new Set(r.people.filter(x => person(x)))] : [], done: !!r.done, series: r.series ? String(r.series) : null, rep: own(REP_LABEL, r.rep) ? r.rep : null,
    debut: okTime(r.debut), fin: okTime(r.fin), updated_at: r.updated_at || null,
    kind: own(KINDS, r.kind) ? r.kind : (r.client ? "client" : "interne"), status: own(STATUS, r.status) ? r.status : (r.done ? "terminee" : "planifiee"), notes: okText(r.notes),
    lieu: r.lieu === "distance" ? "distance" : "site", client_id: r.client_id ? String(r.client_id) : null, fin_date: okDate(r.fin_date), reporte_de: okDate(r.reporte_de) });
  const row = t => { const o = {}; fields().forEach(f => { o[f] = f in t ? t[f] : null; }); o.client = o.client || ""; o.done = !!o.done; o.people = o.people || []; return o; };

  // ---- horaires et règles RH ----
  const toMin = s => { const m = /^(\d{1,2}):(\d{2})/.exec(s || ""); return m ? +m[1] * 60 + +m[2] : null; };
  const hasTime = t => toMin(t.debut) !== null && toMin(t.fin) !== null && toMin(t.fin) > toMin(t.debut);
  const workMin = t => hasTime(t) ? toMin(t.fin) - toMin(t.debut) : Math.round(t.dur * 60);
  const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const dayLabel = di => { const d = parse(di); return JOURS[d.getDay()] + " " + fmtShort(d); };
  // seuils par défaut du Code du travail (à adapter à la convention collective) ; mineurs : règles des jeunes travailleurs
  const LIMITS = {
    adulte: { jour: 10 * 60, sem: 48 * 60, repos: 11 * 60, amp: 13 * 60, pauseApres: 6 * 60, pause: 20 },
    mineur: { jour: 8 * 60, sem: 35 * 60, repos: 12 * 60, amp: 12 * 60, pauseApres: 4 * 60 + 30, pause: 30 }
  };
  // renvoie la liste des anomalies de la semaine : { niv: "fort" | "info", pid, date, court, long }
  function verifier(weekDays) {
    const out = [], before = iso(addDays(parse(weekDays[0]), -1));
    PEOPLE.forEach(p => {
      const L = p.mineur ? LIMITS.mineur : LIMITS.adulte;
      const all = d => state.tasks.filter(t => occursOn(t, d) && t.people.includes(p.id) && t.status !== "annulee");
      const of = d => all(d).filter(t => !isOff(t));
      const timed = d => of(d).filter(hasTime).map(t => ({ t, a: toMin(t.debut), b: toMin(t.fin) })).sort((x, y) => x.a - y.a);
      const add = (niv, date, court, long) => out.push({ niv, pid: p.id, date, court, long: p.name + (date ? ", " + dayLabel(date) : "") + " : " + long });
      let week = 0, daysWorked = 0;
      weekDays.forEach((d, i) => {
        const mins = of(d).reduce((s, t) => s + workMin(t), 0);
        week += mins; if (mins) daysWorked++;
        const offs = all(d).filter(isOff), wd = (parse(d).getDay() + 6) % 7, share = wd < 5 && p.jours ? p.jours[wd] : 1;
        if (offs.length && mins) add("fort", d, "Pendant : " + KIND_SHORT[offs[0].kind].toLowerCase(), "travail prévu pendant « " + offs[0].title + " » (" + KIND_SHORT[offs[0].kind].toLowerCase() + ").");
        if (mins && share === 0) add("fort", d, "Jour non travaillé", "travail prévu un jour non travaillé.");
        else if (mins > share * DAY_H * 60 && share < 1) add("info", d, "Demi-journée", durLabel(mins / 60) + " prévues sur une demi-journée de travail.");
        if (mins > L.jour) add("fort", d, "Plus de " + L.jour / 60 + " h de travail", durLabel(mins / 60) + " de travail, au-delà du maximum de " + L.jour / 60 + " h par jour.");
        const tm = timed(d);
        for (let k = 1; k < tm.length; k++) for (let j = 0; j < k; j++) if (tm[k].a < tm[j].b)
          add("fort", d, "Chevauchement", "« " + tm[j].t.title + " » (" + tm[j].t.debut + "–" + tm[j].t.fin + ") et « " + tm[k].t.title + " » (" + tm[k].t.debut + "–" + tm[k].t.fin + ") se chevauchent.");
        if (tm.length) {
          const amp = Math.max(...tm.map(x => x.b)) - tm[0].a;
          if (amp > L.amp) add("fort", d, "Amplitude de " + durLabel(amp / 60), "amplitude de " + durLabel(amp / 60) + " entre le début et la fin de la journée, au-delà de " + L.amp / 60 + " h.");
          // séquences de travail : deux créneaux séparés de moins que la pause comptent comme une seule séquence
          let s0 = tm[0].a, e0 = tm[0].b;
          tm.slice(1).concat([{ a: 1e9, b: 1e9 }]).forEach(x => {
            if (x.a - e0 < L.pause) { e0 = Math.max(e0, x.b); return; }
            if (e0 - s0 > L.pauseApres) add("info", d, "Pause à prévoir", durLabel((e0 - s0) / 60) + " de travail d'affilée sans pause de " + L.pause + " min.");
            s0 = x.a; e0 = x.b;
          });
        }
        const prev = timed(i === 0 ? before : weekDays[i - 1]);
        if (prev.length && tm.length) {
          const rest = 24 * 60 - Math.max(...prev.map(x => x.b)) + tm[0].a;
          if (rest < L.repos) add("fort", d, "Repos de " + durLabel(rest / 60), "seulement " + durLabel(rest / 60) + " de repos depuis la veille, minimum " + L.repos / 60 + " h.");
        }
      });
      if (week > L.sem) add("fort", null, "", durLabel(week / 60) + " sur la semaine, au-delà du maximum de " + L.sem / 60 + " h.");
      else if (week > p.base * 60) add("info", null, "", durLabel((week - p.base * 60) / 60) + (p.base >= 35 ? " d'heures supplémentaires" : " d'heures complémentaires") + " prévues (base " + p.base + " h).");
      if (daysWorked === 7) add("fort", null, "", "aucun jour de repos dans la semaine.");
    });
    return out;
  }
  let synced = new Map(), lastOk = 0;
  const hhmm = d => pad(d.getHours()) + ":" + pad(d.getMinutes());
  let state = { tasks: [], me: null };

  function setSync(txt, bad) { $("sync").textContent = txt; $("sync").classList.toggle("bad", !!bad); $("sync").classList.remove("wait"); }

  // ---- synchronisation fiable ----
  // « synced » = dernière version connue de la base pour chaque tâche. Les modifications locales sont la différence entre
  // l'écran et cette version : elles survivent à une coupure réseau (copie dans le navigateur) et sont renvoyées ensuite.
  const QKEY = KEY + "-attente";
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function localDiff() {
    const out = [], ids = new Set();
    state.tasks.forEach(t => {
      ids.add(t.id);
      const r = row(t), base = synced.get(t.id);
      if (!base) { out.push({ kind: "new", id: t.id, row: r, title: t.title }); return; }
      const b = JSON.parse(base), fields = {};
      Object.keys(r).forEach(k => { if (!same(r[k], b[k])) fields[k] = r[k]; });
      if (Object.keys(fields).length) out.push({ kind: "upd", id: t.id, fields, base: b, at: t.updated_at, title: t.title });
    });
    synced.forEach((v, id) => { if (!ids.has(id)) out.push({ kind: "del", id, title: JSON.parse(v).title }); });
    return out;
  }
  // localDurable = false : la copie dans le navigateur a échoué (stockage plein, désactivé ou navigation privée)
  let localDurable = true, localWarned = false;
  function persist() {
    const n = localDiff().length;
    try { if (n) localStorage.setItem(QKEY, JSON.stringify({ tasks: state.tasks, synced: [...synced] })); else localStorage.removeItem(QKEY); localDurable = true; localWarned = false; }
    catch (_) {
      localDurable = !n;
      if (n && !localWarned) { localWarned = true; announce("Attention : ce navigateur ne peut pas garder vos modifications en attente. Ne fermez pas la page avant leur envoi."); }
    }
    return n;
  }
  function showPending(n) {
    $("sync").textContent = n + " modification" + (n > 1 ? "s" : "") + " en attente d'envoi" + (localDurable
      ? " : elles partiront au retour de la connexion."
      : ", gardées seulement tant que cette page reste ouverte (le navigateur refuse d'en garder une copie). Ne fermez pas la page.");
    $("sync").classList.add("bad", "wait");
  }
  const isNetwork = err => !navigator.onLine || /fetch|network|timeout|load failed/i.test((err && (err.message || err.details)) || "");

  // lecture par pages de 1 000 (limite par défaut de Supabase) jusqu'à la dernière, triées par identifiant
  async function selectAll(table) {
    const rows = [], size = 1000;
    for (let from = 0; ; from += size) {
      const { data, error } = await sb.from(table).select("*").order("id").range(from, from + size - 1);
      if (error) return { data: null, error };
      rows.push(...data);
      // une ligne ajoutée pendant la lecture peut décaler les pages : on dédoublonne par identifiant
      if (data.length < size) return { data: [...new Map(rows.map(r => [r.id, r])).values()], error: null };
    }
  }
  async function fetchTasks() {
    const { data, error } = await selectAll("tasks");
    if (error) { const n = persist(); if (n) showPending(n); else setSync(lastOk ? "Pas de connexion depuis " + hhmm(new Date(lastOk)) : "Erreur de chargement", true); return; }
    lastOk = Date.now();
    // on repart de la base, puis on réapplique par-dessus les modifications locales pas encore envoyées
    const mine = localDiff();
    synced = new Map(data.map(r => [r.id, JSON.stringify(row(norm(r)))]));
    state.tasks = data.map(norm);
    const clashes = [], lost = [];
    mine.forEach(c => {
      if (c.kind === "new") { if (!synced.has(c.id)) state.tasks.push(Object.assign(norm(c.row), { updated_at: null })); return; }
      if (c.kind === "del") { state.tasks = state.tasks.filter(t => t.id !== c.id); return; }
      const t = state.tasks.find(x => x.id === c.id);
      if (!t) { lost.push(c.title); return; }
      const now = row(t);
      const over = Object.keys(c.fields).filter(k => !same(now[k], c.base[k]) && !same(now[k], c.fields[k]));
      Object.assign(t, c.fields);
      if (over.length) clashes.push("« " + c.title + " » (" + over.map(k => FIELD_LABEL[k] || k).join(", ") + ")");
    });
    render();
    if (clashes.length || lost.length) {
      const msg = (clashes.length ? "Un collègue avait aussi modifié " + clashes.join(", ") + " : votre version a été gardée pour ces champs, le reste de ses changements est conservé. " : "")
        + (lost.length ? "Supprimée entre-temps par un collègue, donc modification non appliquée : " + lost.map(t => "« " + t + " »").join(", ") + "." : "");
      $("toastmsg").textContent = msg.trim(); $("toast").hidden = false; $("undo").hidden = true; announce(msg.trim());
    }
    if (localDiff().length) save(); else { persist(); setSync(SCREEN ? "Mis à jour à " + hhmm(new Date()) : "À jour"); }
  }
  const FIELD_LABEL = { title: "titre", client: "client", dur: "durée", date: "jour", people: "personnes", done: "faite", debut: "début", fin: "fin", rep: "répétition", series: "série",
    kind: "type", status: "statut", notes: "notes", lieu: "lieu", client_id: "fiche client", fin_date: "dernier jour", reporte_de: "report" };

  // envoie à la base uniquement les champs modifiés ; une tâche changée entre-temps par un collègue est relue puis fusionnée
  let saving = Promise.resolve(), retryTimer = null;
  function save() {
    const n = persist();
    if (!n) return;
    setSync("Enregistrement…");
    saving = saving.then(flush).catch(err => {
      if (isNetwork(err)) { showPending(persist()); clearTimeout(retryTimer); retryTimer = setTimeout(save, 20000); return; }
      // refus de la base (droits, format) : on l'affiche clairement et on revient à la version enregistrée
      const msg = "Modification refusée par la base : " + (err.message || "erreur inconnue") + ". L'écran revient à la version enregistrée.";
      $("toastmsg").textContent = msg; $("toast").hidden = false; $("undo").hidden = true; announce(msg);
      synced = new Map(); state.tasks = []; try { localStorage.removeItem(QKEY); } catch (_) {}
      setSync("Non enregistré", true); return fetchTasks();
    });
  }
  async function flush() {
    let conflict = false;
    for (const c of localDiff()) {
      if (c.kind === "new") {
        const { data, error } = await sb.from("tasks").insert(c.row).select("updated_at");
        if (error) { if (error.code === "23505") { conflict = true; continue; } throw error; }
        synced.set(c.id, JSON.stringify(c.row));
        const t = state.tasks.find(x => x.id === c.id); if (t && data && data[0]) t.updated_at = data[0].updated_at;
      } else if (c.kind === "upd") {
        let q = sb.from("tasks").update(c.fields).eq("id", c.id);
        if (c.at) q = q.eq("updated_at", c.at);
        const { data, error } = await q.select("updated_at");
        if (error) throw error;
        if (!data || !data.length) { conflict = true; continue; }
        const t = state.tasks.find(x => x.id === c.id);
        synced.set(c.id, JSON.stringify(Object.assign(c.base, c.fields)));
        if (t) t.updated_at = data[0].updated_at;
      } else {
        const { error } = await sb.from("tasks").delete().eq("id", c.id);
        if (error) throw error;
        synced.delete(c.id);
      }
      persist();
    }
    if (conflict) return fetchTasks();
    if (!persist()) setSync("À jour");
  }
  window.addEventListener("online", () => { if (localDiff().length) save(); });
  window.addEventListener("beforeunload", e => { if (state.tasks.length && localDiff().length) { e.preventDefault(); e.returnValue = ""; } });

  // mode écran mural : ?ecran=1, avec en option &qui=leo,julien (plannings affichés) et &vue=liste
  const params = new URLSearchParams(location.search);
  const parseQui = v => { const ids = PEOPLE.map(p => p.id).filter(id => String(v || "").split(",").includes(id)); return ids.length && ids.length < PEOPLE.length ? ids : null; };
  let SCREEN = params.has("ecran");
  let QUI = parseQui(params.get("qui"));
  // le week-end, l'écran montre déjà la semaine suivante
  const currentMonday = () => { const d = new Date(); return SCREEN && (d.getDay() === 0 || d.getDay() === 6) ? addDays(mondayOf(d), 7) : mondayOf(d); };
  let monday = currentMonday();
  let view = "grid", filter = "all";
  if (SCREEN) view = params.get("vue") === "liste" ? "list" : "grid";
  else {
    try { view = localStorage.getItem(KEY + "-view") || ""; } catch (e) { view = ""; }
    if (!view) view = window.matchMedia && matchMedia("(max-width: 700px)").matches ? "list" : "grid";
  }

  const $ = id => document.getElementById(id);
  const grid = $("grid"), blist = $("blist");
  // annonces pour les lecteurs d'écran : une seule région, vidée puis remplie pour que deux messages identiques soient lus
  function announce(msg) { const r = $("annonce"); r.textContent = ""; setTimeout(() => { r.textContent = msg; }, 60); }
  const names = ids => { const n = ids.map(id => person(id).name); return n.length > 1 ? n.slice(0, -1).join(", ") + " et " + n[n.length - 1] : n[0]; };

  // annulation de la dernière action : le message reste affiché jusqu'à ce qu'on le ferme (pas de limite de temps)
  let undoData = null;
  function snap(msg) {
    undoData = JSON.stringify(state.tasks);
    $("toastmsg").textContent = msg; $("toast").hidden = false; $("undo").hidden = false;
  }
  $("toast-close").addEventListener("click", () => { $("toast").hidden = true; });

  let fsByUs = false;
  function setupScreen() {
    document.documentElement.classList.add("ecran");
    const title = QUI ? "Planning de " + names(QUI) : "Planning de l'équipe";
    document.querySelector("#app h1").textContent = title; document.title = title;
    // lecture seule : aucun clic, glisser ou raccourci ne modifie le planning (la page de connexion reste utilisable). Échap ramène au planning normal.
    ["click", "pointerdown", "keydown", "dblclick"].forEach(type => window.addEventListener(type, e => {
      if (e.target.closest && e.target.closest("#gate")) return;
      if (type === "keydown" && e.key === "Escape") { location.href = location.pathname; return; }
      e.stopPropagation(); e.preventDefault();
    }, true));
    document.addEventListener("fullscreenchange", () => { if (fsByUs && !document.fullscreenElement) location.href = location.pathname; });
    // l'écran reste allumé tant que la page est affichée (navigateurs récents)
    let lock = null;
    const keepAwake = async () => { try { if ("wakeLock" in navigator && document.visibilityState === "visible" && !lock) { lock = await navigator.wakeLock.request("screen"); lock.addEventListener("release", () => { lock = null; }); } } catch (_) {} };
    keepAwake();
    document.addEventListener("visibilitychange", keepAwake);
    const tick = () => { $("clock").textContent = hhmm(new Date()); };
    tick(); setInterval(tick, 15000);
  }
  if (SCREEN) setupScreen();

  // ---- fenêtres de dialogue : focus enfermé dedans, retour au bouton d'origine à la fermeture ----
  let dlg = null;
  function openDialog(overlay, focusEl) {
    dlg = { overlay, opener: document.activeElement };
    overlay.hidden = false;
    // le reste de la page devient inerte : ni clic, ni tabulation, ni lecture par les lecteurs d'écran hors de la fenêtre
    document.querySelectorAll("body > *").forEach(el => { if (el !== overlay && el.id !== "annonce" && el.tagName !== "SCRIPT") el.inert = true; });
    setTimeout(() => focusEl.focus(), 0);
  }
  function closeDialog() {
    if (!dlg) return;
    const d = dlg; dlg = null; d.overlay.hidden = true;
    document.querySelectorAll("body > *").forEach(el => { el.inert = false; });
    if (d.opener && document.contains(d.opener)) d.opener.focus();
  }
  document.addEventListener("keydown", e => {
    if (!dlg) return;
    if (e.key === "Escape") { e.preventDefault(); dlg.overlay === $("overlay") ? closeForm() : closeDialog(); return; }
    if (e.key !== "Tab") return;
    const f = [...dlg.overlay.querySelectorAll("a[href], button, input, select, textarea, summary, [contenteditable=''], [contenteditable='true'], [tabindex]:not([tabindex='-1'])")]
      .filter(el => !el.disabled && el.getClientRects().length && !el.closest("details:not([open]) > :not(summary)"));
    // focus sorti de la fenêtre (cas imprévu) : on le ramène au début
    if (!dlg.overlay.contains(document.activeElement)) { e.preventDefault(); (e.shiftKey ? f[f.length - 1] : f[0]).focus(); return; }
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });

  // ---- lancement du mode écran depuis le planning ----
  $("scr-people").innerHTML = PEOPLE.map(p => `<label class="chk" style="--pc:${p.color}"><input type="checkbox" value="${p.id}" checked><span class="dot" aria-hidden="true"></span>${p.name}</label>`).join("");
  function screenUrl() {
    const ids = [...$("scr-people").querySelectorAll("input:checked")].map(i => i.value);
    const u = new URLSearchParams({ ecran: "1" });
    if (ids.length && ids.length < PEOPLE.length) u.set("qui", ids.join(","));
    if ($("scr-form").querySelector("input[name=scr-vue]:checked").value === "list") u.set("vue", "liste");
    return { ids, query: "?" + u.toString().replace(/%2C/g, ",") };
  }
  const syncScreenUrl = () => { $("scr-url").value = location.origin + location.pathname + screenUrl().query; $("scr-copied").textContent = ""; };
  $("scr-form").addEventListener("change", syncScreenUrl);
  $("screenbtn").addEventListener("click", () => { $("scr-err").hidden = true; syncScreenUrl(); openDialog($("scr-overlay"), $("scr-people").querySelector("input")); });
  $("scr-cancel").addEventListener("click", closeDialog);
  $("scr-overlay").addEventListener("click", e => { if (e.target.id === "scr-overlay") closeDialog(); });
  $("scr-copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("scr-url").value); $("scr-copied").textContent = "Adresse copiée."; }
    catch (_) { $("scr-url").select(); $("scr-copied").textContent = "Adresse sélectionnée : copiez-la avec Ctrl+C."; }
  });
  $("scr-form").addEventListener("submit", e => {
    e.preventDefault();
    const { ids, query } = screenUrl();
    if (!ids.length) { $("scr-err").textContent = "Cochez au moins un planning à afficher."; $("scr-err").hidden = false; $("scr-people").querySelector("input").focus(); return; }
    // bascule sans recharger la page, pour garder le plein écran ; l'adresse reste valable si on recharge
    closeDialog();
    history.replaceState(null, "", location.pathname + query);
    SCREEN = true; QUI = ids.length < PEOPLE.length ? ids : null; filter = "all";
    view = $("scr-form").querySelector("input[name=scr-vue]:checked").value;
    $("toast").hidden = true;
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().then(() => { fsByUs = true; }).catch(() => {});
    setupScreen(); monday = currentMonday(); setSync("Mis à jour à " + hhmm(new Date())); render();
  });

  // sélecteurs de personnes

  $("f-kind").innerHTML = Object.entries(KINDS).map(([k, v]) => `<label class="chk"><input type="radio" name="f-kind" value="${k}">${v}</label>`).join("");
  $("f-status").innerHTML = Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  $("f-people").innerHTML = PEOPLE.map(p => `<label class="chk" style="--pc:${p.color}"><input type="checkbox" id="f-p-${p.id}" value="${p.id}"><span class="dot" aria-hidden="true"></span>${p.name}</label>`).join("");
  
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function taskHTML(t, row, di) {
    const p = person(row);
    const others = t.people.filter(x => x !== row).map(x => person(x).name);
    // dans la grille, une seule tabulation pour tout le tableau : les tâches s'atteignent avec les flèches (tabindex -1)
    const act = SCREEN ? "" : ` role="button" tabindex="${row ? -1 : 0}" aria-haspopup="dialog" aria-describedby="task-help"`;
    const grabbed = kb && kb.id === t.id && (kb.from || "") === (row || "");
    const rank = di ? dayRank(t, di) : null;
    return `<div class="task${t.people.length > 1 ? " shared" : ""}${isDone(t) ? " done" : ""}${grabbed ? " grabbed" : ""} k-${t.kind} st-${t.status}" data-id="${esc(t.id)}" data-from="${row || ""}"${act} style="--pc:${p ? p.color : "var(--control)"}">
      ${KIND_SHORT[t.kind] ? `<span class="kind">${KIND_SHORT[t.kind]}</span>` : ""}
      <span class="t">${isDone(t) ? `<span class="sr-only">Faite : </span>` : ""}${STATUS_SHORT[t.status] ? `<span class="sr-only">${STATUS_SHORT[t.status]} : </span>` : ""}${esc(t.title)}</span>
      ${t.people.length > 1 ? `<span class="with">Commune${row ? " avec " + others.join(", ") : " : " + t.people.map(x => person(x).name).join(", ")}</span>` : ""}
      <span class="m">${t.client ? `<span>${esc(t.client)}</span>` : ""}${hasTime(t) ? `<span class="h">${esc(t.debut)}–${esc(t.fin)}</span>` : ""}<span class="d">${durLabel(t.dur)}</span>${t.series ? `<span class="rep"><span aria-hidden="true">↻ </span>${REP_LABEL[t.rep] || "répétée"}</span>` : ""}${rank ? `<span>jour ${rank}</span>` : ""}${t.lieu === "distance" ? `<span>à distance</span>` : ""}${t.notes ? `<span class="note-ico" title="Notes internes"><span aria-hidden="true">✎</span><span class="sr-only">avec notes</span></span>` : ""}</span>
      ${!row && offWeek(t) ? `<span class="m"><span class="st">Prévue ${JOURS[parse(t.date).getDay()]} ${fmtShort(parse(t.date))} : à replacer</span></span>` : ""}
      ${STATUS_SHORT[t.status] ? `<span class="m"><span class="st" aria-hidden="true">${STATUS_SHORT[t.status]}</span>${t.reporte_de ? `<span>du ${fmtShort(parse(t.reporte_de))}</span>` : ""}</span>` : (t.reporte_de ? `<span class="m"><span>reportée du ${fmtShort(parse(t.reporte_de))}</span></span>` : "")}
    </div>`;
  }

  let shownAlerts = [];
  const akey = a => a.pid + "|" + a.date + "|" + a.long;
  const shownRows = () => QUI ? QUI.map(person) : PEOPLE;

  function render() {
    // mémorise l'élément qui a le focus pour le retrouver après le nouveau rendu
    const a = document.activeElement;
    const focusKey = a && (grid.contains(a) || blist.contains(a)) ? { id: a.dataset.id, from: a.dataset.from, add: a.classList.contains("add"), cell: a.classList.contains("cell"), inGrid: grid.contains(a) } : null;
    const todayIso = iso(new Date());
    const days = DAYS.map((_, i) => addDays(monday, i));
    const fri = days[4];
    $("weeklabel").textContent = monday.getDate() + (monday.getMonth() === fri.getMonth() ? "" : " " + MONTHS[monday.getMonth()]) + " – " + fri.getDate() + " " + MONTHS[fri.getMonth()];
    $("eyebrow").textContent = "Semaine " + isoWeek(monday) + " · " + fri.getFullYear();
    $("start").hidden = state.tasks.length > 0;
    const weekIsos = days.map(iso);
    shownAlerts = verifier([0, 1, 2, 3, 4, 5, 6].map(i => iso(addDays(monday, i))));

    // grille interactive (role="grid") ; en mode écran, simple tableau en lecture seule
    const G = !SCREEN;
    const rows = shownRows();
    grid.setAttribute("role", G ? "grid" : "table");
    grid.setAttribute("aria-rowcount", rows.length + 1);
    grid.setAttribute("aria-colcount", 6);
    if (cur.r >= rows.length) cur.r = rows.length - 1;
    let html = `<div class="row" role="row" aria-rowindex="1"><div class="corner" role="columnheader" aria-colindex="1">Équipe</div>`;
    days.forEach((d, i) => {
      const today = iso(d) === todayIso;
      html += `<div class="dayhead${today ? " today" : ""}" role="columnheader" aria-colindex="${i + 2}">${DAYS[i]}${today ? `<span class="badge">aujourd'hui</span>` : ""}<b>${fmtShort(d)}</b></div>`;
    });
    html += `</div>`;
    grid.classList.toggle("solo", rows.length === 1);
    grid.style.setProperty("--rows", rows.length);
    rows.forEach((p, r) => {
      const mine = state.tasks.filter(t => t.people.includes(p.id) && weekIsos.some(di => occursOn(t, di)));
      const total = weekIsos.reduce((s, di) => s + mine.filter(t => occursOn(t, di) && counts(t)).reduce((a, t) => a + t.dur, 0), 0);
      const pct = Math.min(100, total / p.base * 100);
      const isMe = p.id === state.me && !SCREEN;
      const extra = total - p.base;
      html += `<div class="row" role="row" aria-rowindex="${r + 2}"><div class="person${isMe ? " is-me" : ""}" role="rowheader" aria-colindex="1" style="--pc:${p.color};--ps:${p.soft}">
        <span class="pname"><span class="dot" aria-hidden="true"></span>${p.name}${isMe ? ` <span class="you">(vous)</span>` : ""}</span>
        <span class="load${extra > 0 ? " over" : ""}">${durLabel(total)} / ${p.base} h</span>
        ${extra > 0 ? `<span class="sup">+ ${durLabel(extra)} ${p.base >= 35 ? "supplémentaires" : "complémentaires"}</span>` : ""}
        <span class="bar${extra > 0 ? " over" : ""}" aria-hidden="true"><i style="width:${pct}%"></i></span>
      </div>`;
      weekIsos.forEach((di, c) => {
        const ts = mine.filter(t => occursOn(t, di)).sort((x, y) => (toMin(x.debut) ?? 9999) - (toMin(y.debut) ?? 9999));
        const sum = ts.filter(counts).reduce((s, t) => s + t.dur, 0);
        const share = p.jours ? p.jours[c] : 1, cap = DAY_H * share;
        const al = shownAlerts.filter(x => x.pid === p.id && x.date === di);
        const strong = al.some(x => x.niv === "fort");
        const target = kb && kb.r === r && kb.c === c;
        const active = G && r === cur.r && c === cur.c;
        html += `<div class="cell${sum > cap && share > 0 ? " over" : ""}${share === 0 ? " nowork" : ""}${strong ? " alert" : ""}${di === todayIso ? " today" : ""}${target ? " kb-target" : ""}" role="${G ? "gridcell" : "cell"}" aria-colindex="${c + 2}"${G ? ` tabindex="${active ? 0 : -1}"` : ""} data-r="${r}" data-c="${c}" data-drop="cell" data-person="${p.id}" data-date="${di}">
          ${share < 1 ? `<span class="daynote">${share === 0 ? "Non travaillé" : "Demi-journée"}</span>` : ""}
          ${ts.map(t => taskHTML(t, p.id, di)).join("")}
          ${sum ? `<span class="flag${sum > cap ? " over" : ""}">${sum > cap ? "Surchargé : " : ""}${durLabel(sum)} / ${durLabel(cap)}</span>` : ""}
          ${al.length ? `<ul class="alerts">${al.map(x => `<li class="${x.niv === "fort" ? "" : "minor"}"><span aria-hidden="true">⚠ </span>${esc(x.court)}</li>`).join("")}</ul>` : ""}
          ${SCREEN ? "" : `<button type="button" class="add" tabindex="-1" data-person="${p.id}" data-date="${di}" aria-haspopup="dialog" aria-label="Ajouter une tâche pour ${p.name}, ${DAYS[c].toLowerCase()} ${fmtShort(days[c])}"><span aria-hidden="true">+</span> Ajouter</button>`}
        </div>`;
      });
      html += `</div>`;
    });
    grid.innerHTML = html;
    blist.classList.toggle("kb-target", !!(kb && kb.r === rows.length));
    renderVigil();

    const back = state.tasks.filter(inBacklog);
    blist.innerHTML = back.length
      ? back.map(t => `<li class="btask">${taskHTML(t, null, null)}<button type="button" class="take" data-take="${esc(t.id)}" aria-label="Prendre « ${esc(t.title)} »">Prendre</button></li>`).join("")
      : `<li class="empty">Rien à prendre pour l'instant.</li>`;
    renderSummary(weekIsos);
    renderList(days);
    $("mainview").hidden = view !== "grid";
    $("listview").hidden = view !== "list";
    $("tab-grid").setAttribute("aria-pressed", view === "grid");
    $("tab-list").setAttribute("aria-pressed", view === "list");

    // retour du focus au même endroit (même tâche, même bouton ou même case)
    if (kb) {
      const el = kb.r === rows.length ? blist : cellAt(kb.r, kb.c);
      if (el) { if (el !== blist) el.tabIndex = 0; if (el !== document.activeElement) el.focus(); }
    } else if (focusKey) {
      let el = null;
      if (focusKey.id) el = taskEl(focusKey.id, focusKey.from);
      if (!el && focusKey.inGrid) { const c = cellAt(cur.r, cur.c); el = c && focusKey.add ? c.querySelector(".add") : c; }
      if (!el && !focusKey.inGrid) el = blist;
      if (el && el !== document.activeElement) el.focus();
    }
  }

  // après une action : enregistre, redessine, puis annonce le résultat et les nouvelles anomalies graves
  function after(msg, focusFn) {
    const prev = new Set(shownAlerts.map(akey));
    save(); render();
    if (focusFn) focusFn();
    const fresh = shownAlerts.filter(a => a.niv === "fort" && !prev.has(akey(a)));
    announce(msg + (fresh.length ? " Attention : " + fresh.map(a => a.long).join(" ") : ""));
  }

  function renderVigil() {
    const rows = shownAlerts.filter(a => !QUI || QUI.includes(a.pid)).sort((x, y) => (x.niv === "fort" ? 0 : 1) - (y.niv === "fort" ? 0 : 1) || String(x.date).localeCompare(String(y.date)));
    let html = rows.length
      ? `<ul>${rows.map(a => `<li class="${a.niv === "fort" ? "" : "minor"}">${a.niv === "fort" ? "<b>À corriger :</b> " : ""}${a.date && parse(a.date).getDay() % 6 && !SCREEN
          ? `<button type="button" class="linkbtn" data-goto="${a.pid}|${a.date}">${esc(a.long)}</button>` : esc(a.long)}</li>`).join("")}</ul>`
      : `<p class="ok">Aucun point de vigilance cette semaine.</p>`;
    if (!HAS_TIMES) html += `<p class="hint">Pour contrôler aussi les chevauchements, le repos de 11 h et les pauses, activez les horaires : fichier <code>supabase/horaires.sql</code> à passer une fois dans Supabase.</p>`;
    $("vigil-body").innerHTML = html;
  }

  const forShown = t => !QUI || t.people.some(x => QUI.includes(x));
  function renderSummary(weekIsos) {
    const wk = state.tasks.filter(t => t.people.length && weekIsos.some(di => occursOn(t, di)) && forShown(t) && counts(t));
    const done = wk.filter(isDone).length;
    const hours = wk.reduce((s, t) => s + t.dur, 0);
    const back = state.tasks.filter(inBacklog).length;
    const pl = (n, w) => `<li><b>${n}</b> ${w}${n > 1 ? "s" : ""}</li>`;
    $("summary").innerHTML = pl(wk.length, "tâche") + pl(done, "faite") + pl(wk.length - done, "restante") + `<li><b>${durLabel(hours)}</b> prévues</li>` + (SCREEN ? "" : `<li><b>${back}</b> à prendre</li>`);
  }

  function renderList(days) {
    $("filters").innerHTML = [{ id: "all", name: "Tout le monde" }].concat(PEOPLE).map(p =>
      `<button type="button" class="chip" data-filter="${p.id}" aria-pressed="${filter === p.id}"${p.color ? ` style="--pc:${p.color}"` : ""}>${p.color ? `<span class="dot" aria-hidden="true"></span>` : ""}${p.name}</button>`).join("");
    const todayIso = iso(new Date());
    $("listbody").innerHTML = days.map((d, i) => {
      const di = iso(d);
      const today = di === todayIso;
      const ts = state.tasks.filter(t => occursOn(t, di) && t.people.length && forShown(t) && (filter === "all" || t.people.includes(filter)));
      const rows = ts.map(t => `<li><label class="lrow${isDone(t) ? " done" : ""}">
          <input type="checkbox" data-done="${esc(t.id)}" aria-label="${esc("Faite : " + t.title)}"${isDone(t) ? " checked" : ""}${isOff(t) ? " disabled" : ""}>
          <span class="lt">${esc(t.title)}${isDone(t) ? `<span class="sr-only"> (faite)</span>` : ""}${[KIND_SHORT[t.kind], STATUS_SHORT[t.status], t.client, t.lieu === "distance" ? "à distance" : "", dayRank(t, di) ? "jour " + dayRank(t, di) : ""].filter(Boolean).length ? `<small>${esc([KIND_SHORT[t.kind], STATUS_SHORT[t.status], t.client, t.lieu === "distance" ? "à distance" : "", dayRank(t, di) ? "jour " + dayRank(t, di) : ""].filter(Boolean).join(" · "))}</small>` : ""}</span>
          <span class="lp">${t.people.map(x => `<span class="pill" style="--pc:${person(x).color};--ps:${person(x).soft}">${person(x).name}</span>`).join("")}</span>
          <span class="lh">${durLabel(t.dur)}</span>
        </label></li>`).join("");
      const left = ts.filter(t => !isDone(t) && counts(t)).length;
      return `<section class="lday${today ? " today" : ""}" aria-labelledby="ld-${di}">
        <h3 id="ld-${di}">${DAYS[i]}${today ? `<span class="badge">aujourd'hui</span>` : ""} <span class="date">${fmtShort(d)}</span><span class="count">${ts.length ? left + " à faire sur " + ts.length : "rien de prévu"}</span></h3>
        ${rows ? `<ul class="lrows">${rows}</ul>` : ""}
      </section>`;
    }).join("");
  }

  // ---- fenêtre d'édition ----
  let editing = null;
  function openForm(t) {
    editing = t;
    $("ftitle").textContent = t.id ? "Modifier la tâche" : "Nouvelle tâche";
    $("f-title").value = t.title || "";
    $("f-client").value = t.client || "";
    PEOPLE.forEach(p => { $("f-p-" + p.id).checked = (t.people || []).includes(p.id); });
    $("f-dur").value = String(t.dur || 1);
    $("f-date").value = t.date || "";
    $("f-time-row").hidden = $("f-time-hint").hidden = !HAS_TIMES;
    $("f-debut").value = t.debut || ""; $("f-fin").value = t.fin || "";
    $("f-debut").removeAttribute("aria-invalid"); $("f-fin").removeAttribute("aria-invalid");
    $("f-del").hidden = !t.id;
    $("f-done-wrap").hidden = !t.id;
    $("f-dup").hidden = !t.id;
    $("f-del-series").hidden = !t.series;
    $("f-rep-row").hidden = !!t.series;
    $("f-rep").value = "";
    $("f-until").value = "";
    $("f-series").hidden = !t.series;
    if (t.series) {
      const n = state.tasks.filter(x => x.series === t.series).length;
      $("f-series").textContent = "↻ Tâche répétée " + (REP_LABEL[t.rep] || "") + " (" + n + " occurrences). Les modifications s'appliquent à cette occurrence seulement.";
    }
    $("f-done").checked = !!t.done;
    // champs du lot 2 (type, statut, client, notes…) : visibles une fois supabase/interventions.sql passé
    document.querySelectorAll("#form .l2").forEach(el => { el.hidden = !HAS_LOT2; });
    reportFrom = null; $("f-date-hint").hidden = true; $("f-report").hidden = !t.id || !t.date || !HAS_LOT2;
    if (HAS_LOT2) {
      $("f-done-wrap").hidden = true;
      $("f-status-row").hidden = !t.id;
      const kind = t.kind || "client";
      document.querySelectorAll("input[name=f-kind]").forEach(r => { r.checked = r.value === kind; });
      $("f-status").value = t.status || "planifiee";
      $("f-notes").value = t.notes || "";
      $("f-distance").checked = t.lieu === "distance";
      $("f-findate").value = t.fin_date || "";
      const c = (t.client_id && clients.find(x => x.id === t.client_id)) || findClient(t.client);
      $("f-adresse").value = c ? c.adresse : ""; $("f-tel").value = c ? c.telephone : "";
      $("f-model").value = ""; $("f-model-del").hidden = true;
      $("f-model-row").hidden = !!t.id || !modeles.length;
      clientInfo();
    }
    loadHistory(t);
    syncDurs();
    $("ferr").hidden = true;
    $("f-title").removeAttribute("aria-invalid");
    if (!dlg) openDialog($("overlay"), $("f-title")); else setTimeout(() => $("f-title").focus(), 0);
  }
  // ---- clients, modèles, report ----
  let reportFrom = null;
  async function loadRefs() {
    if (!HAS_LOT2) return;
    const [c, m] = await Promise.all([sb.from("clients").select("*").order("nom"), sb.from("modeles").select("*").order("nom")]);
    if (!c.error && c.data) clients = c.data.map(x => ({ id: x.id, nom: x.nom, adresse: x.adresse || "", telephone: x.telephone || "" }));
    if (!m.error && m.data) modeles = m.data;
    $("clients-list").innerHTML = clients.map(x => `<option value="${esc(x.nom)}"></option>`).join("");
    $("f-model").innerHTML = `<option value="">Aucun modèle</option>` + modeles.map(x => `<option value="${esc(x.id)}">${esc(x.nom)}</option>`).join("");
  }
  async function saveClient(c) {
    const { error } = await sb.from("clients").upsert(c);
    if (error) { $("toastmsg").textContent = "Fiche client non enregistrée : " + error.message; $("toast").hidden = false; $("undo").hidden = true; return; }
    const i = clients.findIndex(x => x.id === c.id); if (i >= 0) clients[i] = c; else clients.push(c);
    clients.sort((a, b) => a.nom.localeCompare(b.nom));
    $("clients-list").innerHTML = clients.map(x => `<option value="${esc(x.nom)}"></option>`).join("");
  }
  // sous le champ client : itinéraire et dernières interventions chez ce client
  function clientInfo() {
    const name = $("f-client").value.trim(), c = findClient(name), adr = $("f-adresse").value.trim();
    let html = "";
    if (adr) html += `<a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adr)}" target="_blank" rel="noopener">Itinéraire vers ${esc(adr)} (Google Maps, nouvel onglet)</a>`;
    if (c || name) {
      const past = state.tasks.filter(t => t.date && ((c && t.client_id === c.id) || (name && t.client.toLowerCase() === name.toLowerCase())) && (!editing || t.id !== editing.id))
        .sort((a, b) => b.date.localeCompare(a.date));
      if (past.length) html += `<p>${past.length} intervention${past.length > 1 ? "s" : ""} pour ce client, dont :</p><ul>` + past.slice(0, 5).map(t => `<li>${fmtShort(parse(t.date))} · ${esc(t.title)} · ${STATUS[t.status] || ""}</li>`).join("") + `</ul>`;
    }
    $("f-client-info").innerHTML = html; $("f-client-info").hidden = !HAS_LOT2 || !html;
  }
  // mis à jour pendant la frappe (et pas à la sortie du champ) : sinon le bloc apparaît au moment
  // du clic sur « Enregistrer », décale le bouton et le clic est perdu
  $("f-client").addEventListener("input", () => {
    const c = findClient($("f-client").value);
    if (c) { if (!$("f-adresse").value) $("f-adresse").value = c.adresse; if (!$("f-tel").value) $("f-tel").value = c.telephone; }
    clientInfo();
  });
  $("f-adresse").addEventListener("input", clientInfo);
  $("f-report").addEventListener("click", () => {
    reportFrom = editing.date; $("f-date-hint").hidden = false; $("f-date").focus();
    announce("Choisissez le nouveau jour, puis Enregistrer.");
  });
  $("f-model").addEventListener("change", () => {
    const m = modeles.find(x => x.id === $("f-model").value); $("f-model-del").hidden = !m; if (!m) return;
    const d = m.data || {};
    $("f-title").value = d.title || m.nom; $("f-dur").value = String(d.dur || 1); syncDurs();
    document.querySelectorAll("input[name=f-kind]").forEach(r => { r.checked = r.value === (d.kind || "client"); });
    $("f-distance").checked = d.lieu === "distance"; $("f-notes").value = d.notes || "";
    if (d.client) { $("f-client").value = d.client; $("f-client").dispatchEvent(new Event("change")); }
    if (HAS_TIMES && d.debut && d.fin) { $("f-debut").value = d.debut; $("f-fin").value = d.fin; }
    announce("Modèle « " + m.nom + " » appliqué.");
  });
  $("f-model-del").addEventListener("click", async () => {
    const m = modeles.find(x => x.id === $("f-model").value); if (!m || !confirm("Supprimer le modèle « " + m.nom + " » ?")) return;
    const { error } = await sb.from("modeles").delete().eq("id", m.id);
    if (error) { announce("Suppression impossible : " + error.message); return; }
    await loadRefs(); $("f-model-del").hidden = true; $("f-model-row").hidden = !modeles.length; announce("Modèle supprimé.");
  });
  $("f-save-model").addEventListener("click", async () => {
    const title = $("f-title").value.trim();
    if (!title) { $("ferr").textContent = "Donnez un nom à la tâche avant d'en faire un modèle."; $("ferr").hidden = false; $("f-title").focus(); return; }
    const kind = (document.querySelector("input[name=f-kind]:checked") || {}).value || "client";
    const data = { title, dur: Number(String($("f-dur").value).replace(",", ".")) || 1, kind, lieu: $("f-distance").checked ? "distance" : "site", notes: $("f-notes").value.trim(), client: $("f-client").value.trim(),
      debut: $("f-debut").value || null, fin: $("f-fin").value || null };
    const old = modeles.find(x => x.nom.toLowerCase() === title.toLowerCase());
    const { error } = await sb.from("modeles").upsert({ id: old ? old.id : uid(), nom: title, data });
    if (error) { announce("Modèle non enregistré : " + error.message); return; }
    await loadRefs(); announce("Modèle « " + title + " » " + (old ? "mis à jour." : "enregistré : il sera proposé en haut de la fiche des nouvelles tâches."));
  });

  async function loadHistory(t) {
    const box = $("f-hist"); box.hidden = true; box.open = false; $("f-hist-list").innerHTML = "";
    if (!HAS_HISTORY || !t.id) return;
    const { data, error } = await sb.from("historique").select("action,champs,par,le").eq("task_id", t.id).order("le", { ascending: false }).limit(10);
    if (error || !data || !data.length || !editing || editing.id !== t.id) return;
    const who = e => EMAIL_NAME[String(e || "").toLowerCase()] || "quelqu'un";
    const verb = { ajout: "a créé la tâche", suppression: "a supprimé la tâche", modif: "a modifié" };
    $("f-hist-list").innerHTML = data.map(h => { const d = new Date(h.le); return `<li>${fmtShort(d)} à ${hhmm(d)} · <b>${esc(who(h.par))}</b> ${verb[h.action] || h.action}${h.champs && h.champs.length ? " : " + h.champs.map(k => FIELD_LABEL[k] || k).join(", ") : ""}</li>`; }).join("");
    box.hidden = false;
  }
  function syncDurs() {
    const v = Number(String($("f-dur").value).replace(",", "."));
    document.querySelectorAll("#durs button").forEach(b => b.setAttribute("aria-pressed", Number(b.dataset.dur) === v));
  }
  $("f-dur").addEventListener("input", syncDurs);
  // début et fin renseignés : la durée suit
  const syncTimes = () => { const a = toMin($("f-debut").value), b = toMin($("f-fin").value); if (a !== null && b !== null && b > a) { $("f-dur").value = String((b - a) / 60); syncDurs(); } };
  $("f-debut").addEventListener("input", syncTimes); $("f-fin").addEventListener("input", syncTimes);
  $("f-rep").addEventListener("change", () => {
    if ($("f-rep").value && !$("f-until").value) {
      const base = $("f-date").value ? parse($("f-date").value) : monday;
      $("f-until").value = iso(new Date(base.getFullYear(), base.getMonth() + 3, base.getDate()));
    }
  });
  $("f-dup").addEventListener("click", () => {
    const src = editing;
    openForm({ title: src.title, client: src.client, client_id: src.client_id, people: src.people.slice(), date: src.date, dur: src.dur, debut: src.debut, fin: src.fin,
      kind: src.kind, lieu: src.lieu, notes: src.notes, fin_date: src.fin_date });
    $("ftitle").textContent = "Copie de la tâche";
  });
  $("f-del-series").addEventListener("click", () => {
    const t = editing;
    const n = state.tasks.filter(x => x.series === t.series && x.date >= t.date).length;
    if (!confirm("Supprimer " + n + " occurrence" + (n > 1 ? "s" : "") + " de « " + t.title + " », à partir du " + fmtShort(parse(t.date)) + " ?")) return;
    snap("Série « " + t.title + " » supprimée à partir du " + fmtShort(parse(t.date)) + ".");
    state.tasks = state.tasks.filter(x => !(x.series === t.series && x.date >= t.date));
    closeForm(); after("Série « " + t.title + " » supprimée à partir du " + fmtShort(parse(t.date)) + ".");
  });
  $("durs").addEventListener("click", e => { const b = e.target.closest("[data-dur]"); if (b) { $("f-dur").value = b.dataset.dur; syncDurs(); } });
  function closeForm() { closeDialog(); editing = null; }
  $("f-cancel").addEventListener("click", closeForm);
  $("overlay").addEventListener("click", e => { if (e.target.id === "overlay") closeForm(); });
  $("f-del").addEventListener("click", () => {
    const title = editing.title;
    snap("« " + title + " » supprimée.");
    state.tasks = state.tasks.filter(t => t.id !== editing.id); closeForm(); after("« " + title + " » supprimée.");
  });
  $("form").addEventListener("submit", async e => {
    e.preventDefault();
    const title = $("f-title").value.trim();
    if (!title) { $("ferr").textContent = "Le champ « Tâche » est obligatoire : donnez un nom à la tâche."; $("ferr").hidden = false; $("f-title").setAttribute("aria-invalid", "true"); $("f-title").focus(); return; }
    $("f-title").removeAttribute("aria-invalid");
    const ppl = PEOPLE.map(p => p.id).filter(id => $("f-p-" + id).checked);
    let date = $("f-date").value || null;
    if (ppl.length && !date) date = iso(monday);
    const fail = (msg, el) => { $("ferr").textContent = msg; $("ferr").hidden = false; el.setAttribute("aria-invalid", "true"); el.focus(); };
    ["f-dur", "f-date"].forEach(id => $(id).removeAttribute("aria-invalid"));
    const durTxt = String($("f-dur").value).replace(",", ".").trim(), durNum = durTxt === "" ? 1 : Number(durTxt);
    if (!Number.isFinite(durNum) || durNum < 0.25 || durNum > MAX_DUR) return fail("La durée doit être comprise entre 0,25 h (15 min) et " + MAX_DUR + " h.", $("f-dur"));
    // le planning ne montre que du lundi au vendredi : une tâche posée un samedi ou un dimanche serait invisible
    if (ppl.length && date && !weekday(date)) return fail("Le planning ne montre que du lundi au vendredi : choisissez un jour de semaine.", $("f-date"));
    const data = { title, client: $("f-client").value.trim(), people: ppl, date: ppl.length ? date : null, dur: Math.round(durNum * 4) / 4 };
    if (HAS_TIMES) {
      const db = $("f-debut").value, fn = $("f-fin").value;
      const bad = (msg, el) => { $("ferr").textContent = msg; $("ferr").hidden = false; el.setAttribute("aria-invalid", "true"); el.focus(); };
      $("f-debut").removeAttribute("aria-invalid"); $("f-fin").removeAttribute("aria-invalid");
      if (!!db !== !!fn) return bad("Indiquez l'heure de début et l'heure de fin, ou aucune des deux.", db ? $("f-fin") : $("f-debut"));
      if (db && toMin(fn) <= toMin(db)) return bad("L'heure de fin doit être après l'heure de début (un créneau ne peut pas passer minuit).", $("f-fin"));
      data.debut = db || null; data.fin = fn || null;
      if (db) data.dur = (toMin(fn) - toMin(db)) / 60;
    }
    if (editing.id) data.done = $("f-done").checked;
    if (HAS_LOT2) {
      data.kind = (document.querySelector("input[name=f-kind]:checked") || {}).value || "client";
      data.status = editing.id ? $("f-status").value : "planifiee";
      data.done = data.status === "terminee";
      data.notes = $("f-notes").value.trim();
      data.lieu = $("f-distance").checked ? "distance" : "site";
      let fd = $("f-findate").value || null;
      // report d'une intervention sur plusieurs jours : le dernier jour se décale d'autant
      if (reportFrom && data.date && data.date !== reportFrom && fd && fd === editing.fin_date) fd = iso(addDays(parse(fd), Math.round((parse(data.date) - parse(reportFrom)) / 864e5)));
      if (fd && data.date && fd < data.date) { $("ferr").textContent = "Le dernier jour doit être après le premier jour."; $("ferr").hidden = false; $("f-findate").setAttribute("aria-invalid", "true"); $("f-findate").focus(); return; }
      $("f-findate").removeAttribute("aria-invalid");
      data.fin_date = fd && data.date && fd > data.date ? fd : null;
      if (reportFrom && data.date && data.date !== reportFrom) {
        data.reporte_de = editing.reporte_de || reportFrom; if (data.status === "reportee") data.status = "planifiee";
      }
      // fiche client : créée ou mise à jour à partir du nom, de l'adresse et du téléphone saisis
      const name = data.client, adr = $("f-adresse").value.trim(), tel = $("f-tel").value.trim();
      let c = findClient(name);
      if (name && data.kind === "client") {
        if (!c) { c = { id: "c" + uid(), nom: name, adresse: adr, telephone: tel }; await saveClient(c); }
        else if (adr !== c.adresse || tel !== c.telephone) await saveClient(Object.assign({}, c, { adresse: adr, telephone: tel }));
      }
      data.client_id = c && name && clients.some(x => x.id === c.id) ? c.id : null;
    }
    if (editing.id) Object.assign(state.tasks.find(t => t.id === editing.id), data);
    else {
      const rep = $("f-rep").value, until = $("f-until").value;
      if (rep && (!data.date || !ppl.length)) { $("ferr").textContent = "Pour répéter une tâche, attribuez-la à quelqu'un et choisissez un jour."; $("ferr").hidden = false; return; }
      if (rep && (!until || until <= data.date)) { $("ferr").textContent = "Choisissez une date de fin après le premier jour."; $("ferr").hidden = false; return; }
      const dates = rep ? seriesDates(data.date, rep, until) : [];
      if (dates.length > MAX_OCC) { $("ferr").textContent = "Une série est limitée à " + MAX_OCC + " occurrences : choisissez une date de fin plus proche."; $("ferr").hidden = false; $("f-until").focus(); return; }
      const series = rep ? uid() : null;
      const base = Object.assign({ id: uid() }, data, series ? { series, rep } : {});
      state.tasks.push(base);
      if (rep) dates.forEach(di => state.tasks.push(Object.assign({}, data, { id: uid(), date: di, people: ppl.slice(), series, rep })));
    }
    const where = ppl.length ? " pour " + names(ppl) + ", " + dayLabel(data.date) : " dans la liste à prendre";
    const wasEdit = !!editing.id;
    const moved = data.reporte_de && reportFrom ? " Reportée au " + dayLabel(data.date) + "." : "";
    closeForm(); after("« " + title + " » " + (wasEdit ? "modifiée." : "ajoutée" + where + ".") + moved);
  });

  $("newtask").addEventListener("click", () => openForm({ people: [state.me], date: defaultDay(), dur: 1 }));
  $("qadd").addEventListener("submit", e => {
    e.preventDefault();
    const title = $("qtitle").value.trim();
    if (!title) { $("qtitle").focus(); return; }
    state.tasks.push({ id: uid(), title, client: "", people: [], date: null, dur: 1 });
    $("qtitle").value = ""; after("« " + title + " » ajoutée à la liste à prendre."); $("qtitle").focus();
  });
  $("undo").addEventListener("click", () => {
    if (!undoData) return;
    state.tasks = JSON.parse(undoData); undoData = null; $("undo").hidden = true; $("toastmsg").textContent = "Action annulée."; after("Dernière action annulée.");
  });
  document.addEventListener("keydown", e => {
    if ($("app").hidden || dlg || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || (e.target.closest && e.target.closest(".task, .chk, .lrow, #grid"))) return;
    if (e.key === "ArrowLeft") $("prev").click();
    else if (e.key === "ArrowRight") $("next").click();
  });
  $("prev").addEventListener("click", () => { monday = addDays(monday, -7); render(); });
  $("next").addEventListener("click", () => { monday = addDays(monday, 7); render(); });
  $("today").addEventListener("click", () => { monday = mondayOf(new Date()); render(); });

  // ---- sauvegarde sur l'ordinateur et restauration ----
  $("export").addEventListener("click", () => {
    const out = { app: "planning-equipe", version: 1, exporte_le: new Date().toISOString(), tasks: state.tasks.map(row) };
    if (HAS_LOT2) { out.clients = clients; out.modeles = modeles; }
    const blob = new Blob([JSON.stringify(out, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "planning-sauvegarde-" + iso(new Date()) + ".json";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    announce("Sauvegarde téléchargée : " + state.tasks.length + " tâches" + (HAS_LOT2 ? ", " + clients.length + " clients et " + modeles.length + " modèles." : "."));
  });

  // restauration : le fichier entier est vérifié avant toute modification ; une seule ligne douteuse et rien n'est appliqué
  const MAX_FILE = 5 * 1024 * 1024, MAX_ROWS = 5000;
  function checkTask(t) {
    if (!t || typeof t !== "object" || Array.isArray(t)) return "ce n'est pas une tâche";
    if (typeof t.id !== "string" || !SAFE_ID.test(t.id)) return "identifiant invalide";
    if (typeof t.title !== "string" || !t.title.trim() || t.title.length > 500) return "titre manquant ou trop long";
    for (const k of ["client", "notes"]) if (t[k] != null && (typeof t[k] !== "string" || t[k].length > 5000)) return "champ « " + k + " » invalide";
    if (t.people != null && (!Array.isArray(t.people) || t.people.some(x => !person(x)) || new Set(t.people).size !== t.people.length)) return "personne inconnue";
    if (t.kind != null && !own(KINDS, t.kind)) return "type inconnu";
    if (t.status != null && !own(STATUS, t.status)) return "statut inconnu";
    if (t.rep != null && !own(REP_LABEL, t.rep)) return "répétition inconnue";
    if (t.lieu != null && t.lieu !== "site" && t.lieu !== "distance") return "lieu inconnu";
    for (const k of ["date", "fin_date", "reporte_de"]) if (t[k] != null && !okDate(t[k])) return "date « " + k + " » invalide";
    for (const k of ["debut", "fin"]) if (t[k] != null && !okTime(t[k])) return "heure « " + k + " » invalide";
    if (t.dur != null && (typeof t.dur !== "number" || !Number.isFinite(t.dur) || t.dur < 0.25 || t.dur > MAX_DUR)) return "durée invalide";
    if (t.done != null && typeof t.done !== "boolean") return "case « faite » invalide";
    for (const k of ["series", "client_id"]) if (t[k] != null && (typeof t[k] !== "string" || !SAFE_ID.test(t[k]))) return "champ « " + k + " » invalide";
    return null;
  }
  const checkRef = (x, keys) => !x || typeof x !== "object" || typeof x.id !== "string" || !SAFE_ID.test(x.id) || typeof x.nom !== "string" || !x.nom.trim() || x.nom.length > 200
    || keys.some(k => x[k] != null && typeof x[k] !== "string") ? "fiche invalide" : null;
  function checkBackup(data) {
    if (!data || data.app !== "planning-equipe" || data.version !== 1 || !Array.isArray(data.tasks)) return "Ce fichier n'est pas une sauvegarde du planning.";
    if (!data.tasks.length) return "Cette sauvegarde ne contient aucune tâche.";
    if (data.tasks.length > MAX_ROWS) return "Cette sauvegarde contient plus de " + MAX_ROWS + " tâches : restauration refusée.";
    const ids = new Set();
    for (let i = 0; i < data.tasks.length; i++) {
      const why = checkTask(data.tasks[i]);
      if (why) return "Sauvegarde refusée, rien n'a été modifié : tâche n° " + (i + 1) + ", " + why + ".";
      if (ids.has(data.tasks[i].id)) return "Sauvegarde refusée, rien n'a été modifié : la tâche n° " + (i + 1) + " a le même identifiant qu'une autre.";
      ids.add(data.tasks[i].id);
    }
    for (const [k, keys] of [["clients", ["adresse", "telephone"]], ["modeles", []]]) {
      if (data[k] == null) continue;
      if (!Array.isArray(data[k]) || data[k].length > MAX_ROWS) return "Sauvegarde refusée : liste « " + k + " » invalide.";
      const bad = data[k].findIndex(x => checkRef(x, keys) || (k === "modeles" && (x.data == null || typeof x.data !== "object" || Array.isArray(x.data))));
      if (bad >= 0) return "Sauvegarde refusée, rien n'a été modifié : " + k + " n° " + (bad + 1) + " invalide.";
    }
    return null;
  }
  $("import-file").addEventListener("change", async e => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    if (f.size > MAX_FILE) { alert("Fichier trop gros pour une sauvegarde du planning (plus de 5 Mo)."); return; }
    let data;
    try { data = JSON.parse(await f.text()); } catch (_) { data = null; }
    const why = checkBackup(data);
    if (why) { alert(why); announce(why); return; }
    const list = data.tasks;
    const refs = HAS_LOT2 ? (data.clients || []).length + (data.modeles || []).length : 0;
    const known = new Set(state.tasks.map(t => t.id));
    const upd = list.filter(t => known.has(t.id)).length, add = list.length - upd;
    if (!confirm("Restaurer " + list.length + " tâches (" + add + " à recréer, " + upd + " à remettre comme dans la sauvegarde)" + (refs ? " et " + refs + (refs > 1 ? " fiches" : " fiche") + " (clients et modèles)" : "") + " ? Les éléments absents du fichier ne sont pas touchés.")) return;
    if (refs) {
      const errs = [];
      for (const k of ["clients", "modeles"]) if (data[k] && data[k].length) { const { error } = await sb.from(k).upsert(data[k]); if (error) errs.push(k + " : " + error.message); }
      await loadRefs();
      if (errs.length) { $("toastmsg").textContent = "Fiches non restaurées (" + errs.join(" ; ") + ")."; $("toast").hidden = false; $("undo").hidden = true; }
    }
    snap("Restauration de " + list.length + " tâches.");
    list.forEach(r => { const t = norm(r); const i = state.tasks.findIndex(x => x.id === t.id); if (i >= 0) { t.updated_at = state.tasks[i].updated_at; state.tasks[i] = t; } else state.tasks.push(t); });
    after(list.length + " tâches restaurées depuis la sauvegarde.");
  });

  function defaultDay() {
    const t = new Date(); const di = iso(t);
    const wd = (t.getDay() + 6) % 7;
    return (iso(mondayOf(t)) === iso(monday) && wd < 5) ? di : iso(monday);
  }

  document.addEventListener("click", e => {
    const add = e.target.closest(".add");
    if (add) { openForm({ people: [add.dataset.person], date: add.dataset.date, dur: 1 }); return; }
    if (e.target.classList && e.target.classList.contains("cell")) { openForm({ people: [e.target.dataset.person], date: e.target.dataset.date, dur: 1 }); return; }
    const tab = e.target.closest("[data-view]");
    if (tab && !SCREEN) { view = tab.dataset.view; try { localStorage.setItem(KEY + "-view", view); } catch (_) {} render(); return; }
    const go = e.target.closest("[data-goto]");
    if (go) { const [pid, di] = go.dataset.goto.split("|"); monday = mondayOf(parse(di)); const r = shownRows().findIndex(p => p.id === pid); render(); focusCell(r, (parse(di).getDay() + 6) % 7); return; }
    const chip = e.target.closest("[data-filter]");
    if (chip) { filter = chip.dataset.filter; render(); return; }
    const take = e.target.closest("[data-take]");
    if (take) {
      const t = state.tasks.find(x => x.id === take.dataset.take);
      snap("« " + t.title + " » prise par " + person(state.me).name + ".");
      if (!t.people.includes(state.me)) t.people.push(state.me); t.date = defaultDay();
      after("« " + t.title + " » prise par " + person(state.me).name + ", " + dayLabel(t.date) + ".");
    }
  });
  document.addEventListener("change", e => {
    const id = e.target.dataset && e.target.dataset.done;
    if (!id) return;
    const t = state.tasks.find(x => x.id === id); t.done = e.target.checked; if (HAS_LOT2) t.status = t.done ? "terminee" : "planifiee"; after("« " + t.title + " » " + (t.done ? "marquée faite." : "remise à faire."));
  });
  document.addEventListener("keydown", e => {
    if (kb || SCREEN || !e.target.classList || !e.target.classList.contains("task")) return;
    if (e.key === "Enter") { e.preventDefault(); const t = state.tasks.find(x => x.id === e.target.dataset.id); if (t) openForm(t); }
    else if (e.key === " ") { e.preventDefault(); grab(e.target); }
  });

  // ---- navigation au clavier dans la grille : une tabulation pour entrer, puis les flèches de case en case ----
  let cur = { r: 0, c: Math.min(4, (new Date().getDay() + 6) % 7) };
  const cellAt = (r, c) => grid.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
  const cellItems = cell => [...cell.querySelectorAll(".task, .add")];
  function focusCell(r, c) {
    const R = shownRows().length;
    cur = { r: Math.max(0, Math.min(R - 1, r)), c: Math.max(0, Math.min(4, c)) };
    grid.querySelectorAll('.cell[tabindex="0"]').forEach(x => { x.tabIndex = -1; });
    const el = cellAt(cur.r, cur.c); if (el) { el.tabIndex = 0; el.focus(); }
  }
  grid.addEventListener("focusin", e => {
    const cell = e.target.closest(".cell"); if (!cell) return;
    cur = { r: +cell.dataset.r, c: +cell.dataset.c };
    grid.querySelectorAll('.cell[tabindex="0"]').forEach(x => { if (x !== cell) x.tabIndex = -1; });
    cell.tabIndex = 0;
  });
  function changeWeek(n) { monday = addDays(monday, 7 * n); render(); announce("Semaine du " + $("weeklabel").textContent); }
  grid.addEventListener("keydown", e => {
    if (SCREEN || kb || e.altKey || e.metaKey) return;
    const cell = e.target.closest(".cell"); if (!cell) return;
    const r = +cell.dataset.r, c = +cell.dataset.c, k = e.key;
    if (e.target === cell) {
      let nr = r, nc = c;
      if (k === "ArrowLeft") nc--; else if (k === "ArrowRight") nc++;
      else if (k === "ArrowUp") nr--; else if (k === "ArrowDown") nr++;
      else if (k === "Home") { nc = 0; if (e.ctrlKey) nr = 0; }
      else if (k === "End") { nc = 4; if (e.ctrlKey) nr = 99; }
      else if (k === "PageUp" || k === "PageDown") { e.preventDefault(); changeWeek(k === "PageUp" ? -1 : 1); focusCell(r, c); return; }
      else if (k === "Enter" || k === "F2") { e.preventDefault(); cellItems(cell)[0].focus(); return; }
      else return;
      e.preventDefault(); focusCell(nr, nc); return;
    }
    // à l'intérieur d'une case : tâches puis bouton « Ajouter »
    const items = cellItems(cell), i = items.indexOf(e.target);
    if (k === "Escape") { e.preventDefault(); focusCell(r, c); }
    else if (k === "ArrowDown" && i >= 0) { e.preventDefault(); items[Math.min(items.length - 1, i + 1)].focus(); }
    else if (k === "ArrowUp" && i >= 0) { e.preventDefault(); items[Math.max(0, i - 1)].focus(); }
  });

  // ---- déplacer une tâche sans souris : Espace saisit, flèches, Entrée pose, Échap annule ----
  let kb = null; // { id, from, r, c, monday } ; r = nombre de lignes affichées → « Tâches à prendre »
  function describeTarget() {
    const rows = shownRows();
    if (kb.r === rows.length) return "Tâches à prendre.";
    const p = rows[kb.r], di = iso(addDays(monday, kb.c));
    const sum = state.tasks.filter(t => occursOn(t, di) && counts(t) && t.people.includes(p.id) && t.id !== kb.id).reduce((s, t) => s + t.dur, 0);
    return p.name + ", " + dayLabel(di) + " : " + durLabel(sum) + " déjà prévues sur " + DAY_H + " h.";
  }
  function showTarget() { render(); announce(describeTarget()); }
  function grab(el) {
    const t = state.tasks.find(x => x.id === el.dataset.id); if (!t) return;
    const rows = shownRows(), from = el.dataset.from || null;
    let r = rows.findIndex(p => p.id === (from || state.me)); if (r < 0) r = 0;
    let c = from && t.date ? Math.round((parse(t.date) - monday) / 864e5) : cur.c;
    c = Math.max(0, Math.min(4, c));
    kb = { id: t.id, from, r, c, monday };
    if (view !== "grid") { view = "grid"; }
    render();
    announce("« " + t.title + " » saisie. Flèches pour choisir la case, Entrée pour poser, Échap pour annuler. Case actuelle : " + describeTarget());
  }
  function endKb(drop) {
    const k = kb; kb = null;
    const t = state.tasks.find(x => x.id === k.id);
    if (!drop || !t) { monday = k.monday; render(); const el = taskEl(k.id, k.from); if (el) el.focus(); announce("Déplacement annulé."); return; }
    const rows = shownRows();
    const to = k.r < rows.length ? { person: rows[k.r].id, date: iso(addDays(monday, k.c)) } : null;
    if ((to && k.from === to.person && t.date === to.date) || (!to && !k.from)) { render(); const el = taskEl(t.id, k.from); if (el) el.focus(); announce("La tâche reste à sa place."); return; }
    snap("« " + t.title + " » déplacée.");
    moveTask(t, k.from, to);
    after("« " + t.title + " » déplacée : " + (to ? person(to.person).name + ", " + dayLabel(to.date) + "." : "tâches à prendre."), () => {
      const el = taskEl(t.id, to ? to.person : ""); if (el) el.focus();
    });
  }
  document.addEventListener("keydown", e => {
    if (!kb) return;
    const k = e.key, R = shownRows().length;
    e.preventDefault(); e.stopPropagation();
    if (k === "Escape") return endKb(false);
    if (k === "Enter" || k === " ") return endKb(true);
    if (k === "Tab") { announce("Déplacement en cours : Entrée pour poser, Échap pour annuler."); return; }
    if (k === "ArrowLeft") { if (kb.c > 0) kb.c--; else { monday = addDays(monday, -7); kb.c = 4; } }
    else if (k === "ArrowRight") { if (kb.c < 4) kb.c++; else { monday = addDays(monday, 7); kb.c = 0; } }
    else if (k === "ArrowUp") kb.r = Math.max(0, kb.r - 1);
    else if (k === "ArrowDown") kb.r = Math.min(R, kb.r + 1);
    else if (k === "PageUp") monday = addDays(monday, -7);
    else if (k === "PageDown") monday = addDays(monday, 7);
    else if (k === "Home") kb.c = 0;
    else if (k === "End") kb.c = 4;
    else return;
    showTarget();
  }, true);
  document.addEventListener("pointerdown", () => { if (kb) endKb(false); }, true);

  // une tâche commune garde ses autres participants : seule la personne déplacée change
  function moveTask(t, from, to) {
    const rest = t.people.filter(x => x !== from);
    if (to) {
      t.people = from ? rest : []; if (!t.people.includes(to.person)) t.people.push(to.person);
      if (t.fin_date && t.date) t.fin_date = iso(addDays(parse(t.fin_date), Math.round((parse(to.date) - parse(t.date)) / 864e5)));
      t.date = to.date;
    }
    else { t.people = from ? rest : t.people; if (!t.people.length) t.date = null; }
  }

  // ---- glisser-déposer (souris et tactile) ----
  let drag = null;
  document.addEventListener("pointerdown", e => {
    const el = e.target.closest(".task");
    if (!el || e.button > 0 || SCREEN) return;
    drag = { el, id: el.dataset.id, from: el.dataset.from, x: e.clientX, y: e.clientY, moved: false, ghost: null, hot: null };
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
  });
  document.addEventListener("pointermove", e => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      const r = drag.el.getBoundingClientRect();
      drag.ox = drag.x - r.left; drag.oy = drag.y - r.top;
      drag.ghost = drag.el.cloneNode(true);
      drag.ghost.classList.add("ghost");
      drag.ghost.style.width = Math.min(220, r.width) + "px";
      document.body.appendChild(drag.ghost);
      drag.el.classList.add("dragging");
    }
    drag.ghost.style.left = (e.clientX - drag.ox) + "px";
    drag.ghost.style.top = (e.clientY - drag.oy) + "px";
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const zone = under && under.closest("[data-drop]");
    if (zone !== drag.hot) {
      if (drag.hot) drag.hot.classList.remove("drop-hot");
      drag.hot = zone; if (zone) zone.classList.add("drop-hot");
    }
  });
  function endDrag(e, cancelled) {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.ghost) d.ghost.remove();
    if (d.hot) d.hot.classList.remove("drop-hot");
    d.el.classList.remove("dragging");
    const t = state.tasks.find(x => x.id === d.id);
    if (!t) return;
    if (!d.moved) { if (!cancelled) openForm(t); return; }
    if (cancelled || !d.hot) return;
    snap("« " + t.title + " » déplacée.");
    const to = d.hot.dataset.drop === "cell" ? { person: d.hot.dataset.person, date: d.hot.dataset.date } : null;
    moveTask(t, d.from, to);
    after("« " + t.title + " » déplacée : " + (to ? person(to.person).name + ", " + dayLabel(to.date) + "." : "tâches à prendre."));
  }
  document.addEventListener("pointerup", e => endDrag(e, false));
  document.addEventListener("pointercancel", e => endDrag(e, true));

  // ---- connexion ----
  $("login").addEventListener("submit", async e => {
    e.preventDefault();
    const email = $("login-email").value.trim();
    $("login-err").hidden = true;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { $("login-err").textContent = "Adresse email invalide."; $("login-err").hidden = false; return; }
    $("login-btn").disabled = true;
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
    $("login-btn").disabled = false;
    if (error) { $("login-err").textContent = "Envoi impossible : " + error.message; $("login-err").hidden = false; return; }
    $("gate-msg").innerHTML = `<span class="ok">Email envoyé à ${esc(email)}.</span> Cliquez sur le lien de l'email, ou tapez ci-dessous le code qu'il contient.`;
    $("code-form").hidden = false; $("code-btn").hidden = false;
    $("login-code").focus();
  });
  $("code-form").addEventListener("submit", async e => {
    e.preventDefault();
    const email = $("login-email").value.trim();
    const token = $("login-code").value.replace(/\D/g, "");
    $("code-err").hidden = true;
    if (token.length < 6) { $("code-err").textContent = "Le code fait au moins 6 chiffres."; $("code-err").hidden = false; return; }
    $("code-btn").disabled = true;
    const { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
    $("code-btn").disabled = false;
    if (error) { $("code-err").textContent = "Code refusé (faux ou expiré). Redemandez un email si besoin."; $("code-err").hidden = false; return; }
  });
  $("logout").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });

  let channel = null, started = false;
  async function start(session) {
    if (!session) { $("app").hidden = true; $("gate").hidden = false; document.title = "Connexion · Planning de l'équipe"; return; }
    if (started) return;
    started = true;
    const { data: me } = await sb.from("team").select("id").ilike("email", session.user.email).maybeSingle();
    if (!me) {
      started = false;
      $("gate").hidden = false; $("app").hidden = true;
      $("gate-msg").textContent = "L'adresse " + session.user.email + " ne fait pas partie de l'équipe. Demandez à l'administrateur de l'ajouter, puis reconnectez-vous.";
      $("login").hidden = true; $("login-btn").textContent = "Se déconnecter";
      $("login-btn").onclick = async () => { await sb.auth.signOut(); location.reload(); };
      return;
    }
    state.me = me.id;
    $("me-name").textContent = person(me.id) ? person(me.id).name : me.id;
    $("gate").hidden = true; $("app").hidden = false;
    if (!SCREEN) document.title = "Planning de l'équipe";
    const probe = await sb.from("tasks").select("debut,fin").limit(1);
    HAS_TIMES = !probe.error;
    const l2 = await sb.from("tasks").select(LOT2.join(",")).limit(1);
    HAS_LOT2 = !l2.error;
    await loadRefs();
    const hist = await sb.from("historique").select("id").limit(1);
    HAS_HISTORY = !hist.error;
    const team = await sb.from("team").select("id,email");
    if (!team.error && team.data) team.data.forEach(m => { EMAIL_NAME[String(m.email).toLowerCase()] = person(m.id) ? person(m.id).name : m.id; });
    // modifications faites hors connexion lors d'une visite précédente : on les reprend avant de relire la base
    try {
      const saved = JSON.parse(localStorage.getItem(QKEY) || "null");
      if (saved && Array.isArray(saved.tasks)) { state.tasks = saved.tasks.filter(t => t && t.id != null).map(t => Object.assign(norm(t), { updated_at: t.updated_at || null })); synced = new Map(saved.synced); }
    } catch (_) {}
    await fetchTasks();
    let timer = null;
    channel = sb.channel("tasks-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => { clearTimeout(timer); timer = setTimeout(() => saving.then(fetchTasks), 300); })
      // après une coupure (wifi, mise en veille), le direct se reconnecte seul : on relit tout pour ne rien rater
      .subscribe(status => { if (status === "SUBSCRIBED" && lastOk) saving.then(fetchTasks); });

    // filet de sécurité : relecture toutes les 2 minutes, au retour du réseau et quand la page redevient visible
    const refresh = () => { if (document.visibilityState === "visible" && !dlg && !drag && !kb) saving.then(fetchTasks); };
    setInterval(() => { if (navigator.onLine && localDiff().length) save(); }, 30000);
    setInterval(refresh, 120000);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    // passage au jour suivant : la colonne « aujourd'hui » avance, et l'écran mural suit la semaine en cours
    let dayShown = iso(new Date());
    setInterval(() => {
      if (iso(new Date()) === dayShown) return;
      dayShown = iso(new Date());
      if (SCREEN) monday = currentMonday();
      render(); refresh();
    }, 30000);
  }
  sb.auth.onAuthStateChange((_evt, session) => { start(session); });
  sb.auth.getSession().then(({ data }) => start(data.session));
})();
