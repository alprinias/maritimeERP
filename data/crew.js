/* ── data/crew.js ─────────────────────────────────────────────
   Crew records, service history and crew-list helpers.
   Depends on: utils.js, vessels.js, seafarers.js, store.js
   Exposes globals:
     CREW_RANK_ORDER, crewSeafarers, crewReliefSeed, crewPastAssignments,
     seafarerById(), seafarerIdByName(), crewSignoffDate(), crewRelief(),
     crewOnDate(), crewEvents(), fullNameLF(), barLabel(), seafarerAge(),
     CREW_PORTS, crewPort(), seafarerTours(), lastTourOf(), dedicatedClientOf(),
     availabilityOf()

   allSeafarers (seafarers.js) is the candidate pool used by RFEs.
   crewSeafarers holds everyone else who serves / served on client
   vessels, kept separate so they don't appear as RFE candidates.
──────────────────────────────────────────────────────────────── */

var CREW_RANK_ORDER = ['Master','Chief Officer','Second Officer','Third Officer',
                       'Chief Engineer','Second Engineer','Third Engineer',
                       'Bosun','Able Seaman','Oiler','Ordinary Seaman'];

var crewSeafarers = [
    // ── Currently on board (ids referenced by vessels.js onboard.seafarerId) ──
    { id:1001, name:'RAMON ESTRADA',          lastName:'ESTRADA', firstName:'RAMON', rank:'Master',         nationality:'Filipino',   birthDate:'1970-08-12' },
    { id:1002, name:'IVAN PETROV',            lastName:'PETROV', firstName:'IVAN', rank:'Chief Engineer',  nationality:'Russian',    birthDate:'1972-02-03' },
    { id:1003, name:'MARIO SANTOS',           lastName:'SANTOS', firstName:'MARIO', rank:'Second Engineer', nationality:'Filipino',   birthDate:'1985-11-21' },
    { id:1004, name:'FELIX MERCADO',          lastName:'MERCADO', firstName:'FELIX', rank:'Bosun',           nationality:'Filipino',   birthDate:'1981-06-09' },
    { id:1005, name:'PEDRO RAMOS',            lastName:'RAMOS', firstName:'PEDRO', rank:'Able Seaman',         nationality:'Filipino',   birthDate:'1990-04-17' },
    { id:1006, name:'MARK VILLANUEVA',        lastName:'VILLANUEVA', firstName:'MARK', rank:'Oiler',           nationality:'Filipino',   birthDate:'1992-09-30' },
    { id:1007, name:'DMITRI VOLKOV',          lastName:'VOLKOV', firstName:'DMITRI', rank:'Master',         nationality:'Russian',    birthDate:'1969-12-01' },
    { id:1008, name:'CARLOS MENDOZA',         lastName:'MENDOZA', firstName:'CARLOS', rank:'Chief Officer',   nationality:'Filipino',   birthDate:'1984-03-22' },
    { id:1009, name:'SERGEI KOZLOV',          lastName:'KOZLOV', firstName:'SERGEI', rank:'Chief Engineer',  nationality:'Russian',    birthDate:'1971-07-15' },
    { id:1010, name:'ANTONIO REYES',          lastName:'REYES', firstName:'ANTONIO', rank:'Bosun',           nationality:'Filipino',   birthDate:'1979-10-05' },
    { id:1011, name:'ALEXANDER KIM',          lastName:'KIM', firstName:'ALEXANDER', rank:'Master',         nationality:'Korean',     birthDate:'1973-01-27' },
    { id:1012, name:'ROBERTO LINO',           lastName:'LINO', firstName:'ROBERTO', rank:'Chief Officer',   nationality:'Filipino',   birthDate:'1983-05-28' },
    { id:1013, name:'RAMIR ESPINOSA',         lastName:'ESPINOSA', firstName:'RAMIR', rank:'Bosun',           nationality:'Filipino',   birthDate:'1980-01-19' },
    { id:1014, name:'NOEL BACALTOS',          lastName:'BACALTOS', firstName:'NOEL', rank:'Ordinary Seaman', nationality:'Filipino',   birthDate:'1998-07-07' },
    { id:1015, name:'GEORGIOS STAVROS',       lastName:'STAVROS', firstName:'GEORGIOS', rank:'Master',         nationality:'Greek',      birthDate:'1968-04-11' },
    { id:1016, name:'LUIGI FERRARI',          lastName:'FERRARI', firstName:'LUIGI', rank:'Chief Engineer',  nationality:'Italian',    birthDate:'1970-09-23' },
    { id:1017, name:'PAULO SILVA',            lastName:'SILVA', firstName:'PAULO', rank:'Second Engineer', nationality:'Portuguese', birthDate:'1986-02-14' },
    { id:1018, name:'ARIS NIKOLAOU',          lastName:'NIKOLAOU', firstName:'ARIS', rank:'Second Officer',  nationality:'Greek',      birthDate:'1991-12-30' },
    { id:1019, name:'KONSTANTINOS PAPADAKIS', lastName:'PAPADAKIS', firstName:'KONSTANTINOS', rank:'Master',         nationality:'Greek',      birthDate:'1967-06-02' },
    { id:1020, name:'YIANNIS MANOLIS',        lastName:'MANOLIS', firstName:'YIANNIS', rank:'Chief Officer',   nationality:'Greek',      birthDate:'1982-08-18' },
    { id:1021, name:'SPIROS ALEXIOU',         lastName:'ALEXIOU', firstName:'SPIROS', rank:'Chief Engineer',  nationality:'Greek',      birthDate:'1966-11-09' },
    { id:1022, name:'TANAKA HIROSHI',         lastName:'TANAKA', firstName:'HIROSHI', rank:'Master',         nationality:'Japanese',   birthDate:'1969-03-03' },
    { id:1023, name:'PARK JOON-HO',           lastName:'PARK', firstName:'JOON-HO', rank:'Chief Officer',   nationality:'Korean',     birthDate:'1985-10-10' },
    { id:1024, name:'LEE SUNG-MIN',           lastName:'LEE', firstName:'SUNG-MIN', rank:'Chief Engineer',  nationality:'Korean',     birthDate:'1974-05-05' },
    { id:1025, name:'NGUYEN VAN AN',          lastName:'NGUYEN', firstName:'VAN AN', rank:'Second Officer',  nationality:'Vietnamese', birthDate:'1993-01-25' },

    // ── Former crew (reliefs in crewReliefSeed) ──
    { id:1101, name:'ANDREI POPESCU',         lastName:'POPESCU', firstName:'ANDREI', rank:'Chief Officer',   nationality:'Romanian',   birthDate:'1983-04-02' },
    { id:1102, name:'ROMEO DELA ROSA',        lastName:'DELA ROSA', firstName:'ROMEO', rank:'Able Seaman',         nationality:'Filipino',   birthDate:'1989-02-11' },
    { id:1103, name:'JOEL TORRES',            lastName:'TORRES', firstName:'JOEL', rank:'Oiler',           nationality:'Filipino',   birthDate:'1991-08-24' },
    { id:1104, name:'MIKHAIL ORLOV',          lastName:'ORLOV', firstName:'MIKHAIL', rank:'Chief Officer',   nationality:'Ukrainian',  birthDate:'1980-12-15' },
    { id:1105, name:'GIANNIS KARRAS',         lastName:'KARRAS', firstName:'GIANNIS', rank:'Chief Engineer',  nationality:'Greek',      birthDate:'1969-05-19' },
    { id:1106, name:'JERICHO LAUREL',         lastName:'LAUREL', firstName:'JERICHO', rank:'Second Officer',  nationality:'Filipino',   birthDate:'1992-03-08' },
    { id:1107, name:'EDGAR BAUTISTA',         lastName:'BAUTISTA', firstName:'EDGAR', rank:'Bosun',           nationality:'Filipino',   birthDate:'1978-07-21' },
    { id:1108, name:'SANJAY MEHTA',           lastName:'MEHTA', firstName:'SANJAY', rank:'Master',         nationality:'Indian',     birthDate:'1971-10-30' },
    { id:1109, name:'RAHUL NAIR',             lastName:'NAIR', firstName:'RAHUL', rank:'Chief Officer',   nationality:'Indian',     birthDate:'1986-06-14' },
    { id:1110, name:'ARNEL CRUZ',             lastName:'CRUZ', firstName:'ARNEL', rank:'Bosun',           nationality:'Filipino',   birthDate:'1982-09-03' },
    { id:1111, name:'KEVIN AQUINO',           lastName:'AQUINO', firstName:'KEVIN', rank:'Ordinary Seaman', nationality:'Filipino',   birthDate:'1999-01-16' },
    { id:1112, name:'DIMITRIS KOUTSOS',       lastName:'KOUTSOS', firstName:'DIMITRIS', rank:'Master',         nationality:'Greek',      birthDate:'1966-02-25' },
    { id:1113, name:'TOMASZ NOWAK',           lastName:'NOWAK', firstName:'TOMASZ', rank:'Chief Engineer',  nationality:'Polish',     birthDate:'1973-11-12' },
    { id:1114, name:'NIKOLAS VLACHOS',        lastName:'VLACHOS', firstName:'NIKOLAS', rank:'Second Officer',  nationality:'Greek',      birthDate:'1990-04-29' },
    { id:1115, name:'EVANGELOS LAMBROU',      lastName:'LAMBROU', firstName:'EVANGELOS', rank:'Master',         nationality:'Greek',      birthDate:'1965-08-07' },
    { id:1116, name:'MARIOS CHRISTOU',        lastName:'CHRISTOU', firstName:'MARIOS', rank:'Chief Officer',   nationality:'Cypriot',    birthDate:'1984-12-01' },
    { id:1117, name:'PAVLO BONDARENKO',       lastName:'BONDARENKO', firstName:'PAVLO', rank:'Chief Engineer',  nationality:'Ukrainian',  birthDate:'1970-03-17' },
    { id:1118, name:'KENJI WATANABE',         lastName:'WATANABE', firstName:'KENJI', rank:'Master',         nationality:'Japanese',   birthDate:'1968-10-22' },
    { id:1119, name:'CHOI MIN-JUN',           lastName:'CHOI', firstName:'MIN-JUN', rank:'Chief Officer',   nationality:'Korean',     birthDate:'1987-07-09' },
    { id:1120, name:'TRAN VAN MINH',          lastName:'TRAN', firstName:'VAN MINH', rank:'Chief Engineer',  nationality:'Vietnamese', birthDate:'1975-05-26' },
    { id:1121, name:'HENDRA WIJAYA',          lastName:'WIJAYA', firstName:'HENDRA', rank:'Second Officer',  nationality:'Indonesian', birthDate:'1994-02-18' },

    // ── Approved reliefs named in vessels.js (rfa.confirmedSeafarer) ──
    { id:1201, name:'CARLOS REYES',           lastName:'REYES', firstName:'CARLOS', rank:'Second Engineer', nationality:'Filipino',   birthDate:'1988-06-21' },
    { id:1202, name:'JOSE GARCIA',            lastName:'GARCIA', firstName:'JOSE', rank:'Oiler',           nationality:'Filipino',   birthDate:'1993-11-04' },
];

