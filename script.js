/* ─────────────────────────────────────────────
   THE FINDING PLACE — shared script
   Lead form -> Supabase, nav toggle
   ───────────────────────────────────────────── */

/* The publishable key is SAFE to expose in frontend code — row level security
   is what protects the data. The `leads` table grants anon INSERT only and has
   no SELECT policy, so the public can submit a lead but never read one back.
   Never put the service_role key here. */
const SUPABASE_URL = 'https://gyiwcrqtybvfszkckveh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0eWsBHipzkU3dFUdm5hvBw_L3E4C6cX';

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
