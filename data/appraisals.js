/* ── data/appraisals.js ───────────────────────────────────────
   End-of-service appraisals given by the client (principal) — one common,
   structured form instead of each client's own, so results can be compared
   and summarised.
   Depends on: utils.js, crew.js, clients.js, store.js (loaded after clients.js)
   Exposes globals:
     APPRAISAL_SECTIONS, APPRAISAL_GRADES, appraisalKey(), appraisalTourByKey(),
     appraisalFor(), appraisalAverages(), gradeMeta()
   Seeds erpStore.appraisals (in memory, shared by the Client UI).

   Appraisal: { key, seafarerId, vesselId, rank, embark, signoff, clientId,
                date, appraiser, grades: { criterionId: 1-10 },
                comments: { sectionId: text }, rehire: true|false,
                justification (required when rehire is false), remarks }
──────────────────────────────────────────────────────────────── */

var APPRAISAL_SECTIONS = [
    { id: 'performance', title: 'Performance', icon: 'mdi-speedometer', criteria: [
        { id: 'quality',       label: 'Quality of work' },
        { id: 'efficiency',    label: 'Productivity & efficiency' },
        { id: 'reliability',   label: 'Reliability & punctuality' },
        { id: 'safety',        label: 'Safety awareness & compliance' },
    ] },
    { id: 'behaviour', title: 'Behaviour', icon: 'mdi-account-tie', criteria: [
        { id: 'discipline',    label: 'Discipline & conduct' },
        { id: 'rules',         label: 'Respect for company rules & policies (incl. D&A)' },
        { id: 'attitude',      label: 'Attitude towards superiors & instructions' },
        { id: 'care',          label: 'Care of cabin, equipment & vessel' },
    ] },
    { id: 'knowledge', title: 'Knowledge', icon: 'mdi-school', criteria: [
        { id: 'professional',  label: 'Professional / technical knowledge for the rank' },
        { id: 'equipment',     label: 'Knowledge of vessel equipment & systems' },
        { id: 'procedures',    label: 'Knowledge of procedures (SMS / ISM / ISPS)' },
        { id: 'learning',      label: 'Willingness to learn & to train others' },
    ] },
    { id: 'soft', title: 'Soft Skills', icon: 'mdi-account-group', criteria: [
        { id: 'communication', label: 'Communication & English' },
        { id: 'teamwork',      label: 'Teamwork & cooperation' },
        { id: 'leadership',    label: 'Leadership & initiative' },
        { id: 'adaptability',  label: 'Adaptability & handling of pressure' },
    ] },
];

// Grade bands (label + colour; the label is always shown next to the colour)
var APPRAISAL_GRADES = [
    { min: 1,  max: 3,  label: 'Poor',                  color: 'error' },
    { min: 4,  max: 5,  label: 'Below expectations',    color: 'warning' },
    { min: 6,  max: 7,  label: 'Meets expectations',    color: 'info' },
    { min: 8,  max: 9,  label: 'Exceeds expectations',  color: 'success' },
    { min: 10, max: 10, label: 'Outstanding',           color: 'success' },
];

function gradeMeta(n) {
    if (n == null) return null;
    var r = Math.round(n);
    return APPRAISAL_GRADES.find(g => r >= g.min && r <= g.max) || null;
}

// A completed tour is identified by vessel + seafarer + sign-off date
function appraisalKey(tour) {
    return tour.vesselId + '|' + tour.seafarerId + '|' + tour.signoff;
}

function appraisalTourByKey(key) {
    return crewPastAssignments.find(a => appraisalKey(a) === key) || null;
}

function appraisalFor(key) {
    return erpStore.appraisals.find(a => a.key === key) || null;
}

// { sections: { sectionId: avg }, overall } — averages of the graded criteria (1 decimal)
function appraisalAverages(a) {
    var round = n => Math.round(n * 10) / 10;
    var all = [];
    var sections = {};
    APPRAISAL_SECTIONS.forEach(s => {
        var g = s.criteria.map(c => a.grades[c.id]).filter(n => n != null);
        sections[s.id] = g.length ? round(g.reduce((x, y) => x + y, 0) / g.length) : null;
        all = all.concat(g);
    });
    return { sections, overall: all.length ? round(all.reduce((x, y) => x + y, 0) / all.length) : null };
}

/* Seed: tours that signed off more than ~2 months ago are mostly appraised
   already; recent ones are waiting. One appraisal (Edgar Bautista, GSL)
   says "do not rehire". */
var APPRAISAL_SEED_NOT_REHIRE = 1107;

erpStore.appraisals = (function () {
    var out = [];
    var today = isoDate(TODAY);
    var h = (n) => { n = Math.imul(n ^ 0x5bd1e995, 0x27d4eb2d); return (n ^ (n >>> 15)) >>> 0; };
    crewPastAssignments.forEach(function (t, i) {
        var age = daysB(d(t.signoff), d(today));
        if (age < 65 || t.signoff > today) return;               // recent → still to be appraised
        var r = h(t.seafarerId * 31 + i);
        var poor = t.seafarerId === APPRAISAL_SEED_NOT_REHIRE;
        if (!poor && r % 10 < 2) return;                          // ~20% never appraised
        var client = allClientsData.find(c => c.vesselIds.includes(t.vesselId));
        var base = poor ? 4 : 6 + r % 3;                          // 6-8 typical, 4 for the poor one
        var grades = {};
        APPRAISAL_SECTIONS.forEach((s, si) => s.criteria.forEach((c, ci) => {
            var v = base + ((h(r + si * 7 + ci) % 5) - 2) / 2;   // ±1
            grades[c.id] = Math.max(1, Math.min(10, Math.round(v + (si === 2 && !poor ? 1 : 0))));
        }));
        out.push({
            key: appraisalKey(t), seafarerId: t.seafarerId, vesselId: t.vesselId, rank: t.rank,
            embark: t.embark, signoff: t.signoff, clientId: client ? client.id : null,
            date: isoDate(new Date(d(t.signoff).getTime() + 10 * 86400000)),
            appraiser: (client ? client.alias + ' ' : '') + 'Marine Superintendent',
            grades, comments: poor ? { behaviour: 'Late for watch duty on several occasions; two written warnings by the Master.' } : {},
            rehire: !poor,
            justification: poor ? 'Repeated lateness for watch duty and poor cooperation with the crew despite two warnings by the Master.' : '',
            remarks: poor ? '' : 'Good tour, no incidents reported.',
        });
    });
    return out;
})();