/* Two-person rotation per position: the relief served the tour before the
   current holder, and the current holder served the tour before that.
   Relief ids below 1000 are pool seafarers (seafarers.js) — former crew
   who are now available as candidates. */
var crewReliefSeed = [
    { vesselId:'v1', rank:'Master',         reliefId:301  },
    { vesselId:'v1', rank:'Chief Officer',   reliefId:1101 },
    { vesselId:'v1', rank:'Chief Engineer',  reliefId:501  },
    { vesselId:'v1', rank:'Second Engineer', reliefId:201  },
    { vesselId:'v1', rank:'Bosun',           reliefId:601  },
    { vesselId:'v1', rank:'Able Seaman',         reliefId:1102 },
    { vesselId:'v1', rank:'Oiler',           reliefId:1103 },
    { vesselId:'v2', rank:'Master',         reliefId:302  },
    { vesselId:'v2', rank:'Chief Officer',   reliefId:1104 },
    { vesselId:'v2', rank:'Chief Engineer',  reliefId:1105 },
    { vesselId:'v2', rank:'Second Officer',  reliefId:1106 },
    { vesselId:'v2', rank:'Bosun',           reliefId:1107 },
    { vesselId:'v3', rank:'Master',         reliefId:1108 },
    { vesselId:'v3', rank:'Chief Officer',   reliefId:1109 },
    { vesselId:'v3', rank:'Bosun',           reliefId:1110 },
    { vesselId:'v3', rank:'Ordinary Seaman', reliefId:1111 },
    { vesselId:'v4', rank:'Master',         reliefId:1112 },
    { vesselId:'v4', rank:'Chief Engineer',  reliefId:1113 },
    { vesselId:'v4', rank:'Second Engineer', reliefId:202  },
    { vesselId:'v4', rank:'Second Officer',  reliefId:1114 },
    { vesselId:'v5', rank:'Master',         reliefId:1115 },
    { vesselId:'v5', rank:'Chief Officer',   reliefId:1116 },
    { vesselId:'v5', rank:'Chief Engineer',  reliefId:1117 },
    { vesselId:'v6', rank:'Master',         reliefId:1118 },
    { vesselId:'v6', rank:'Chief Officer',   reliefId:1119 },
    { vesselId:'v6', rank:'Chief Engineer',  reliefId:1120 },
    { vesselId:'v6', rank:'Second Officer',  reliefId:1121 },
];

