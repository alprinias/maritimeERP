/* ── data/seafarers.js ────────────────────────────────────────
   Seafarer pool and seed RFE rows for Maritime ERP.
   Depends on: utils.js (must load first).
   Exposes globals: window.allSeafarers, window.seedRfeRows
──────────────────────────────────────────────────────────────── */

var allSeafarers = [
    // ── Deck Officers ────────────────────────────────────────
    { id:101, name:'JUAN DELA CRUZ',      lastName:'DELA CRUZ', firstName:'JUAN', rank:'Chief Officer',    age:34, bmi:23.4, availDate:'2026-05-18', cesStcw:87, cesEnglish:79, nationality:'Filipino', category:'Client Ex-Crew',
      services:[{ count:3, months:27, label:'At Rank', rank:'Chief Officer'},{ count:4, months:36, label:'As Officer', rank:'Second Officer'},{ count:2, months:14, label:'Other', rank:'Third Officer'}]},
    { id:102, name:'HANS MÜLLER',          lastName:'MÜLLER', firstName:'HANS', rank:'Chief Officer',    age:41, bmi:26.1, availDate:'2026-05-22', cesStcw:92, cesEnglish:95, nationality:'German',   category:'Other Ex-Crew',
      services:[{ count:5, months:48, label:'At Rank', rank:'Chief Officer'},{ count:3, months:28, label:'As Officer', rank:'Second Officer'},{ count:2, months:18, label:'Other', rank:'Third Officer'}]},
    { id:103, name:'PETROS PAPPAS',        lastName:'PAPPAS', firstName:'PETROS', rank:'Chief Officer',    age:29, bmi:24.8, availDate:'2026-05-10', cesStcw:74, cesEnglish:71, nationality:'Greek',    category:'New Candidates',
      services:[{ count:1, months:9,  label:'At Rank', rank:'Chief Officer'},{ count:3, months:22, label:'As Officer', rank:'Second Officer'},{ count:1, months:8,  label:'Other', rank:'Third Officer'}]},
    // ── Engine Officers ──────────────────────────────────────
    { id:201, name:'RODRIGO SANTOS',       lastName:'SANTOS', firstName:'RODRIGO', rank:'Second Engineer',  age:38, bmi:22.9, availDate:'2026-05-05', cesStcw:85, cesEnglish:76, nationality:'Filipino', category:'Client Ex-Crew',
      services:[{ count:4, months:36, label:'At Rank', rank:'Second Engineer'},{ count:3, months:27, label:'As Officer', rank:'Third Engineer'},{ count:1, months:9, label:'Other', rank:'Fourth Engineer'}]},
    { id:202, name:'MARCO ESPOSITO',       lastName:'ESPOSITO', firstName:'MARCO', rank:'Second Engineer',  age:44, bmi:27.3, availDate:'2026-05-08', cesStcw:91, cesEnglish:88, nationality:'Italian',  category:'Client Ex-Crew',
      services:[{ count:7, months:63, label:'At Rank', rank:'Second Engineer'},{ count:4, months:36, label:'As Officer', rank:'Third Engineer'},{ count:2, months:16, label:'Other', rank:'Fourth Engineer'}]},
    // ── Captains ─────────────────────────────────────────────
    { id:301, name:'NIKOS PAPADOPOULOS',   lastName:'PAPADOPOULOS', firstName:'NIKOS', rank:'Master',          age:52, bmi:28.2, availDate:'2026-05-02', cesStcw:96, cesEnglish:91, nationality:'Greek',    category:'Client Ex-Crew',
      services:[{ count:12, months:132, label:'At Rank', rank:'Master'},{ count:6, months:60, label:'As Officer', rank:'Chief Officer'},{ count:4, months:36, label:'Other', rank:'Second Officer'}]},
    { id:302, name:'VLADIMIR PETROV',      lastName:'PETROV', firstName:'VLADIMIR', rank:'Master',          age:49, bmi:26.8, availDate:'2026-05-07', cesStcw:90, cesEnglish:72, nationality:'Russian',  category:'Client Ex-Crew',
      services:[{ count:9, months:99,  label:'At Rank', rank:'Master'},{ count:5, months:54, label:'As Officer', rank:'Chief Officer'},{ count:3, months:27, label:'Other', rank:'Second Officer'}]},
    { id:303, name:'JOSE MIRANDA',         lastName:'MIRANDA', firstName:'JOSE', rank:'Master',          age:47, bmi:23.5, availDate:'2026-05-05', cesStcw:89, cesEnglish:84, nationality:'Filipino', category:'Other Ex-Crew',
      services:[{ count:8, months:88,  label:'At Rank', rank:'Master'},{ count:5, months:48, label:'As Officer', rank:'Chief Officer'},{ count:3, months:24, label:'Other', rank:'Second Officer'}]},
    { id:304, name:'ALEXANDROS STAVROS',   lastName:'STAVROS', firstName:'ALEXANDROS', rank:'Master',          age:45, bmi:25.0, availDate:'2026-05-09', cesStcw:83, cesEnglish:78, nationality:'Greek',    category:'New Candidates',
      services:[{ count:4, months:44,  label:'At Rank', rank:'Master'},{ count:6, months:54, label:'As Officer', rank:'Chief Officer'},{ count:4, months:36, label:'Other', rank:'Second Officer'}]},
    // ── Second Officers ──────────────────────────────────────
    { id:401, name:'FELIX GARCIA',         lastName:'GARCIA', firstName:'FELIX', rank:'Second Officer',   age:31, bmi:22.1, availDate:'2026-05-12', cesStcw:80, cesEnglish:77, nationality:'Filipino', category:'Client Ex-Crew',
      services:[{ count:2, months:18, label:'At Rank', rank:'Second Officer'},{ count:3, months:24, label:'As Officer', rank:'Third Officer'},{ count:1, months:8, label:'Other', rank:'Cadet'}]},
    // ── Chief Engineers ──────────────────────────────────────
    { id:501, name:'DMITRI SOKOLOV',       lastName:'SOKOLOV', firstName:'DMITRI', rank:'Chief Engineer',   age:48, bmi:27.8, availDate:'2026-05-03', cesStcw:94, cesEnglish:68, nationality:'Russian',  category:'Client Ex-Crew',
      services:[{ count:10, months:110, label:'At Rank', rank:'Chief Engineer'},{ count:6, months:55, label:'As Officer', rank:'Second Engineer'},{ count:3, months:26, label:'Other', rank:'Third Engineer'}]},
    { id:502, name:'ANASTASIOS KYRIAKOU',  lastName:'KYRIAKOU', firstName:'ANASTASIOS', rank:'Chief Engineer',   age:51, bmi:26.2, availDate:'2026-05-06', cesStcw:91, cesEnglish:82, nationality:'Greek',    category:'Other Ex-Crew',
      services:[{ count:8, months:92,  label:'At Rank', rank:'Chief Engineer'},{ count:5, months:48, label:'As Officer', rank:'Second Engineer'},{ count:2, months:18, label:'Other', rank:'Third Engineer'}]},
    // ── Bosuns ───────────────────────────────────────────────
    { id:601, name:'DANNY PADILLA',        lastName:'PADILLA', firstName:'DANNY', rank:'Bosun',            age:39, bmi:24.5, availDate:'2026-05-14', cesStcw:78, cesEnglish:70, nationality:'Filipino', category:'Client Ex-Crew',
      services:[{ count:6, months:54, label:'At Rank', rank:'Bosun'},{ count:4, months:32, label:'As Officer', rank:'AB'},{ count:2, months:14, label:'Other', rank:'OS'}]},
];

