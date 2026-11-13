/* ── data/analytics.js ────────────────────────────────────────
   RFE pipeline analytics data for the internal ERP (Operations / management).
   Depends on: utils.js, vessels.js, seafarers.js, clients.js, store.js
   (loaded after clients.js)
   Exposes globals:
     RFE_STAGES, RFE_STEPS, RFE_POOLS, OPS_GROUPS, OPS_USERS, rfeHistory,
     opsUserForClient(), logRfeStage(), rfeStepDurations()
   Seeds erpStore.rfeTargets (days per step) and erpStore.rfeStageLog.

   Stages: Created → Pool Search → Ask for Acceptance → Accepted →
           Principal Approval → Preparation → Ready → Embarked
   Each completed RFE carries its stage events [{ stage, at }] (at = ms).
   A rejection by the principal sends the RFE back to Pool Search (loop).
   Measuring rule: each step is measured on the FINAL pass (last entry into
   Pool Search onwards); the time spent in abandoned passes is "rework".
   Created → Pool Search uses the first search entry.
──────────────────────────────────────────────────────────────── */

var RFE_STAGES = [
    { id: 'created',     label: 'Created' },
    { id: 'search',      label: 'Pool Search' },
    { id: 'ask',         label: 'Ask for Acceptance' },
    { id: 'accepted',    label: 'Accepted' },
    { id: 'approval',    label: 'Principal Approval' },
    { id: 'preparation', label: 'Preparation' },
    { id: 'ready',       label: 'Ready' },
    { id: 'embarked',    label: 'Embarked' },
];

// The 7 steps between consecutive stages. Colour = the Atlantis colour of the stage the
// RFE is waiting in (as on the Rotation Plan Gantt: search light blue, approval purple,
// preparation light green, ready dark green); Created / Ask / Accepted have no Atlantis
// colour → grey and two blues. `line` = darker variant for thin lines on white.
// `hatch` = drawn with the Atlantis diagonal stripes (search, approval; approval also
// has the purple bottom strip); `cls` = the Gantt CSS class used for legend swatches.
var RFE_STEPS = [
    { id: 's1', from: 'created',     to: 'search',      label: 'Created → Pool Search',            short: 'Start search',  color: '#BDBDBD', ink: '#212121', line: '#9E9E9E' },
    { id: 's2', from: 'search',      to: 'ask',         label: 'Pool Search → Ask for Acceptance', short: 'Search',        color: '#A9C5EA', ink: '#1A3A66', line: '#7FA6D9', hatch: true, cls: 'atl-bar--search' },
    { id: 's3', from: 'ask',         to: 'accepted',    label: 'Ask for Acceptance → Accepted',    short: 'Seafarer Acceptance',  color: '#4F7DBF', ink: '#ffffff' },
    { id: 's4', from: 'accepted',    to: 'approval',    label: 'Accepted → Principal Approval',    short: 'To principal',  color: '#1565C0', ink: '#ffffff' },
    { id: 's5', from: 'approval',    to: 'preparation', label: 'Principal Approval → Preparation', short: 'On Approval',  color: '#7E57C2', ink: '#1A3A66', hatch: true, cls: 'atl-bar--approval' },
    { id: 's6', from: 'preparation', to: 'ready',       label: 'Preparation → Ready',              short: 'Preparation',   color: '#8FC48A', ink: '#1B3A17', cls: 'atl-bar--preparation' },
    { id: 's7', from: 'ready',       to: 'embarked',    label: 'Ready → Embarked',                 short: 'Ready To Embark',  color: '#3D8B47', ink: '#ffffff', cls: 'atl-bar--ready' },
];

var RFE_POOLS = [
    { id: 'dedicated', label: 'Dedicated to client' },
    { id: 'excrew',    label: 'Ex-crew (not dedicated)' },
    { id: 'new',       label: 'New candidate' },
];

// Operations: a user handles a couple of clients, the user's group a superset
var OPS_GROUPS = [
    { id: 'g1', name: 'Crossworld', clientIds: ['c1', 'c3'] },
    { id: 'g2', name: 'Creworld',   clientIds: ['c2', 'c4'] },
];
var OPS_USERS = [
    { id: 'u1', name: 'Eleni Markou',    groupId: 'g1', clientIds: ['c1'] },
    { id: 'u2', name: 'Nikos Andreou',   groupId: 'g1', clientIds: ['c1', 'c3'] },
    { id: 'u3', name: 'Sofia Dimitriou', groupId: 'g1', clientIds: ['c3'] },
    { id: 'u4', name: 'Petros Lykos',    groupId: 'g2', clientIds: ['c2'] },
    { id: 'u5', name: 'Anna Georgiou',   groupId: 'g2', clientIds: ['c2', 'c4'] },
    { id: 'u6', name: 'Kostas Ioannou',  groupId: 'g2', clientIds: ['c4'] },
];