/* Completed tours, generated backwards from each current embark date:
   relief tour 5–7 months ending on current embark, and before that
   the current holder's previous 6-month tour. */
var crewPastAssignments = (function () {
    var out = [];
    crewReliefSeed.forEach(function (s, i) {
        var v   = allVessels.find(x => x.id === s.vesselId);
        var row = v && v.ranks.find(r => r.rank === s.rank);
        if (!row || !row.onboard) return;
        var embark      = row.onboard.embark;
        var reliefStart = isoDate(addM(d(embark), -(5 + i % 3)));
        var prevStart   = isoDate(addM(d(reliefStart), -6));
        out.push({ vesselId: v.id, rank: s.rank, seafarerId: s.reliefId,              embark: reliefStart, signoff: embark });
        out.push({ vesselId: v.id, rank: s.rank, seafarerId: row.onboard.seafarerId, embark: prevStart,   signoff: reliefStart });
    });
    return out;
})();

function seafarerById(id) {
    if (id == null) return null;
    return allSeafarers.find(s => s.id === id) || crewSeafarers.find(s => s.id === id) || null;
}

function seafarerIdByName(name) {
    if (!name) return null;
    var s = allSeafarers.find(x => x.name === name) || crewSeafarers.find(x => x.name === name);
    return s ? s.id : null;
}