/* Seed RFE rows — standalone embarkation requests.
   These pre-populate rfeRows in the Rotation view's data(). */
var seedRfeRows = [
    // MV Sea Star (v1) — Chief Officer vacancy
    {
        vesselId: 'v1', rfaNo: 'RFE-2011', rank: 'Chief Officer',
        dateCreated: '2026-05-01', embarkDate: '2026-07-01',
        port: 'Port of Manila', contractMonths: 6, contractVariation: 1,
        serviceEnd: '2027-01-01', status: 'active',
    },
    // MV Atlantic Pride (v2) — Captain vacancy
    {
        vesselId: 'v2', rfaNo: 'RFE-2019', rank: 'Master',
        dateCreated: '2026-05-05', embarkDate: '2026-06-20',
        port: 'Port of Rotterdam', contractMonths: 6, contractVariation: 1,
        serviceEnd: '2026-12-20', status: 'active',
    },
    // Alpha Prime (v4) — Second Engineer vacancy (on preparation)
    {
        vesselId: 'v4', rfaNo: 'RFE-2024', rank: 'Second Engineer',
        dateCreated: '2026-05-08', embarkDate: '2026-07-15',
        port: 'Piraeus', contractMonths: 7, contractVariation: 1,
        serviceEnd: '2027-02-15', status: 'preparation', confirmedSeafarer: 'MARCO ESPOSITO',
    },
];
