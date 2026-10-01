/* ── data/documents.js ────────────────────────────────────────
   Mock seafarer documents (identity, CoC, STCW training, medical, visas).
   Depends on: utils.js, crew.js (seafarerById)
   Exposes globals:
     DOC_CATEGORIES, seafarerDocuments(), docStatus(), docSummary()

   Documents are generated deterministically per seafarer (same id →
   same documents on every load). Expiry dates are relative to TODAY so
   the valid / expiring / expired mix stays realistic whenever the
   mockup is opened. Generated lists are cached and can be mutated.
──────────────────────────────────────────────────────────────── */

var DOC_CATEGORIES = ['Identity', 'Competency', 'STCW Training', 'Medical', 'Visas'];

var DOC_EXPIRING_DAYS = 90;

var _docCache = {};

// Integer hash → stable pseudo-random numbers per seafarer/document
function _docHash(n) {
    n = (n ^ 61) ^ (n >>> 16);
    n = n + (n << 3);
    n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d);
    n = n ^ (n >>> 15);
    return n >>> 0;
}

// Document templates applicable to a rank: { category, name, years (null = no expiry), issuer }
function _docTemplatesFor(rank) {
    var deckOfficers   = ['Captain','Chief Officer','Second Officer','Third Officer'];
    var engineOfficers = ['Chief Engineer','Second Engineer','Third Engineer'];
    var isDeck   = deckOfficers.includes(rank);
    var isEngine = engineOfficers.includes(rank);
    var isOfficer = isDeck || isEngine;
    var coc = {
        'Captain':         'CoC — Master (STCW II/2)',
        'Chief Officer':   'CoC — Chief Mate (STCW II/2)',
        'Second Officer':  'CoC — Officer in Charge of a Navigational Watch (STCW II/1)',
        'Third Officer':   'CoC — Officer in Charge of a Navigational Watch (STCW II/1)',
        'Chief Engineer':  'CoC — Chief Engineer Officer (STCW III/2)',
        'Second Engineer': 'CoC — Second Engineer Officer (STCW III/2)',
        'Third Engineer':  'CoC — Officer in Charge of an Engineering Watch (STCW III/1)',
    }[rank];
    var rating = {
        'Bosun':           'Able Seafarer Deck (STCW II/5)',
        'AB Deck':         'Able Seafarer Deck (STCW II/5)',
        'Oiler':           'Able Seafarer Engine (STCW III/5)',
        'Ordinary Seaman': 'Rating Forming Part of a Navigational Watch (STCW II/4)',
    }[rank];

    var t = [
        { category:'Identity',      name:'Passport',                           years:10,   issuer:'national' },
        { category:'Identity',      name:"Seaman's Book",                      years:10,   issuer:'Maritime Administration' },
    ];
    if (coc) {
        t.push({ category:'Competency', name: coc,                             years:5,    issuer:'Maritime Administration' });
        t.push({ category:'Competency', name:'Flag State Endorsement',         years:5,    issuer:'Flag State Administration' });
    }
    if (rating) t.push({ category:'Competency', name: rating,                  years:null, issuer:'Maritime Administration' });
    if (isDeck) t.push({ category:'Competency', name:'GMDSS / GOC',            years:5,    issuer:'Maritime Administration' });

    t.push({ category:'STCW Training', name:'STCW Basic Safety (BST)',         years:5,    issuer:'Maritime Training Centre' });
    t.push({ category:'STCW Training', name:'Proficiency in Survival Craft',   years:5,    issuer:'Maritime Training Centre' });
    t.push({ category:'STCW Training', name:'Security Awareness',              years:null, issuer:'Maritime Training Centre' });
    t.push({ category:'STCW Training', name:'Tanker Familiarisation',          years:5,    issuer:'Maritime Training Centre' });
    if (isOfficer) {
        t.push({ category:'STCW Training', name:'Advanced Fire Fighting',      years:5,    issuer:'Maritime Training Centre' });
        t.push({ category:'STCW Training',
                 name: (rank === 'Captain' || rank === 'Chief Officer') ? 'Medical Care' : 'Medical First Aid',
                 years:5, issuer:'Maritime Training Centre' });
    }
    if (isDeck) {
        t.push({ category:'STCW Training', name:'ECDIS Generic',               years:null, issuer:'Maritime Training Centre' });
        t.push({ category:'STCW Training', name:'Bridge Resource Management',  years:null, issuer:'Maritime Training Centre' });
    }
    if (isEngine) {
        t.push({ category:'STCW Training', name:'Engine Room Resource Management', years:null, issuer:'Maritime Training Centre' });
        if (rank !== 'Third Engineer') {
            t.push({ category:'STCW Training', name:'High Voltage Management', years:5,    issuer:'Maritime Training Centre' });
        }
    }

    t.push({ category:'Medical', name:'Medical Certificate (ENG1)',            years:2,    issuer:'Approved Medical Examiner' });
    t.push({ category:'Medical', name:'Drug & Alcohol Test',                   years:1,    issuer:'Approved Medical Examiner' });
    t.push({ category:'Medical', name:'Yellow Fever Vaccination',              years:null, issuer:'Approved Vaccination Centre' });
    t.push({ category:'Visas',   name:'US C1/D Visa',                          years:5,    issuer:'U.S. Embassy' });
    return t;
}

