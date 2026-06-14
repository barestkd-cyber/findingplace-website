/* ─────────────────────────────────────────────
   THE FINDING PLACE — shared script
   Lead form -> Supabase, nav toggle
   ───────────────────────────────────────────── */

/* ⚠️ SETUP: paste your Supabase project values here.
   Supabase Dashboard -> Project Settings -> API.
   The anon key is SAFE to expose in frontend code —
   row level security policies control what it can do. */
const SUPABASE_URL = 'PASTE_YOUR_SUPABASE_URL_HERE';      // e.g. https://xxxx.supabase.co
const SUPABASE_ANON_KEY = 'PASTE_YOUR_ANON_KEY_HERE';

/* ── NAV TOGGLE (mobile) ── */
function toggleNav() {
  document.querySelector('.nav-links').classList.toggle('open');
}

/* ── LEAD FORM ── */
async function submitLead(event, formId) {
  event.preventDefault();
  const form = document.getElementById(formId);
  const btn = form.querySelector('.form-submit');
  const status = form.querySelector('.form-status');

  const get = (name) => {
    const el = form.querySelector(`[name="${name}"]`);
    return el ? el.value.trim() : '';
  };

  const lead = {
    cfname: get('child_first'),
    clname: get('child_last'),
    cage: get('child_age') ? parseInt(get('child_age')) : null,
    pfname: get('parent_first'),
    plname: get('parent_last'),
    email: get('email'),
    phone: get('phone'),
    notes: get('notes'),
    source: 'website'
  };

  if (!lead.cfname || !lead.pfname || !lead.plname || !lead.email) {
    status.textContent = 'Please fill in the required fields.';
    status.className = 'form-status err';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending...';
  status.className = 'form-status';

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(lead)
    });

    if (!res.ok) throw new Error('Request failed: ' + res.status);

    form.reset();
    status.textContent = "Thank you! We received your inquiry and we'll be in touch soon. 🌿";
    status.className = 'form-status ok';
    btn.textContent = 'Sent!';
  } catch (err) {
    console.error(err);
    status.textContent = 'Something went wrong. Please try again or call us directly.';
    status.className = 'form-status err';
    btn.disabled = false;
    btn.textContent = 'Request a Tour';
  }
}