// Planned sign-off of the current holder: relief embark > RFS date > contract end
function crewSignoffDate(row) {
    if (row.rfr_rfe) return row.rfr_rfe.embarkDate;
    if (row.rfs)     return row.rfs.signoffDate;
    return row.onboard.signoff;
}

/* Planned relief for a rank row, or null.
   stage: 'search' | 'approval' | 'preparation'
   Replacement RFEs read live state from erpStore.rfaRows when the RFAs
   view has built it, so approvals made there are reflected here. */
function crewRelief(vessel, row) {
    if (row.rfr_rfe) {
        var live = erpStore.rfaRows && erpStore.rfaRows.replacement
            && erpStore.rfaRows.replacement.find(x => x.rfeNo === row.rfr_rfe.rfaNo);
        var name = live ? (live.confirmedSeafarer || null) : (row.rfr_rfe.confirmedSeafarer || null);
        var stage = live
            ? (live.rfeStatus === 'OnPreparation' ? 'preparation' : 'search')
            : (row.rfr_rfe.status === 'active' ? 'search' : 'preparation');
        return { date: row.rfr_rfe.embarkDate, port: row.rfr_rfe.port, ref: row.rfr_rfe.rfaNo,
                 name, seafarerId: seafarerIdByName(name), stage };
    }
    if (row.rfa && (!row.rfa.type || row.rfa.type === 'Replace')) {
        var stage2 = { approval:'approval', deployment:'preparation', preparation:'preparation' }[row.rfa.status] || 'search';
        // The relief is only named once approved (stage 'preparation')
        var name2  = stage2 === 'preparation' ? (row.rfa.confirmedSeafarer || null) : null;
        return { date: row.onboard.signoff, port: crewPort(vessel.id, row.rfa.rfaNo), ref: row.rfa.rfaNo,
                 name: name2, seafarerId: seafarerIdByName(name2), stage: stage2 };
    }
    return null;
}

