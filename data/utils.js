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

/* Seed data (vessels.js, seafarers.js) is written as of DATA_AUTHORED_ON.
   shiftSeedDates() moves every YYYY-MM-DD string in it forward by whole
   months so the mockup always sits around today. Called from store.js. */
var DATA_AUTHORED_ON = '2026-05-20';

function seedMonthShift() {
    return Math.round(daysB(d(DATA_AUTHORED_ON), TODAY) / 30.44);
}

function shiftSeedDates(obj, months) {
    if (!months || !obj || typeof obj !== 'object') return;
    Object.keys(obj).forEach(k => {
        const v = obj[k];
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
            // UTC month arithmetic — local-time addM can lose a day across daylight-saving changes
            const dt = d(v);
            dt.setUTCMonth(dt.getUTCMonth() + months);
            obj[k] = isoDate(dt);
        }
        else if (v && typeof v === 'object') shiftSeedDates(v, months);
    });
}