function _docSlug(s) {
    return s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Documents of a seafarer (cached). Returns [] for unknown ids.
function seafarerDocuments(seafarerId) {
    if (_docCache[seafarerId]) return _docCache[seafarerId];
    var s = seafarerById(seafarerId);
    if (!s) return [];
    var surname = s.name.split(' ').slice(-1)[0];
    var docs = _docTemplatesFor(s.rank).map(function (t, i) {
        var h = _docHash(seafarerId * 97 + i * 13) % 100;
        var h2 = _docHash(seafarerId * 31 + i * 7);
        var expiry = null, issue;
        if (t.years) {
            var exp;
            if (h < 5)       exp = new Date(TODAY.getTime() - (5 + h * 9) * 86400000);           // expired
            else if (h < 14) exp = new Date(TODAY.getTime() + (7 + (h - 5) * 9) * 86400000);     // expiring ≤ 90d
            else             exp = addM(TODAY, 4 + (h * 7) % Math.max(1, t.years * 12 - 4));     // valid
            expiry = isoDate(exp);
            issue  = isoDate(addM(exp, -12 * t.years));
        } else {
            issue = isoDate(addM(TODAY, -(12 + h % 60)));
        }
        return {
            id:         seafarerId + '-' + (i + 1),
            category:   t.category,
            name:       t.name,
            number:     (t.category === 'Identity' ? (t.name === 'Passport' ? 'P' : 'SB') : 'C')
                        + String(1000000 + h2 % 9000000),
            issuedBy:   t.issuer === 'national' ? (s.nationality + ' Government') : t.issuer,
            issueDate:  issue,
            expiryDate: expiry,
            fileName:   _docSlug(surname) + '_' + _docSlug(t.name) + '.pdf',
        };
    });
    _docCache[seafarerId] = docs;
    return docs;
}

// 'valid' | 'expiring' | 'expired' | 'permanent' relative to refIso (default today)
function docStatus(doc, refIso) {
    if (!doc.expiryDate) return 'permanent';
    var ref = refIso || isoDate(TODAY);
    if (doc.expiryDate < ref) return 'expired';
    if (daysB(d(ref), d(doc.expiryDate)) <= DOC_EXPIRING_DAYS) return 'expiring';
    return 'valid';
}

// { total, valid, expiring, expired } — permanent documents count as valid
function docSummary(seafarerId, refIso) {
    var out = { total: 0, valid: 0, expiring: 0, expired: 0 };
    seafarerDocuments(seafarerId).forEach(function (doc) {
        var st = docStatus(doc, refIso);
        out.total++;
        out[st === 'permanent' ? 'valid' : st]++;
    });
    return out;
}
