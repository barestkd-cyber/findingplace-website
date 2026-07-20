// Supabase Edge Function: notify-lead
// Fired by a database webhook on INSERT into `leads`.
// Emails the new lead to the school via Resend.
//
// Secret required (set in the Supabase dashboard, never in code):
//   RESEND_API_KEY

const TO = ["racebares@gmail.com", "mommabares13@gmail.com"];
const FROM = "The Finding Place <info@thefinding.place>";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

function row(label: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  return `<tr>
    <td style="padding:6px 14px 6px 0;color:#6e6058;font-size:14px;white-space:nowrap;vertical-align:top;">${esc(label)}</td>
    <td style="padding:6px 0;color:#3a3228;font-size:15px;font-weight:600;">${esc(value)}</td>
  </tr>`;
}

Deno.serve(async (req) => {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return new Response("RESEND_API_KEY not set", { status: 500 });

  let lead: Record<string, unknown>;
  try {
    const payload = await req.json();
    lead = payload.record ?? payload;
  } catch {
    return new Response("bad payload", { status: 400 });
  }

  const isTour = lead.source === "website_tour";
  const parent = `${lead.pfname ?? ""} ${lead.plname ?? ""}`.trim();
  const child = `${lead.cfname ?? ""} ${lead.clname ?? ""}`.trim();
  const programs = Array.isArray(lead.programs) ? lead.programs.join(", ") : "";

  const subject = isTour
    ? `Tour request: ${parent} — ${lead.tour_text ?? "date TBC"}`
    : `Question from ${parent}`;

  const headline = isTour ? "New tour request" : "New question";

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f4f1ea;padding:28px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #ddeedd;border-radius:14px;padding:28px 26px;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8aab8a;font-weight:700;">The Finding Place</p>
      <h1 style="margin:0 0 18px;font-size:22px;color:#3a6347;">${esc(headline)}</h1>

      ${isTour ? `<p style="margin:0 0 18px;padding:12px 16px;background:#eef4ee;border-left:4px solid #8aab8a;border-radius:0 8px 8px 0;font-size:15px;color:#3a6347;">
        <strong>${esc(lead.tour_text ?? "")}</strong>
      </p>` : ""}

      <table style="width:100%;border-collapse:collapse;">
        ${row("Parent", parent)}
        ${row("Email", lead.email)}
        ${row("Phone", lead.phone)}
        ${row("Child", child)}
        ${row("Child's age", lead.cage)}
        ${row("Interested in", programs)}
      </table>

      ${lead.notes ? `<p style="margin:18px 0 0;padding-top:16px;border-top:1px solid #ddeedd;font-size:15px;color:#3a3228;white-space:pre-wrap;">${esc(lead.notes)}</p>` : ""}

      <p style="margin:22px 0 0;font-size:13px;color:#a09080;">Reply to this email to reach the family directly.</p>
    </div>
  </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: TO,
      reply_to: lead.email ? [String(lead.email)] : TO,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("Resend failed:", res.status, detail);
    return new Response(`resend error: ${detail}`, { status: 502 });
  }

  return new Response("ok");
});
