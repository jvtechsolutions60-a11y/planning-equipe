// Récap de la semaine suivante, envoyé par email à chaque membre de l'équipe le vendredi à 12 h (heure de Paris).
// Secrets à définir dans Supabase > Edge Functions > Secrets :
//   RESEND_API_KEY  clé API Resend
//   MAIL_FROM       expéditeur, ex. "Planning <planning@votre-domaine.fr>" (domaine vérifié dans Resend)
//   APP_URL         adresse du planning, ex. https://planning-equipe.vercel.app
//   CRON_SECRET     valeur libre, identique à celle de supabase/cron.sql
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par Supabase.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

type Task = { id: string; title: string; client: string; dur: number; date: string | null; people: string[]; done: boolean };
type Member = { id: string; name: string; email: string };

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const hours = (n: number) => { const h = Math.floor(n), m = Math.round((n - h) * 60); return `${h} h${m ? " " + pad(m) : ""}`; };

// date et heure actuelles à Paris
function parisNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false, weekday: "short",
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { date: new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day)), hour: +parts.hour, weekday: parts.weekday };
}

function emailHtml(member: Member, days: Date[], tasks: Task[], team: Member[], backlog: Task[], appUrl: string) {
  const name = (id: string) => team.find((m) => m.id === id)?.name ?? id;
  const mine = tasks.filter((t) => t.people.includes(member.id));
  const total = mine.reduce((s, t) => s + Number(t.dur), 0);
  const rows = days.map((d, i) => {
    const di = iso(d);
    const ts = mine.filter((t) => t.date === di);
    const items = ts.length
      ? ts.map((t) => {
          const others = t.people.filter((p) => p !== member.id).map(name);
          return `<li style="margin:2px 0"><b>${esc(t.title)}</b>${t.client ? ` · ${esc(t.client)}` : ""} · ${hours(Number(t.dur))}${others.length ? ` · avec ${esc(others.join(", "))}` : ""}</li>`;
        }).join("")
      : `<li style="color:#5d6779;list-style:none">Rien de prévu</li>`;
    const sum = ts.reduce((s, t) => s + Number(t.dur), 0);
    return `<tr><td style="padding:10px 0;border-top:1px solid #d9dee7;vertical-align:top;width:120px">
      <b>${DAYS[i]}</b><br><span style="color:#5d6779;font-size:13px">${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${sum ? ` · ${hours(sum)}` : ""}</span></td>
      <td style="padding:10px 0;border-top:1px solid #d9dee7"><ul style="margin:0;padding-left:18px">${items}</ul></td></tr>`;
  }).join("");
  const back = backlog.length
    ? `<p style="margin:20px 0 6px"><b>${backlog.length} tâche${backlog.length > 1 ? "s" : ""} à prendre</b></p><ul style="margin:0;padding-left:18px">${
        backlog.map((t) => `<li>${esc(t.title)}${t.client ? ` · ${esc(t.client)}` : ""} · ${hours(Number(t.dur))}</li>`).join("")}</ul>`
    : "";
  const first = days[0], last = days[4];
  return `<div style="font-family:Segoe UI,Arial,sans-serif;color:#18202e;max-width:600px">
    <p style="color:#2f55d4;margin:0">Planning de l'équipe</p>
    <h1 style="font-size:22px;margin:4px 0 4px">Votre semaine du ${first.getUTCDate()} au ${last.getUTCDate()} ${MONTHS[last.getUTCMonth()]}</h1>
    <p style="margin:0 0 12px;color:#5d6779">Bonjour ${esc(member.name)}, vous avez <b style="color:#18202e">${hours(total)}</b> prévues sur 35 h.</p>
    <table style="border-collapse:collapse;width:100%">${rows}</table>
    ${back}
    <p style="margin:24px 0 0"><a href="${appUrl}" style="background:#2f55d4;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Ouvrir le planning</a></p>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) return new Response("Accès refusé", { status: 401 });
  const force = new URL(req.url).searchParams.get("force") === "1";
  const now = parisNow();
  if (!force && !(now.weekday === "Fri" && now.hour === 12)) return new Response("Pas l'heure du récap", { status: 200 });

  // semaine suivante : du lundi au vendredi
  const wd = (now.date.getUTCDay() + 6) % 7;
  const monday = new Date(now.date); monday.setUTCDate(monday.getUTCDate() + (7 - wd));
  const days = [0, 1, 2, 3, 4].map((i) => { const d = new Date(monday); d.setUTCDate(d.getUTCDate() + i); return d; });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const [{ data: team, error: e1 }, { data: tasks, error: e2 }, { data: backlog, error: e3 }] = await Promise.all([
    db.from("team").select("id,name,email"),
    db.from("tasks").select("*").gte("date", iso(days[0])).lte("date", iso(days[4])),
    db.from("tasks").select("*").or("date.is.null,people.eq.{}"),
  ]);
  if (e1 || e2 || e3) return new Response(JSON.stringify(e1 || e2 || e3), { status: 500 });

  const appUrl = Deno.env.get("APP_URL") ?? "";
  const results = [];
  for (const m of team as Member[]) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("MAIL_FROM"),
        to: m.email,
        subject: `Votre planning de la semaine du ${days[0].getUTCDate()} ${MONTHS[days[0].getUTCMonth()]}`,
        html: emailHtml(m, days, tasks as Task[], team as Member[], backlog as Task[], appUrl),
      }),
    });
    results.push({ to: m.email, status: res.status });
  }
  return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
});
