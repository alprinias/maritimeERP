/* ── data/documents.js ────────────────────────────────────────
   Mock seafarer documents, using Atlantis document categories
   (Travel Doc, STCW, Flag Req., Medical).
   Depends on: utils.js, crew.js (seafarerById, lastTourOf), vessels.js
   Exposes globals:
     DOC_CATEGORIES, seafarerDocuments(), docStatus(), docSummary(),
     cocNameForRank(), findDocument()

   Documents are generated deterministically per seafarer (same id →
   same documents on every load). Expiry dates are relative to TODAY so
   the valid / expiring / expired mix stays realistic whenever the
   mockup is opened. Generated lists are cached and can be mutated.
──────────────────────────────────────────────────────────────── */

var DOC_CATEGORIES = ['Travel Doc', 'STCW', 'Flag Req.', 'Medical'];

var DOC_EXPIRING_DAYS = 90;

var NATIONALITY_COUNTRY = {
    Filipino:'Philippines', Greek:'Greece', Russian:'Russia', Korean:'South Korea', Italian:'Italy',
    Portuguese:'Portugal', Japanese:'Japan', Vietnamese:'Vietnam', Romanian:'Romania', Ukrainian:'Ukraine',
    Indian:'India', Polish:'Poland', Cypriot:'Cyprus', Indonesian:'Indonesia', German:'Germany', Egyptian:'Egypt',
};

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

/* Document templates for a seafarer:
   { category, name, years (null = no expiry), issuer ('national' | 'maritime' | 'health' | text) } */
function _docTemplatesFor(s, flag) {
    var rank = s.rank;
    var deckOfficers   = ['Master','Chief Officer','Second Officer','Third Officer'];
    var engineOfficers = ['Chief Engineer','Second Engineer','Third Engineer'];
    var isDeck   = deckOfficers.includes(rank);
    var isEngine = engineOfficers.includes(rank);
    var isOfficer = isDeck || isEngine;
    var coc = {
        'Master':          'Certificate of Competency — Master',
        'Chief Officer':   'Certificate of Competency — Chief Mate',
        'Second Officer':  'Certificate of Competency — OIC Navigational Watch',
        'Third Officer':   'Certificate of Competency — OIC Navigational Watch',
        'Chief Engineer':  'Certificate of Competency — Chief Engineer',
        'Second Engineer': 'Certificate of Competency — Second Engineer',
        'Third Engineer':  'Certificate of Competency — OIC Engineering Watch',
    }[rank];
    var rating = {
        'Bosun':           'Able Seafarer Deck COP',
        'Able Seaman':     'Able Seafarer Deck COP',
        'Oiler':           'Able Seafarer Engine COP',
        'Ordinary Seaman': 'Rating Forming Part of a Navigational Watch COP',
    }[rank];

    var t = [
        { category:'Travel Doc', name:'Passport',                    years:10,   issuer:'national' },
        { category:'Travel Doc', name:"Seaman's Book",               years:10,   issuer:'maritime' },
        { category:'Travel Doc', name:'USA Visa',                    years:5,    issuer:'US EMBASSY' },
        { category:'Travel Doc', name:'Yellow Fever',                years:null, issuer:'health' },
    ];
    if (coc)    t.push({ category:'STCW', name: coc,                 years:5,    issuer:'maritime' });
    if (rating) t.push({ category:'STCW', name: rating,              years:null, issuer:'maritime' });
    t.push({ category:'STCW', name:'Basic Training COP',               years:5,    issuer:'maritime' });
    t.push({ category:'STCW', name:'Prof. in Surv. Craft & Rescue Boat COP', years:5, issuer:'maritime' });
    t.push({ category:'STCW', name:'Seafarers with Designated Security Duties COP', years:null, issuer:'maritime' });
    t.push({ category:'STCW', name:'Tanker Familiarisation COP',       years:5,    issuer:'maritime' });
    if (isOfficer) {
        t.push({ category:'STCW', name:'Advanced Fire Fighting COP',   years:5,    issuer:'maritime' });
        t.push({ category:'STCW',
                 name: (rank === 'Master' || rank === 'Chief Officer') ? 'Medical Care COP' : 'Medical Emergency - First Aid COP',
                 years:5, issuer:'maritime' });
    }
    if (isDeck) {
        t.push({ category:'STCW', name:"General Operator's Certificate", years:5,  issuer:'maritime' });
        t.push({ category:'STCW', name:'ECDIS Generic',                years:null, issuer:'maritime' });
        t.push({ category:'STCW', name:'Bridge Resource Management',   years:null, issuer:'maritime' });
    }
    if (isEngine) {
        t.push({ category:'STCW', name:'Engine Room Resource Management', years:null, issuer:'maritime' });
        if (rank !== 'Third Engineer') {
            t.push({ category:'STCW', name:'High Voltage Management',  years:5,    issuer:'maritime' });
        }
    }
    if (isOfficer && flag) t.push({ category:'Flag Req.', name:'FSB ' + flag, years:5, issuer:'Flag State Administration' });
    t.push({ category:'Medical', name:'Medical Certificate (PEME)',      years:2,    issuer:'health' });
    t.push({ category:'Medical', name:'Drug & Alcohol Test',             years:1,    issuer:'health' });
    return t;
}

function _issuer(code, s, country) {
    var ph = country === 'Philippines';
    if (code === 'national') return ph ? 'DFA MANILA' : 'MINISTRY OF FOREIGN AFFAIRS';
    if (code === 'maritime') return ph ? 'MARINA' : (country.toUpperCase() + ' MARITIME ADMINISTRATION');
    if (code === 'health')   return ph ? 'BOQ' : 'PORT HEALTH AUTHORITY';
    return code;
}

function _docSlug(s) {
    return s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Documents of a seafarer (cached). Returns [] for unknown ids.
function seafarerDocuments(seafarerId) {
    if (_docCache[seafarerId]) return _docCache[seafarerId];
    var s = seafarerById(seafarerId);
    if (!s) return [];
    var country = NATIONALITY_COUNTRY[s.nationality] || s.nationality;
    var tour = lastTourOf(seafarerId);
    var vessel = tour && allVessels.find(v => v.id === tour.vesselId);
    var surname = s.lastName || s.name.split(' ').slice(-1)[0];
    var docs = _docTemplatesFor(s, vessel && vessel.flag).map(function (t, i) {
        var h  = _docHash(seafarerId * 97 + i * 13) % 100;
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
        var prefix = { 'Passport':'P', "Seaman's Book":'SB', 'USA Visa':'V' }[t.name] || 'C';
        return {
            id:         seafarerId * 100 + i + 1,
            category:   t.category,
            name:       t.name,
            number:     prefix + String(1000000 + h2 % 9000000),
            country:    t.category === 'Flag Req.' ? (vessel && vessel.flag) : country,
            issuedBy:   _issuer(t.issuer, s, country),
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

// Competency certificate a rank requires (CoC for officers, COP for ratings), or null
function cocNameForRank(rank) {
    var t = _docTemplatesFor({ rank: rank }, null)
        .find(x => x.category === 'STCW' && /^(Certificate of Competency|Able Seafarer|Rating)/.test(x.name));
    return t ? t.name : null;
}

// First document of a seafarer whose name starts with the given text
function findDocument(seafarerId, startsWith) {
    return seafarerDocuments(seafarerId).find(doc => doc.name.indexOf(startsWith) === 0) || null;
}