// Deterministic default handler of a client (for live RFEs without an assignment)
function opsUserForClient(clientId, salt) {
    var users = OPS_USERS.filter(u => u.clientIds.includes(clientId));
    if (!users.length) return OPS_USERS[0];
    var h = 0;
    String(salt || '').split('').forEach(c => { h = (h * 31 + c.charCodeAt(0)) >>> 0; });
    return users[h % users.length];
}

// Step targets in days (management can change them on the analytics page)
erpStore.rfeTargets = { s1: 1, s2: 10, s3: 3, s4: 2, s5: 5, s6: 14, s7: 3 };

/* Step durations of an RFE from its events (days, final-pass rule) →
   { steps: { s1..s7 }, total, rework, loops } — null if not complete */
function rfeStepDurations(events) {
    var DAY = 86400000;
    var firstSearch = events.findIndex(e => e.stage === 'search');
    var lastSearch = -1;
    events.forEach((e, i) => { if (e.stage === 'search') lastSearch = i; });
    var created = events.find(e => e.stage === 'created');
    var embarked = events.find(e => e.stage === 'embarked');
    if (!created || !embarked || firstSearch < 0) return null;
    var at = {};
    events.slice(lastSearch).forEach(e => { if (!(e.stage in at)) at[e.stage] = e.at; });
    var steps = { s1: (events[firstSearch].at - created.at) / DAY };
    for (var i = 1; i < RFE_STEPS.length; i++) {
        var s = RFE_STEPS[i];
        if (at[s.from] == null || at[s.to] == null) return null;
        steps[s.id] = (at[s.to] - at[s.from]) / DAY;
    }
    return {
        steps, total: (embarked.at - created.at) / DAY,
        rework: (events[lastSearch].at - events[firstSearch].at) / DAY,
        loops: events.filter(e => e.stage === 'search').length - 1,
    };
}

/* ── History: ~12 months of completed RFEs ───────────────────── */
var rfeHistory = (function () {
    var seed = 20260601;
    var rnd = function () {                                  // mulberry32
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    var normal = function () { return Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd()); };
    var pick = function (list, weights) {
        var r = rnd() * weights.reduce((a, b) => a + b, 0);
        for (var i = 0; i < list.length; i++) { r -= weights[i]; if (r <= 0) return list[i]; }
        return list[list.length - 1];
    };
    // log-normal around a median, with occasional slow outliers
    var dur = function (median, factor) {
        var v = median * factor * Math.exp(0.45 * normal());
        if (rnd() < 0.05) v *= 2.5;
        return Math.max(0.2, v);
    };
    var BASE = { s1: 1, s2: 7, s3: 2, s4: 1.5, s5: 4, s6: 12, s7: 3 };
    var DAY = 86400000;
    var now = TODAY.getTime();
    var clients = ['c1', 'c2', 'c3', 'c4'];
    var officers = ['Master', 'Chief Officer', 'Chief Engineer', 'Second Engineer', 'Second Officer', 'Third Officer', 'Third Engineer'];
    var out = [];
    for (var n = 0; n < 160; n++) {
        var clientId = pick(clients, [40, 25, 25, 10]);
        var client = allClientsData.find(c => c.id === clientId);
        var vesselId = client.vesselIds[Math.floor(rnd() * client.vesselIds.length)];
        var vessel = allVessels.find(v => v.id === vesselId);
        var rank = vessel.ranks[Math.floor(rnd() * vessel.ranks.length)].rank;
        var pool = pick(RFE_POOLS, [45, 35, 20]).id;
        var user = pick(OPS_USERS.filter(u => u.clientIds.includes(clientId)), [1, 1, 1].slice(0, OPS_USERS.filter(u => u.clientIds.includes(clientId)).length));
        var embarkedAt = now - (3 + rnd() * 362) * DAY;
        var progress = 1 - (now - embarkedAt) / (365 * DAY);   // 0 = a year ago, 1 = now
        var f = { s1: 1, s2: 1, s3: 1, s4: 1, s5: 1, s6: 1, s7: 1 };
        if (pool === 'new')       { f.s2 *= 1.6; f.s3 *= 1.5; f.s6 *= 1.4; }
        if (pool === 'excrew')    { f.s2 *= 1.2; }
        if (pool === 'dedicated') { f.s2 *= 0.7; f.s6 *= 0.8; }
        if (clientId === 'c2')    { f.s5 *= 2.0; }
        if (clientId === 'c4')    { f.s5 *= 1.3; }
        if (user.id === 'u5')     { f.s2 *= 1.5; }
        if (user.id === 'u3')     { f.s2 *= 0.8; }
        if (user.id === 'u6')     { f.s6 *= 1.3; }
        if (rank === 'Master' || rank === 'Chief Engineer') f.s2 *= 1.4;
        else if (!officers.includes(rank)) f.s2 *= 0.8;
        f.s2 *= 1.25 - 0.4 * progress;                        // search gets faster over the year
        f.s6 *= 1.1 - 0.2 * progress;

        // passes through search → approval; a rejection by the principal loops back
        var loops = rnd() < (clientId === 'c2' ? 0.22 : 0.11) ? 1 : 0;
        var seq = [['created', 0], ['search', dur(BASE.s1, f.s1)]];
        for (var p = 0; p <= loops; p++) {
            seq.push(['ask', dur(BASE.s2, f.s2)], ['accepted', dur(BASE.s3, f.s3)], ['approval', dur(BASE.s4, f.s4)]);
            seq.push(p < loops ? ['search', dur(BASE.s5, f.s5)] : ['preparation', dur(BASE.s5, f.s5)]);
        }
        seq.push(['ready', dur(BASE.s6, f.s6)], ['embarked', dur(BASE.s7, f.s7)]);
        var total = seq.reduce((a, s) => a + s[1], 0);
        var t = embarkedAt - total * DAY;
        var events = seq.map(s => { t += s[1] * DAY; return { stage: s[0], at: Math.round(t) }; });
        out.push({
            ref: 'RFE-' + (5000 + n), clientId, vesselId: vessel.id, vesselType: vessel.type,
            rank, pool, userId: user.id, groupId: user.groupId, events,
        });
    }
    return out;
})();