/* Crew list of a vessel on a given date (ISO string), one entry per position.
   kind: 'past'    — completed tour (date before today)
         'current' — the person on board now; on or before today, or later
                     until their planned sign-off
         'planned' — the relief expected on board after the planned sign-off
         'unknown' — date precedes the recorded history */
function crewOnDate(vessel, dateIso) {
    var today = isoDate(TODAY);
    var out = vessel.ranks.map(function (row) {
        var base = { vesselId: vessel.id, rank: row.rank, isRating: !!row.isRating };
        var past = crewPastAssignments.find(a =>
            a.vesselId === vessel.id && a.rank === row.rank && a.embark <= dateIso && dateIso < a.signoff);
        if (past) {
            return Object.assign(base, { kind: 'past', seafarerId: past.seafarerId,
                                         embark: past.embark, signoff: past.signoff });
        }
        var ob = row.onboard;
        if (!ob) return Object.assign(base, { kind: 'unknown' });
        var off    = crewSignoffDate(row);
        var relief = crewRelief(vessel, row);
        if (dateIso >= ob.embark && (dateIso <= today || dateIso < off)) {
            return Object.assign(base, { kind: 'current',
                seafarerId: ob.seafarerId || seafarerIdByName(ob.name), name: ob.name,
                embark: ob.embark, signoff: off, overdue: off < today, relief });
        }
        if (dateIso >= off) {
            return Object.assign(base, { kind: 'planned',
                seafarerId: relief && relief.seafarerId, name: relief && relief.name,
                embark: off, relief, ref: relief ? relief.ref : (row.rfs && row.rfs.rfaNo) });
        }
        return Object.assign(base, { kind: 'unknown' });
    });
    return out.sort((a, b) => CREW_RANK_ORDER.indexOf(a.rank) - CREW_RANK_ORDER.indexOf(b.rank));
}

/* Pending crew changes of a vessel, sorted by date.
   type: 'signoff' | 'embark' | 'extension' | 'promotion'
   stage: 'requested' | 'relief' | 'contract' (sign-off) · 'search' | 'approval' |
          'preparation' (embark) · RFA status (extension / promotion) */
function crewEvents(vessel) {
    var today = isoDate(TODAY);
    var ev = [];
    var linkedRfe = {};
    vessel.ranks.forEach(function (row) {
        var ob = row.onboard;
        if (!ob) return;
        var relief = crewRelief(vessel, row);
        if (row.rfr_rfe) linkedRfe[row.rfr_rfe.rfaNo] = true;
        ev.push({ type: 'signoff', date: crewSignoffDate(row), rank: row.rank,
                  seafarerId: ob.seafarerId, name: ob.name,
                  ref: row.rfs ? row.rfs.rfaNo : (relief ? relief.ref : null),
                  port: row.rfs ? row.rfs.port : null,
                  stage: row.rfs ? 'requested' : (relief ? 'relief' : 'contract') });
        if (relief) {
            ev.push({ type: 'embark', date: relief.date, rank: row.rank,
                      seafarerId: relief.seafarerId, name: relief.name,
                      ref: relief.ref, port: relief.port, stage: relief.stage });
        }
        if (row.rfa && row.rfa.type === 'Extend') {
            ev.push({ type: 'extension', date: row.rfa.rfaEnd, rank: row.rank,
                      seafarerId: ob.seafarerId, name: ob.name,
                      ref: row.rfa.rfaNo, port: null, stage: row.rfa.status });
        }
        if (row.rfa && row.rfa.type === 'Promote') {
            ev.push({ type: 'promotion', date: row.rfa.rfaEnd, rank: row.rank, newRank: row.rfa.newRank || null,
                      seafarerId: ob.seafarerId, name: ob.name,
                      ref: row.rfa.rfaNo, port: null, stage: row.rfa.status });
        }
    });
    // Standalone RFEs (not the embark half of a replacement)
    erpStore.rfeRows
        .filter(r => r.vesselId === vessel.id && !linkedRfe[r.rfaNo])
        .forEach(function (r) {
            var live = erpStore.rfaRows && erpStore.rfaRows.embarkation
                && erpStore.rfaRows.embarkation.find(x => x.rfaNo === r.rfaNo);
            var name = live ? (live.confirmedSeafarer || null) : (r.confirmedSeafarer || null);
            var stage = live
                ? (live.rfeStatus === 'OnPreparation' ? 'preparation' : 'search')
                : (r.status === 'active' ? 'search' : 'preparation');
            ev.push({ type: 'embark', date: r.embarkDate, rank: r.rank,
                      seafarerId: seafarerIdByName(name), name,
                      ref: r.rfaNo, port: r.port, stage });
        });
    ev.forEach(e => { e.vesselId = vessel.id; e.overdue = e.date < today; });
    return ev.sort((a, b) => a.date.localeCompare(b.date)
        || CREW_RANK_ORDER.indexOf(a.rank) - CREW_RANK_ORDER.indexOf(b.rank));
}

