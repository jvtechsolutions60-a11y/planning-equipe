// Récap de la semaine suivante, envoyé par email à chaque membre de l'équipe.
// Lancé par .github/workflows/recap-hebdo.yml le vendredi à 12 h (heure de Paris).
// Secrets GitHub nécessaires : SUPABASE_SECRET_KEY, SMTP_HOST, SMTP_USER, SMTP_PASS.
import nodemailer from "nodemailer";

const SUPABASE_URL = "https://fjnhuytztxxpbdajvhbq.supabase.co";
const APP_URL = "https://jvtechsolutions60-a11y.github.io/planning-equipe/";
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

const env = (k) => { const v = process.env[k]; if (!v) throw new Error(`Secret manquant : ${k}`); return v; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const hours = (n) => { const h = Math.floor(n), m = Math.round((n - h) * 60); return `${h} h${m ? " " + pad(m) : ""}`; };

// date du jour et décalage horaire à Paris
function paris() {
  const now = new Date();
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  }).formatToParts(now).map((x) => [x.type, x.value]));
  const date = new Date(Date.UTC(+p.year, +p.month - 1, +p.day));
  const offset = ((+p.hour - now.getUTCHours()) + 24) % 24; // 1 en hiver, 2 en été
  return { date, offset };
}

async function rest(path) {
  const key = env("SUPABASE_SECRET_KEY");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}) } });
  if (!res.ok) throw new Error(`Supabase ${res.status} : ${await res.text()}`);
  return res.json();
}

function emailHtml(member, days, tasks, team, backlog) {
  const name = (id) => team.find((m) => m.id === id)?.name ?? id;
  const mine = tasks.filter((t) => t.people.includes(member.id));
  const total = mine.reduce((s, t) => s + Number(t.dur), 0);
  const rows = days.map((d, i) => {
    const ts = mine.filter((t) => t.date === iso(d));
    const sum = ts.reduce((s, t) => s + Number(t.dur), 0);
    const items = ts.length
      ? ts.map((t) => {
          const others = t.people.filter((p) => p !== member.id).map(name);
          return `<li style="margin:2px 0"><b>${esc(t.title)}</b>${t.client ? ` · ${esc(t.client)}` : ""} · ${hours(Number(t.dur))}${others.length ? ` · avec ${esc(others.join(", "))}` : ""}</li>`;
        }).join("")
      : `<li style="color:#5d6779;list-style:none">Rien de prévu</li>`;
    return `<tr><td style="padding:10px 0;border-top:1px solid #d9dee7;vertical-align:top;width:120px"><b>${DAYS[i]}</b><br>
      <span style="color:#5d6779;font-size:13px">${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${sum ? ` · ${hours(sum)}` : ""}</span></td>
      <td style="padding:10px 0;border-top:1px solid #d9dee7"><ul style="margin:0;padding-left:18px">${items}</ul></td></tr>`;
  }).join("");
  const back = backlog.length
    ? `<p style="margin:20px 0 6px"><b>${backlog.length} tâche${backlog.length > 1 ? "s" : ""} à prendre</b></p><ul style="margin:0;padding-left:18px">${
        backlog.map((t) => `<li>${esc(t.title)}${t.client ? ` · ${esc(t.client)}` : ""} · ${hours(Number(t.dur))}</li>`).join("")}</ul>`
    : "";
  return `<div style="font-family:Segoe UI,Arial,sans-serif;color:#18202e;max-width:600px">
    <p style="color:#2f55d4;margin:0">Planning de l'équipe</p>
    <h1 style="font-size:22px;margin:4px 0">Votre semaine du ${days[0].getUTCDate()} au ${days[4].getUTCDate()} ${MONTHS[days[4].getUTCMonth()]}</h1>
    <p style="margin:0 0 12px;color:#5d6779">Bonjour ${esc(member.name)}, vous avez <b style="color:#18202e">${hours(total)}</b> prévues sur 35 h.</p>
    <table style="border-collapse:collapse;width:100%">${rows}</table>
    ${back}
    <p style="margin:24px 0 0"><a href="${APP_URL}" style="background:#2f55d4;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Ouvrir le planning</a></p>
  </div>`;
}

const { date, offset } = paris();
// GitHub lance deux horaires (10 h et 11 h UTC) : on garde celui qui tombe à 12 h à Paris
const trigger = process.env.TRIGGER_SCHEDULE || "";
const expected = offset === 2 ? "0 10 * * 5" : "0 11 * * 5";
if (trigger && trigger !== expected) { console.log(`Horaire ${trigger} ignoré (heure de Paris : UTC+${offset}).`); process.exit(0); }

// semaine suivante, du lundi au vendredi
const wd = (date.getUTCDay() + 6) % 7;
const monday = new Date(date); monday.setUTCDate(monday.getUTCDate() + (7 - wd));
const days = [0, 1, 2, 3, 4].map((i) => { const d = new Date(monday); d.setUTCDate(d.getUTCDate() + i); return d; });

const [team, tasks, backlog] = await Promise.all([
  rest("team?select=id,name,email"),
  rest(`tasks?select=*&date=gte.${iso(days[0])}&date=lte.${iso(days[4])}`),
  rest("tasks?select=*&or=(date.is.null,people.eq.{})"),
]);

const smtpUser = env("SMTP_USER");
const mailer = nodemailer.createTransport({ host: env("SMTP_HOST"), port: 465, secure: true, auth: { user: smtpUser, pass: env("SMTP_PASS") } });
const only = process.env.ONLY_TO; // test : n'envoyer qu'à une adresse
for (const m of team) {
  if (only && m.email.toLowerCase() !== only.toLowerCase()) continue;
  await mailer.sendMail({
    from: `Planning de l'équipe <${smtpUser}>`,
    to: m.email,
    subject: `Votre planning de la semaine du ${days[0].getUTCDate()} ${MONTHS[days[0].getUTCMonth()]}`,
    html: emailHtml(m, days, tasks, team, backlog),
  });
  console.log(`Envoyé à ${m.name}`);
}
