/* ─────────────────────────────────────────────
   THE FINDING PLACE — tour.js

   Two separate entry points, no chooser screen:

     [data-tour-open]  -> straight to the tour time picker -> details -> done
     [data-info-open]  -> programs of interest -> details -> done

   Renders inline wherever [data-tour-inline] exists (home + contact) and as
   a modal from any CTA. Each instance owns its own state, so the modal and
   the inline copy never step on each other.
   Submits to the same Supabase `leads` table the old form used.
   ───────────────────────────────────────────── */
(function () {
  "use strict";

  /* ⚠️ TOUR TIMES — replace with the real ones.
     dow: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat */
  var TOUR_PATTERN = [
    { dow: 2, h: 9,  m: 30 },
    { dow: 3, h: 9,  m: 30 },
    { dow: 4, h: 13, m: 45 }
  ];

  /* ⚠️ PROGRAMS — confirm these labels. */
  var PROGRAMS = [
    { key: "age3", label: "Age 3",         desc: "Tuesday–Thursday, 8:30 AM – 1:30 PM" },
    { key: "age4", label: "Age 4 / Pre-K", desc: "Monday–Thursday, 8:30 AM – 1:30 PM" },
    { key: "k",    label: "Kindergarten",  desc: "Monday–Thursday, 8:30 AM – 1:30 PM" },
    { key: "g13",  label: "Grades 1–3",    desc: "Monday–Thursday, 8:30 AM – 1:30 PM" },
    { key: "stay", label: "Stay & Play",   desc: "Optional · Tuesdays & Wednesdays, 1:30 – 3:00 PM" }
  ];

  var PHONE = "903-570-8341";
  var WEEKS_OUT = 6;
  var DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Reuse the credentials from script.js when it loaded first.
  function sbUrl() { return (typeof SUPABASE_URL !== "undefined") ? SUPABASE_URL : ""; }
  function sbKey() { return (typeof SUPABASE_ANON_KEY !== "undefined") ? SUPABASE_ANON_KEY : ""; }
  function sbReady() {
    var u = sbUrl();
    return !!u && u.indexOf("PASTE_YOUR") !== 0;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c];
    });
  }

  function fmtTime(h, m) {
    var ap = h >= 12 ? "PM" : "AM";
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ":" + (m < 10 ? "0" : "") + m + " " + ap;
  }

  function midnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  function slotsOnDate(d) {
    var now = new Date(), out = [];
    TOUR_PATTERN.forEach(function (t) {
      if (t.dow !== d.getDay()) return;
      var when = new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.h, t.m);
      if (when.getTime() <= now.getTime()) return;
      out.push({
        iso: when.toISOString(),
        dateText: DOW[when.getDay()] + ", " + MON[when.getMonth()] + " " + when.getDate(),
        timeText: fmtTime(t.h, t.m),
        mins: t.h * 60 + t.m
      });
    });
    out.sort(function (a, b) { return a.mins - b.mins; });
    return out;
  }

  /* ═════ one self-contained flow, bound to `root` ═════════════════════ */
  function createFlow(root, opts) {
    opts = opts || {};
    var isModal = !!opts.isModal;
    var state;

    function reset(path) {
      state = { path: path || "tour", picked: [], slot: null, weekOffset: 0 };
    }

    function setBody(html) { root.querySelector(".tour-body").innerHTML = html; }
    function q(sel) { return root.querySelector(sel); }
    function qa(sel) { return root.querySelectorAll(sel); }

    function head(title, eyebrow) {
      return '<p class="tour-eyebrow">' + esc(eyebrow || "Schedule a Tour") + '</p>' +
             '<h2 class="tour-h">' + esc(title) + '</h2>';
    }

    /* ---- tour path: prefilled tour times ----------------------------- */
    function renderScheduler() {
      var base = midnight(new Date());
      var w = state.weekOffset;
      var start = new Date(base.getFullYear(), base.getMonth(), base.getDate() + w * 7);
      var end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);

      var html = head("Choose a tour time", "Step 1 of 2");
      html += '<p class="tour-sub">Tours run about forty-five minutes. Children are welcome.</p>';
      html += '<p class="tour-weeklabel">' + esc(MON[start.getMonth()] + " " + start.getDate() + " – " + MON[end.getMonth()] + " " + end.getDate()) + '</p>';
      html += '<div class="tour-cal">';
      var any = false;
      for (var i = 0; i < 7; i++) {
        var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        if (d.getDay() === 0 || d.getDay() === 6) continue;
        var slots = slotsOnDate(d);
        if (slots.length) any = true;
        html += '<div class="tour-day"><div class="tour-day__label">' +
                esc(DOW[d.getDay()].slice(0,3) + ", " + MON[d.getMonth()] + " " + d.getDate()) +
                '</div><div class="tour-day__slots">';
        if (!slots.length) {
          html += '<span class="tour-day__empty">No tours</span>';
        } else {
          slots.forEach(function (s) {
            html += '<button class="tour-slot" type="button" data-iso="' + esc(s.iso) +
                    '" data-date="' + esc(s.dateText) + '" data-time="' + esc(s.timeText) + '">' +
                    esc(s.timeText) + '</button>';
          });
        }
        html += '</div></div>';
      }
      html += '</div>';
      if (!any) html += '<p class="tour-note">Nothing open this week — try the next one.</p>';
      html += '<div class="tour-actions">';
      if (w > 0) html += '<button class="btn btn-outline tour-prevweek" type="button">Previous week</button>';
      html += '<button class="btn btn-outline tour-nextweek" type="button"' + (w >= WEEKS_OUT - 1 ? " disabled" : "") + '>Next week</button>';
      html += '</div>';
      setBody(html);

      var pw = q(".tour-prevweek");
      if (pw) pw.addEventListener("click", function () {
        if (state.weekOffset > 0) { state.weekOffset--; renderScheduler(); }
      });
      var nw = q(".tour-nextweek");
      if (nw) nw.addEventListener("click", function () {
        if (state.weekOffset < WEEKS_OUT - 1) { state.weekOffset++; renderScheduler(); }
      });
      qa(".tour-slot").forEach(function (b) {
        b.addEventListener("click", function () {
          state.slot = {
            iso: b.getAttribute("data-iso"),
            dateText: b.getAttribute("data-date"),
            timeText: b.getAttribute("data-time")
          };
          renderIntake();
        });
      });
    }

    /* ---- info path: programs of interest ----------------------------- */
    function renderPrograms() {
      var html = head("What are you curious about?", "More Information");
      html += '<p class="tour-sub">Choose any that apply and we&rsquo;ll tailor what we send you.</p>';
      html += '<div class="tour-options">';
      PROGRAMS.forEach(function (p) {
        var on = state.picked.indexOf(p.key) >= 0;
        html += '<button class="tour-option tour-toggle" type="button" role="checkbox" aria-checked="' + (on ? "true" : "false") + '" data-key="' + p.key + '">' +
                  '<span class="tour-box" aria-hidden="true"></span>' +
                  '<span class="tour-option__text">' +
                    '<span class="tour-option__name">' + esc(p.label) + '</span>' +
                    '<span class="tour-option__sub">' + esc(p.desc) + '</span>' +
                  '</span></button>';
      });
      html += '</div>';
      html += '<div class="tour-actions">' +
                '<button class="btn btn-primary tour-next" type="button" disabled>Continue</button>' +
              '</div>';
      setBody(html);

      function refresh() {
        qa("[data-key]").forEach(function (b) {
          b.setAttribute("aria-checked", state.picked.indexOf(b.getAttribute("data-key")) >= 0 ? "true" : "false");
        });
        q(".tour-next").disabled = state.picked.length === 0;
      }
      qa("[data-key]").forEach(function (b) {
        b.addEventListener("click", function () {
          var k = b.getAttribute("data-key");
          var i = state.picked.indexOf(k);
          if (i >= 0) state.picked.splice(i, 1); else state.picked.push(k);
          refresh();
        });
      });
      q(".tour-next").addEventListener("click", renderIntake);
      refresh();
    }

    /* ---- details ----------------------------------------------------- */
    function field(name, label, required, type) {
      return '<div class="form-group"><label for="' + root.__ns + name + '">' + esc(label) +
             (required ? ' *' : '') + '</label>' +
             '<input id="' + root.__ns + name + '" name="' + name + '" type="' + (type || "text") + '"></div>';
    }

    function pickedLabels() {
      return state.picked.map(function (k) {
        return PROGRAMS.filter(function (p) { return p.key === k; })[0].label;
      });
    }

    function renderIntake() {
      var isTour = state.path === "tour";
      var html = head(isTour ? "Tell us about your family" : "Where should we reach you?",
                      isTour ? "Step 2 of 2" : "More Information");

      if (isTour && state.slot) {
        html += '<p class="tour-recap">Your tour: <strong>' + esc(state.slot.dateText) +
                '</strong> at <strong>' + esc(state.slot.timeText) + '</strong></p>';
      }
      if (!isTour && state.picked.length) {
        html += '<p class="tour-recap">Interested in: <strong>' + esc(pickedLabels().join(", ")) + '</strong></p>';
      }

      html += '<form class="tour-form" novalidate>';
      html += '<div class="form-row">' + field("c_first", "Child's First Name", true) + field("c_last", "Child's Last Name") + '</div>';
      html += '<div class="form-row">' + field("c_age", "Child's Age", false, "number") + field("phone", "Phone Number", false, "tel") + '</div>';
      html += '<div class="form-row">' + field("p_first", "Parent First Name", true) + field("p_last", "Parent Last Name", true) + '</div>';
      html += '<div class="form-row single">' + field("email", "Email Address", true, "email") + '</div>';
      html += '<div class="form-row single"><div class="form-group">' +
              '<label for="' + root.__ns + 'notes">Anything you&rsquo;d like us to know?</label>' +
              '<textarea id="' + root.__ns + 'notes" name="notes" placeholder="Questions, schedule needs, how you heard about us..."></textarea>' +
              '</div></div>';
      html += '<div class="tour-actions">' +
                '<button class="btn btn-outline tour-back" type="button">Back</button>' +
                '<button class="btn btn-primary tour-submit" type="submit">' + (isTour ? "Schedule this tour" : "Send my questions") + '</button>' +
              '</div>';
      html += '<div class="form-status"></div>';
      html += '</form>';
      setBody(html);

      q(".tour-back").addEventListener("click", function () {
        if (isTour) renderScheduler(); else renderPrograms();
      });
      q(".tour-form").addEventListener("submit", function (e) {
        e.preventDefault();
        submit(e.target);
      });
    }

    /* ---- submit ------------------------------------------------------ */
    function submit(form) {
      var status = form.querySelector(".form-status");
      var btn = form.querySelector(".tour-submit");
      var get = function (n) {
        var el = form.querySelector('[name="' + n + '"]');
        return el ? el.value.trim() : "";
      };

      var isTour = state.path === "tour";
      var notes = get("notes");
      // The leads table has no tour/program columns yet, so the choice rides
      // along in notes. Move these to real columns when the schema catches up.
      var prefix = isTour
        ? "Tour requested: " + state.slot.dateText + " at " + state.slot.timeText
        : "Interested in: " + pickedLabels().join(", ");

      var lead = {
        cfname: get("c_first"),
        clname: get("c_last"),
        cage: get("c_age") ? parseInt(get("c_age"), 10) : null,
        pfname: get("p_first"),
        plname: get("p_last"),
        email: get("email"),
        phone: get("phone"),
        notes: prefix + (notes ? "\n\n" + notes : ""),
        source: isTour ? "website_tour" : "website_info"
      };

      if (!lead.cfname || !lead.pfname || !lead.plname || !lead.email) {
        status.textContent = "Please fill in the required fields.";
        status.className = "form-status err";
        return;
      }

      if (!sbReady()) {
        status.textContent = "Our online booking isn't finished yet — please call us at " + PHONE + ".";
        status.className = "form-status err";
        return;
      }

      btn.disabled = true;
      btn.textContent = "Sending...";
      status.className = "form-status";

      fetch(sbUrl() + "/rest/v1/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": sbKey(),
          "Authorization": "Bearer " + sbKey(),
          "Prefer": "return=minimal"
        },
        body: JSON.stringify(lead)
      })
        .then(function (r) { if (!r.ok) throw new Error("bad " + r.status); return r; })
        .then(function () { renderSuccess(lead); })
        .catch(function (err) {
          console.error("Tour request failed:", err);
          status.textContent = "Something went wrong. Please try again or call us at " + PHONE + ".";
          status.className = "form-status err";
          btn.disabled = false;
          btn.textContent = isTour ? "Schedule this tour" : "Send my questions";
        });
    }

    function renderSuccess(lead) {
      var isTour = state.path === "tour";
      var html = '<div class="tour-success">';
      html += '<div class="tour-check" aria-hidden="true">&#10003;</div>';
      html += '<h2 class="tour-h">' + (isTour ? "Your tour is scheduled" : "Thank you — we'll be in touch") + '</h2>';
      if (isTour) {
        html += '<p class="tour-sub">Thanks, ' + esc(lead.pfname) + '. We&rsquo;ll confirm <strong>' +
                esc(state.slot.dateText) + '</strong> at <strong>' + esc(state.slot.timeText) + '</strong> shortly. \u{1F33F}</p>';
      } else {
        html += '<p class="tour-sub">Thanks, ' + esc(lead.pfname) + '. We&rsquo;ll send along what you asked about within a day or two. \u{1F33F}</p>';
      }
      html += '<div class="tour-actions tour-actions--center">' +
                '<button class="btn btn-outline tour-restart" type="button">Start over</button>' +
                (isModal ? '<button class="btn btn-primary" type="button" data-tour-close>Done</button>' : '') +
              '</div>';
      html += '</div>';
      setBody(html);
      q(".tour-restart").addEventListener("click", function () { start(state.path); });
    }

    function start(path) {
      reset(path);
      if (state.path === "info") renderPrograms(); else renderScheduler();
    }

    reset("tour");
    return { start: start };
  }

  /* ═════ wiring ═══════════════════════════════════════════════════════ */
  var modal, modalFlow, lastFocused;
  var nsCount = 0;

  function buildModal() {
    modal = document.createElement("div");
    modal.className = "tour-modal";
    modal.setAttribute("hidden", "");
    modal.innerHTML =
      '<div class="tour-backdrop" data-tour-close></div>' +
      '<div class="tour-dialog" role="dialog" aria-modal="true">' +
        '<button class="tour-close" type="button" aria-label="Close" data-tour-close>&times;</button>' +
        '<div class="tour-body"></div>' +
      '</div>';
    document.body.appendChild(modal);

    var dlg = modal.querySelector(".tour-dialog");
    dlg.__ns = "tm_";
    modalFlow = createFlow(dlg, { isModal: true });

    modal.addEventListener("click", function (e) {
      if (e.target.closest("[data-tour-close]")) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (!modal || modal.hasAttribute("hidden")) return;
      if (e.key === "Escape") closeModal();
      if (e.key === "Tab") trapFocus(e);
    });
  }

  function trapFocus(e) {
    var d = modal.querySelector(".tour-dialog");
    var f = d.querySelectorAll('a[href],button:not([disabled]),input,textarea,[tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function openModal(trigger, path) {
    if (!modal) buildModal();
    lastFocused = trigger || document.activeElement;
    modalFlow.start(path);
    modal.removeAttribute("hidden");
    document.documentElement.classList.add("tour-open");
    modal.querySelector(".tour-close").focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.setAttribute("hidden", "");
    document.documentElement.classList.remove("tour-open");
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  document.addEventListener("DOMContentLoaded", function () {
    // Inline copies (home + contact) show the tour picker straight away.
    document.querySelectorAll("[data-tour-inline]").forEach(function (hostEl) {
      hostEl.innerHTML = '<div class="tour-body"></div>';
      hostEl.__ns = "ti" + (++nsCount) + "_";
      createFlow(hostEl, { isModal: false }).start("tour");
    });

    document.addEventListener("click", function (e) {
      var tourBtn = e.target.closest("[data-tour-open]");
      if (tourBtn) { e.preventDefault(); openModal(tourBtn, "tour"); return; }
      var infoBtn = e.target.closest("[data-info-open]");
      if (infoBtn) { e.preventDefault(); openModal(infoBtn, "info"); return; }
    });
  });
})();
