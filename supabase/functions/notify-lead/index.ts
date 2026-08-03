// Supabase Edge Function: notify-lead
// Fired by a database webhook on INSERT into `leads`.
// Sends TWO emails via Resend:
//   1. to the school  — the new lead's details
//   2. to the parent  — a confirmation that their request was received
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

function shell(inner: string): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f4f1ea;padding:28px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #ddeedd;border-radius:14px;padding:28px 26px;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8aab8a;font-weight:700;">The Finding Place</p>
      ${inner}
    </div>
  </div>`;
}

async function send(key: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
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
  const parentEmail = lead.email ? String(lead.email) : "";

  // ── 1. Email to the school ────────────────────────────────────────────
  const staffInner = `
      <h1 style="margin:0 0 18px;font-size:22px;color:#3a6347;">${isTour ? "New tour request" : "New question"}</h1>
      ${isTour ? `<p style="margin:0 0 18px;padding:12px 16px;background:#eef4ee;border-left:4px solid #8aab8a;border-radius:0 8px 8px 0;font-size:15px;color:#3a6347;">
        <strong>${esc(lead.tour_text ?? "")}</strong>
      </p>` : ""}
      <table style="width:100%;border-collapse:collapse;">
        ${row("Parent", parent)}
        ${row("Email", lead.email)}
        ${row("Phone", lead.phone)}
        ${row("Child", child)}
        ${row("Age by Sept 1", lead.cage)}
        ${row("Interested in", programs)}
      </table>
      ${lead.notes ? `<p style="margin:18px 0 0;padding-top:16px;border-top:1px solid #ddeedd;font-size:15px;color:#3a3228;white-space:pre-wrap;">${esc(lead.notes)}</p>` : ""}
      <p style="margin:22px 0 0;font-size:13px;color:#a09080;">Reply to this email to reach the family directly.</p>`;

  const staffEmail = {
    from: FROM,
    to: TO,
    reply_to: parentEmail ? [parentEmail] : TO,
    subject: isTour
      ? `Tour request: ${parent} — ${lead.tour_text ?? "date TBC"}`
      : `Question from ${parent}`,
    html: shell(staffInner),
  };

  // ── 2. Confirmation email to the parent ───────────────────────────────
  const firstName = String(lead.pfname ?? "").trim() || "there";
  const parentInner = isTour
    ? `<h1 style="margin:0 0 14px;font-size:22px;color:#3a6347;">We received your tour request 🌿</h1>
       <p style="margin:0 0 16px;font-size:15px;color:#3a3228;line-height:1.6;">Hi ${esc(firstName)}, thank you for your interest in The Finding Place! We've received your request to tour on:</p>
       <p style="margin:0 0 16px;padding:12px 16px;background:#eef4ee;border-left:4px solid #8aab8a;border-radius:0 8px 8px 0;font-size:16px;color:#3a6347;"><strong>${esc(lead.tour_text ?? "")}</strong></p>
       <p style="margin:0 0 16px;font-size:15px;color:#3a3228;line-height:1.6;">This is a request, not a confirmed booking yet — we'll reach out personally to confirm your time and share directions and anything else you'll need.</p>
       <p style="margin:0 0 16px;font-size:15px;color:#3a3228;line-height:1.6;"><strong>Please plan to bring your child with you.</strong> Meeting your child is an important part of the visit, so choose a time you can both attend together.</p>
       <p style="margin:0 0 4px;font-size:15px;color:#3a3228;line-height:1.6;">Warmly,</p>
       <p style="margin:0;font-size:15px;color:#3a3228;line-height:1.6;">Mimzy &amp; the team at The Finding Place<br><a href="tel:903-570-8341" style="color:#4a7c59;">903-570-8341</a></p>`
    : `<h1 style="margin:0 0 14px;font-size:22px;color:#3a6347;">Thanks for reaching out 🌿</h1>
       <p style="margin:0 0 16px;font-size:15px;color:#3a3228;line-height:1.6;">Hi ${esc(firstName)}, thank you for your interest in The Finding Place! We've received your message and will get back to you within a day or two.</p>
       <p style="margin:0 0 16px;font-size:15px;color:#3a3228;line-height:1.6;">If it's easier, you're always welcome to call us at <a href="tel:903-570-8341" style="color:#4a7c59;">903-570-8341</a>.</p>
       <p style="margin:0 0 4px;font-size:15px;color:#3a3228;line-height:1.6;">Warmly,</p>
       <p style="margin:0;font-size:15px;color:#3a3228;line-height:1.6;">Mimzy &amp; the team at The Finding Place</p>`;

  const parentConfirmation = parentEmail
    ? {
        from: FROM,
        to: [parentEmail],
        reply_to: TO,
        subject: isTour ? "Your tour request at The Finding Place" : "We received your message — The Finding Place",
        html: shell(parentInner),
      }
    : null;

  // Send the staff email first — it's the one that must not be lost. The parent
  // confirmation is best-effort: if it fails, we still return ok so the lead
  // isn't retried and double-notified.
  try {
    await send(key, staffEmail);
  } catch (err) {
    console.error("Staff email failed:", err);
    return new Response(`resend error: ${err}`, { status: 502 });
  }

  if (parentConfirmation) {
    try {
      await send(key, parentConfirmation);
    } catch (err) {
      console.error("Parent confirmation failed (staff was notified):", err);
    }
  }

  return new Response("ok");
});