// ── Person helpers ────────────────────────────────────────────

// "SURNAME, FIRST" (Atlantis full-name format)
function fullNameLF(s) {
    if (!s) return '';
    return s.lastName ? s.lastName + ', ' + s.firstName : s.name;
}

// "SURNAME F." (Atlantis Gantt bar label)
function barLabel(s) {
    if (!s) return '';
    return s.lastName ? s.lastName + ' ' + s.firstName[0] + '.' : shortName(s.name);
}

// Age in whole years (pool seafarers carry age, crew records carry birthDate)
function seafarerAge(s, refIso) {
    if (!s) return null;
    if (!s.birthDate) return s.age != null ? s.age : null;
    var ref = d(refIso || isoDate(TODAY)), b = d(s.birthDate);
    var age = ref.getUTCFullYear() - b.getUTCFullYear();
    if (ref.getUTCMonth() < b.getUTCMonth() ||
        (ref.getUTCMonth() === b.getUTCMonth() && ref.getUTCDate() < b.getUTCDate())) age--;
    return age;
}

// Deterministic port for data without one (legacy RFAs, past tours)
var CREW_PORTS = {
    v1: ['Port of Manila', 'Singapore', 'Fujairah', 'Ras Tanura'],
    v2: ['Rotterdam', 'Santos', 'Qingdao', 'Port Hedland'],
    v3: ['Singapore', 'Rotterdam', 'Shanghai', 'Hamburg'],
    v4: ['Piraeus', 'Antwerp', 'Houston', 'Ulsan'],
    v5: ['Piraeus', 'Fujairah', 'Sikka', 'Augusta'],
    v6: ['Singapore', 'Yokohama', 'Busan', 'Bremerhaven'],
};
function crewPort(vesselId, key) {
    var ports = CREW_PORTS[vesselId] || ['Piraeus'];
    var h = 0;
    String(key).split('').forEach(c => { h = (h * 31 + c.charCodeAt(0)) >>> 0; });
    return ports[h % ports.length];
}

// All tours of a seafarer on client vessels — completed + current, oldest first
function seafarerTours(seafarerId) {
    var tours = crewPastAssignments
        .filter(a => a.seafarerId === seafarerId)
        .map(a => Object.assign({ current: false }, a));
    allVessels.forEach(v => v.ranks.forEach(r => {
        if (r.onboard && r.onboard.seafarerId === seafarerId) {
            tours.push({ vesselId: v.id, rank: r.rank, seafarerId, current: true,
                         embark: r.onboard.embark, signoff: crewSignoffDate(r) });
        }
    }));
    return tours.sort((a, b) => a.embark.localeCompare(b.embark));
}

function lastTourOf(seafarerId) {
    var t = seafarerTours(seafarerId);
    return t.length ? t[t.length - 1] : null;
}

// Client the seafarer is dedicated to: owner of the vessel of their latest tour
function dedicatedClientOf(seafarerId) {
    var t = lastTourOf(seafarerId);
    if (!t) return null;
    var c = allClientsData.find(c => c.vesselIds.includes(t.vesselId));
    return c ? c.id : null;
}

// Availability date: pool record, else 2 months after the last sign-off
function availabilityOf(seafarerId) {
    var s = seafarerById(seafarerId);
    if (s && s.availDate) return s.availDate;
    var t = lastTourOf(seafarerId);
    return t ? isoDate(addM(d(t.signoff), 2)) : null;
}
