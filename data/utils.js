/* ── data/utils.js ────────────────────────────────────────────
   Global date helpers shared across all Maritime ERP views.
   Loaded before any view script. Exposes globals:
     TODAY, d(), addM(), daysB(), isoDate(), fmtShort(), shortName()
──────────────────────────────────────────────────────────────── */

var TODAY = new Date();

function d(s)        { return new Date(s); }
function addM(dt, n) { const r = new Date(dt); r.setMonth(r.getMonth() + n); return r; }
function daysB(a, b) { return Math.round((b - a) / 86400000); }
function isoDate(dt) { return dt.toISOString().slice(0, 10); }
function fmtShort(s) { return d(s).toLocaleDateString('en', { month:'short', day:'numeric' }); }
function shortName(full) {
    if (!full) return '';
    const parts = full.trim().split(' ');
    return parts.length === 1 ? parts[0] : parts[0][0] + '. ' + parts.slice(1).join(' ');
}
