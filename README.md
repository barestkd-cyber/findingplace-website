# The Finding Place — Website Setup

Six-page static site, GitHub Pages ready. Lead form writes to Supabase; Resend sends the "new lead" notification email.

## Files
- index.html — home, hero + lead form
- about.html — story/philosophy (most placeholder copy to personalize)
- programs.html — daily rhythm, ages, enrollment
- nature-school-tyler-tx.html — SEO landing page (~520 words draft)
- reggio-inspired-school-tyler-tx.html — SEO landing page (~540 words draft, includes natural Reggio mentions)
- contact.html — tour request form
- styles.css / script.js — shared
- sitemap.xml / robots.txt

## Before launch checklist
1. Find/replace placeholders in all pages: [STREET ADDRESS], [ZIP], [PHONE], [EMAIL ADDRESS], [Founder's Name], ages/hours/days in programs.html
2. Replace `https://www.thefindingplace.com` everywhere (canonical tags, sitemap, robots) with the real domain once purchased
3. Mom reviews/rewrites draft copy — marked with ✏️ HTML comments in each file
4. Add real photos (hero, about page especially)
5. Paste Supabase values into script.js (see below)

## Supabase setup (one time, ~15 min)

Create project, then run this in the SQL editor:

```sql
create table leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  cfname text not null,
  clname text,
  cage int,
  pfname text not null,
  plname text not null,
  email text not null,
  phone text,
  notes text,
  source text default 'website',
  status text default 'new'
);

alter table leads enable row level security;

-- Anyone (anon) may INSERT a lead via the website form. Nobody anon may read.
create policy "public can submit leads"
  on leads for insert
  to anon
  with check (true);
```

No SELECT policy for anon = website visitors can submit but never read leads. The CRM will read them later using an authenticated role.

Then paste the project URL and anon key into the two constants at the top of script.js.

## Resend "new lead" email (optional now, recommended)

Supabase Edge Function triggered by a database webhook on `leads` INSERT:

1. Supabase Dashboard -> Database -> Webhooks -> create webhook on `leads` table, INSERT events, pointing to an Edge Function (e.g. `notify-lead`)
2. Edge function body (Deno):

```ts
Deno.serve(async (req) => {
  const payload = await req.json();
  const lead = payload.record;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'The Finding Place <leads@YOURDOMAIN.com>',
      to: ['MOM_EMAIL_HERE'],
      subject: `New tour request: ${lead.pfname} ${lead.plname}`,
      html: `<p><strong>${lead.pfname} ${lead.plname}</strong> requested a tour.</p>
             <p>Child: ${lead.cfname} ${lead.clname ?? ''}, age ${lead.cage ?? '—'}</p>
             <p>Email: ${lead.email}<br>Phone: ${lead.phone ?? '—'}</p>
             <p>Notes: ${lead.notes ?? '—'}</p>`
    })
  });
  return new Response('ok');
});
```

3. Set RESEND_API_KEY as an Edge Function secret (never in frontend code)
4. Verify the domain in Resend before sending from it (same flow as 4K)

## Deploy
New repo (suggest: `findingplace-website`), push these files to main, enable GitHub Pages. Point the custom domain when purchased. Keep the CRM in a separate repo as planned.

## SEO after launch
- Submit sitemap in Google Search Console
- Create a Google Business Profile (this matters as much as the website for "school near me" searches)
- Keep each landing page's copy genuine and 400+ words — already drafted to that spec