/* ── Seafarer refusals and principal rejections ────────────────
   Reasons are picked from these lists (draft — to be agreed with the
   stakeholders; ids are stored, labels can be renamed freely).
   - Seafarer refused (internal RFAs view, Operations): one reason per refusal.
     "No answer within the deadline" is a separate outcome (acceptance 'noAnswer').
   - Principal rejected all (Client UI): one reason per rejected candidate.
     When the principal approves one candidate, the others are "not favored"
     (approvalChoice 'notFavored') — no reason, not a rejection. */
var SEAFARER_REFUSAL_REASONS = [
    { id: 'salary',       label: 'Salary / terms' },
    { id: 'vessel',       label: 'Vessel type or trading area' },
    { id: 'contract',     label: 'Contract length / rotation' },
    { id: 'availability', label: 'Not available on the joining date' },
    { id: 'family',       label: 'Family / personal' },
    { id: 'health',       label: 'Health' },
    { id: 'otherOffer',   label: "Accepted another company's offer" },
    { id: 'other',        label: 'Other' },
];
var PRINCIPAL_REJECTION_REASONS = [
    { id: 'expRank',     label: 'Not enough experience in the rank' },
    { id: 'expVessel',   label: 'Not enough experience on the vessel type' },
    { id: 'performance', label: 'Past performance / appraisal' },
    { id: 'documents',   label: 'Certificates or documents' },
    { id: 'age',         label: 'Age' },
    { id: 'english',     label: 'English / communication' },
    { id: 'crewMix',     label: 'Nationality / crew mix' },
    { id: 'salary',      label: 'Salary expectation' },
    { id: 'preferOther', label: 'Prefers another candidate or former crew' },
    { id: 'other',       label: 'Other' },
];
function refusalReasonLabel(id)   { var r = SEAFARER_REFUSAL_REASONS.find(x => x.id === id);   return r ? r.label : (id || '—'); }
function rejectionReasonLabel(id) { var r = PRINCIPAL_REJECTION_REASONS.find(x => x.id === id); return r ? r.label : (id || '—'); }

/* Candidate history of the completed RFEs (separate seeded stream, so the
   durations above are unchanged): rfeHistory[i].cands =
   [{ name, pool, outcome: 'refused'|'noAnswer'|'rejected'|'approved'|'notFavored', reason, at }]
   - more refusals when search + acceptance took longer; new candidates refuse
     more (salary, vessel), dedicated crew mostly over availability / family
   - every rejection pass (loop) rejects all candidates sent, each with a reason;
     Pacific Logistics (c2) rejects more on vessel-type experience and English */
