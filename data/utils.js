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

/* Seed data (vessels.js, seafarers.js) tells a story whose "today" is
   DATA_AUTHORED_ON. shiftSeedDates() moves every YYYY-MM-DD string in it
   forward by the exact number of days since then, so the real today always
   sits at the same point of the story (the dashboard looks the same whatever
   the date). 1 June gives a busy picture: several crew changes in the next
   30 days, approvals due, nothing overdue. Called from store.js. */
var DATA_AUTHORED_ON = '2026-06-01';

function seedDayShift() {
    return daysB(d(DATA_AUTHORED_ON), d(isoDate(TODAY)));
}

function shiftSeedDates(obj, days) {
    if (!days || !obj || typeof obj !== 'object') return;
    Object.keys(obj).forEach(k => {
        const v = obj[k];
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
            // UTC arithmetic — no day lost across daylight-saving changes
            obj[k] = isoDate(new Date(d(v).getTime() + days * 86400000));
        }
        else if (v && typeof v === 'object') shiftSeedDates(v, days);
    });
}