(function () {
    var seed = 777;
    var rnd = function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    var pickW = function (map) {
        var keys = Object.keys(map), sum = keys.reduce((a, k) => a + map[k], 0), r = rnd() * sum;
        for (var i = 0; i < keys.length; i++) { r -= map[keys[i]]; if (r <= 0) return keys[i]; }
        return keys[keys.length - 1];
    };
    var REFUSE = {
        dedicated: { salary: 12, vessel: 6,  contract: 10, availability: 34, family: 22, health: 6, otherOffer: 5,  other: 5 },
        excrew:    { salary: 24, vessel: 14, contract: 14, availability: 16, family: 11, health: 4, otherOffer: 14, other: 3 },
        new:       { salary: 31, vessel: 21, contract: 14, availability: 9,  family: 7,  health: 2, otherOffer: 14, other: 2 },
    };
    var REJECT = { expRank: 24, expVessel: 20, performance: 9, documents: 11, age: 7, english: 10, crewMix: 6, salary: 5, preferOther: 6, other: 2 };
    var DAY = 86400000;
    var poolMix = { dedicated: 40, excrew: 35, new: 25 };
    rfeHistory.forEach(r => {
        var d = rfeStepDurations(r.events);
        var byRank = allSeafarers.filter(s => s.rank === r.rank);
        var names = byRank.length ? byRank : allSeafarers;
        var name = () => names[Math.floor(rnd() * names.length)].name;
        var asks = r.events.filter(e => e.stage === 'ask').map(e => e.at);
        var accepted = r.events.filter(e => e.stage === 'accepted').map(e => e.at);
        var searches = r.events.filter(e => e.stage === 'search').map(e => e.at);
        var cands = [];
        // refusals / no answers, spread over the passes' acceptance windows
        var slow = Math.max(0, (d.steps.s2 + d.steps.s3) / 9 - 0.6);
        var nRef = Math.floor(rnd() * (0.6 + slow * 1.6) + (r.pool === 'new' ? 0.5 : 0) + rnd() * 0.6);
        for (var k = 0; k < nRef; k++) {
            var pool = pickW({ dedicated: 18, excrew: 37, new: 45 });   // new candidates refuse most
            var w = Object.assign({}, REFUSE[pool]);
            if (r.rank === 'Master' || r.rank === 'Chief Engineer') w.salary *= 1.5;
            var p = Math.floor(rnd() * asks.length);
            var at = asks[p] + rnd() * Math.max(DAY, accepted[p] - asks[p]);
            if (rnd() < ({ dedicated: 0.08, excrew: 0.2, new: 0.32 })[pool])
                cands.push({ name: name(), pool, outcome: 'noAnswer', reason: null, at: Math.round(at) });
            else
                cands.push({ name: name(), pool, outcome: 'refused', reason: pickW(w), at: Math.round(at) });
        }
        // rejection passes: all sent candidates rejected, one reason each
        for (var lp = 1; lp < searches.length; lp++) {
            var nSent = 2 + Math.floor(rnd() * 2);
            for (var j = 0; j < nSent; j++) {
                var cp = pickW(poolMix);
                var rw = Object.assign({}, REJECT);
                if (r.clientId === 'c2') { rw.expVessel *= 2; rw.english *= 1.6; }
                if (cp === 'new') { rw.expRank *= 1.6; rw.expVessel *= 1.4; }
                if (cp === 'dedicated') { rw.performance *= 1.5; rw.expRank *= 0.5; }
                cands.push({ name: name(), pool: cp, outcome: 'rejected', reason: pickW(rw), at: searches[lp] });
            }
        }
        // final pass: one approved (the RFE's pool), the others not favored
        var approvalAt = r.events.filter(e => e.stage === 'preparation')[0].at;
        cands.push({ name: name(), pool: r.pool, outcome: 'approved', reason: null, at: approvalAt });
        var nOthers = Math.floor(rnd() * 2.4);
        for (var o = 0; o < nOthers; o++) cands.push({ name: name(), pool: pickW(poolMix), outcome: 'notFavored', reason: null, at: approvalAt });
        r.cands = cands;
    });
})();

/* ── Live RFEs: stage log (entry dates of the current stage) ─────
   Seeded for open RFEs on first use; RFAs.js records new stage changes
   (send for approval, principal approve / reject all) via logRfeStage(). */
erpStore.rfeStageLog = {};

function logRfeStage(ref, stage) {
    if (!ref) return;
    var log = erpStore.rfeStageLog[ref] || (erpStore.rfeStageLog[ref] = []);
    log.push({ stage, at: Date.now() });
}
