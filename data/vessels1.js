/* ── data/vessels.js ──────────────────────────────────────────
   Master vessel + rank-row data for Maritime ERP.
   Depends on: utils.js (TODAY, isoDate, addM — must load first).
   Exposes global: window.allVessels
──────────────────────────────────────────────────────────────── */

/* Each rank row shape:
   onboard : { name, shortName, embark, signoff, contract }
   rfa     : null | { rfaNo, type('Extend'|'Replace'|'Promote'), status,
                      rfaStart, rfaEnd, newRank?, proposed:[], confirmedSeafarer }
   rfs     : null | { rfaNo, dateCreated, signoffDate, port, status }
   rfr_rfe : null | { rfaNo, dateCreated, embarkDate, port, status }
*/

var allVessels = [

    // ─── Global Shipping Ltd ──────────────────────────────────
    {
        id:'v1', client:'Global Shipping Ltd',
        name:'MV Sea Star', type:'Oil Tanker', flag:'Panama',
        imo:'9412831', built:2011, gt:29800,
        engineType:'MAN B&W 6S60MC-C', enginePower:'12 960 kW',
        classificationSociety:'Bureau Veritas', piClub:'UK P&I Club',
        hullInsurer:"Lloyd's of London", hullValue:'USD 18,500,000',
        vesselRanks: null,
        ranks:[
            {
                rank:'Captain',
                onboard:{ name:'RAMON ESTRADA',   shortName:'R. Estrada',   embark:'2025-12-15', signoff:'2026-06-15', contract:'6 months' },
                rfa:{ rfaNo:'RFR-1042', status:'approval',
                      rfaStart:'2026-04-15', rfaEnd:'2026-12-15',
                      proposed:[
                          { name:'NIKOS PAPADOPOULOS', nationality:'Greek',   service:228 },
                          { name:'VLADIM. PETROV',     nationality:'Russian', service:192 },
                      ], confirmedSeafarer:null }
            },
            {
                rank:'Chief Officer',
                onboard:{ name:'JUAN DELA CRUZ',  shortName:'J. Dela Cruz', embark:'2026-01-01', signoff:'2026-07-01', contract:'6 months' },
                rfa:{ rfaNo:'RFR-1058', status:'active',
                      rfaStart:'2026-05-01', rfaEnd:'2027-01-01',
                      proposed:[
                          { name:'PETROS PAPPAS', nationality:'Greek',  service:39 },
                          { name:'HANS MÜLLER',   nationality:'German', service:94 },
                      ], confirmedSeafarer:null }
            },
            {
                rank:'Chief Engineer',
                onboard:{ name:'IVAN PETROV',     shortName:'I. Petrov',    embark:'2026-05-01', signoff:'2026-11-01', contract:'6 months' },
                rfa:{ rfaNo:'RFR-1077', status:'active',
                      rfaStart:'2026-09-01', rfaEnd:'2027-05-01',
                      proposed:[], confirmedSeafarer:null }
            },
            {
                rank:'Second Engineer',
                onboard:{ name:'MARIO SANTOS',    shortName:'M. Santos',    embark:'2026-02-01', signoff:'2026-08-01', contract:'6 months' },
                rfa:{ rfaNo:'RFR-1061', status:'deployment',
                      rfaStart:'2026-06-01', rfaEnd:'2027-02-01',
                      proposed:[
                          { name:'CARLOS REYES', nationality:'Filipino', service:26 },
                          { name:'AHMED HASSAN', nationality:'Egyptian', service:46 },
                      ], confirmedSeafarer:'CARLOS REYES' }
            },
            {
                rank:'Bosun',
                onboard:{ name:'FELIX MERCADO',   shortName:'F. Mercado',   embark:'2026-03-15', signoff:'2026-09-15', contract:'6 months' },
                rfa:{ rfaNo:'RFR-1071', status:'active',
                      rfaStart:'2026-07-15', rfaEnd:'2027-03-15',
                      proposed:[], confirmedSeafarer:null }
            },
            {
                rank:'AB Deck', isRating: true,
                onboard:{ name:'PEDRO RAMOS',     shortName:'P. Ramos',     embark:'2026-04-01', signoff:'2026-10-01', contract:'6 months' },
                rfa:{ rfaNo:'RFR-1082', status:'active',
                      rfaStart:'2026-08-01', rfaEnd:'2027-04-01',
                      proposed:[], confirmedSeafarer:null }
            },
            {
                rank:'Oiler', isRating: true,
                onboard:{ name:'MARK VILLANUEVA', shortName:'M. Villanueva', embark:'2026-02-10', signoff:'2026-08-10', contract:'6 months' },
                rfa:{ rfaNo:'RFR-1083', status:'deployment',
                      rfaStart:'2026-06-10', rfaEnd:'2027-02-10',
                      proposed:[
                          { name:'JOSE GARCIA', nationality:'Filipino', service:18 },
                      ], confirmedSeafarer:'JOSE GARCIA' }
            },
        ]
    },
    {
        id:'v2', client:'Global Shipping Ltd',
        name:'MV Atlantic Pride', type:'Bulk Carrier', flag:'Marshall Islands',
        imo:'9387441', built:2009, gt:43200,
        engineType:'Wartsila 6RT-flex68', enginePower:'14 280 kW',
        classificationSociety:"Lloyd's Register", piClub:'North P&I Club',
        hullInsurer:'Gard Marine', hullValue:'USD 22,000,000',
        vesselRanks: null,
        vesselContract: [
            { rank:'Captain',        cba:'PNO IBF', hoursOfWork:40, otRate:null,  basicSalary:3460, guaranteedOt:3114, fixedOt:null, leavePay:1038, leaveSubsistence:70, allowance:10, suppWages:5 },
            { rank:'Chief Officer',  cba:'PNO IBF', hoursOfWork:40, otRate:null,  basicSalary:1850, guaranteedOt:1665, fixedOt:null, leavePay:555,  leaveSubsistence:70, allowance:10, suppWages:5 },
            { rank:'Second Officer', cba:'PNO IBF', hoursOfWork:40, otRate:null,  basicSalary:1405, guaranteedOt:1265, fixedOt:null, leavePay:422,  leaveSubsistence:70, allowance:10, suppWages:5 },
            { rank:'Third Officer',  cba:'PNO IBF', hoursOfWork:40, otRate:null,  basicSalary:1160, guaranteedOt:1044, fixedOt:null, leavePay:348,  leaveSubsistence:70, allowance:10, suppWages:5 },
            { rank:'Chief Engineer', cba:'PNO IBF', hoursOfWork:40, otRate:null,  basicSalary:3328, guaranteedOt:2995, fixedOt:null, leavePay:998,  leaveSubsistence:70, allowance:10, suppWages:5 },
            { rank:'Second Engineer',cba:'PNO IBF', hoursOfWork:40, otRate:null,  basicSalary:1850, guaranteedOt:1665, fixedOt:null, leavePay:555,  leaveSubsistence:70, allowance:10, suppWages:5 },
            { rank:'Third Engineer', cba:'PNO IBF', hoursOfWork:40, otRate:null,  basicSalary:1405, guaranteedOt:1265, fixedOt:null, leavePay:422,  leaveSubsistence:70, allowance:10, suppWages:5 },
            { rank:'Bosun',          cba:'PNO IBF', hoursOfWork:40, otRate:6.16,  basicSalary:854,  guaranteedOt:null, fixedOt:634,  leavePay:256,  leaveSubsistence:70, allowance:10, suppWages:5 },
            { rank:'AB Deck',        cba:'PNO IBF', hoursOfWork:40, otRate:5.09,  basicSalary:706,  guaranteedOt:null, fixedOt:524,  leavePay:212,  leaveSubsistence:70, allowance:10, suppWages:5 },
            { rank:'Oiler',          cba:'PNO IBF', hoursOfWork:40, otRate:5.09,  basicSalary:706,  guaranteedOt:null, fixedOt:524,  leavePay:212,  leaveSubsistence:70, allowance:10, suppWages:5 },
            { rank:'Ordinary Seaman',cba:'PNO IBF', hoursOfWork:40, otRate:3.85,  basicSalary:534,  guaranteedOt:null, fixedOt:397,  leavePay:160,  leaveSubsistence:70, allowance:10, suppWages:5 },
        ],
        ranks:[
            {
                rank:'Captain',
                onboard:{ name:'DMITRI VOLKOV',   shortName:'D. Volkov',    embark:'2026-02-01', signoff:'2026-08-01', contract:'6 months' },
                rfa:{ rfaNo:'RFR-1055', status:'active',
                      rfaStart:'2026-06-01', rfaEnd:'2027-02-01',
                      proposed:[], confirmedSeafarer:null }
            },
            {
                rank:'Chief Officer',
                onboard:{ name:'CARLOS MENDOZA',  shortName:'C. Mendoza',   embark:'2026-03-01', signoff:'2026-09-01', contract:'6 months' },
                rfa:{ rfaNo:'RFR-1066', status:'active',
                      rfaStart:'2026-07-01', rfaEnd:'2027-03-01',
                      proposed:[], confirmedSeafarer:null }
            },
            {
                rank:'Chief Engineer',
                onboard:{ name:'SERGEI KOZLOV',   shortName:'S. Kozlov',    embark:'2026-01-15', signoff:'2026-07-15', contract:'6 months' },
                rfa:{ rfaNo:'RFR-1048', status:'approval',
                      rfaStart:'2026-05-15', rfaEnd:'2027-01-15',
                      proposed:[
                          { name:'MARCO ESPOSITO', nationality:'Italian', service:63 },
                      ], confirmedSeafarer:null }
            },
            {
                rank:'Second Officer',
                onboard:{ name:'FELIX GARCIA',    shortName:'F. Garcia',    embark:'2026-04-01', signoff:'2026-10-01', contract:'6 months' },
                rfa: null
            },
            {
                rank:'Bosun', isRating: true,
                onboard:{ name:'ANTONIO REYES',   shortName:'A. Reyes',     embark:'2026-03-20', signoff:'2026-09-20', contract:'6 months' },
                rfa:{ rfaNo:'RFR-1072', status:'active',
                      rfaStart:'2026-07-20', rfaEnd:'2027-03-20',
                      proposed:[], confirmedSeafarer:null }
            },
        ]
    },

    // ─── Blue Water Corp ──────────────────────────────────────
    {
        id:'v3', client:'Blue Water Corp',
        name:'Oceanic Express', type:'Container', flag:'Liberia',
        imo:'9501227', built:2014, gt:72600,
        engineType:'MAN B&W 8S80ME-C9', enginePower:'35 280 kW',
        classificationSociety:'DNV GL', piClub:'Skuld P&I Club',
        hullInsurer:'Swiss Re', hullValue:'USD 55,000,000',
        vesselRanks: null,
        ranks:[
            {
                rank:'Captain',
                onboard:{ name:'ALEXANDER KIM',   shortName:'A. Kim',       embark:'2026-01-20', signoff:'2026-07-20', contract:'6 months' },
                rfa:{ rfaNo:'RFX-1074', type:'Extend', status:'active',
                      rfaStart:'2026-05-20', rfaEnd:'2026-10-20',
                      proposed:[], confirmedSeafarer:null }
            },
            {
                rank:'Chief Officer',
                onboard:{ name:'ROBERTO LINO',    shortName:'R. Lino',      embark:'2026-01-10', signoff:'2026-07-10', contract:'6 months' },
                rfa:{ rfaNo:'RFR-1051', type:'Replace', status:'approval',
                      rfaStart:'2026-05-10', rfaEnd:'2027-01-10',
                      proposed:[
                          { name:'PETROS PAPPAS', nationality:'Greek',  service:39 },
                          { name:'HANS MÜLLER',   nationality:'German', service:94 },
                      ], confirmedSeafarer:'PETROS PAPPAS' }
            },
            {
                rank:'Bosun', isRating: true,
                onboard:{ name:'RAMIR ESPINOSA',  shortName:'R. Espinosa',  embark:'2026-03-01', signoff:'2026-09-01', contract:'6 months' },
                rfa:{ rfaNo:'RFP-1090', type:'Promote', status:'active',
                      rfaStart:'2026-07-01', rfaEnd:'2027-03-01',
                      proposed:[], confirmedSeafarer:null }
            },
            {
                rank:'Ordinary Seaman', isRating: true,
                onboard:{ name:'NOEL BACALTOS',   shortName:'N. Bacaltos',  embark:'2026-04-01', signoff:'2026-10-01', contract:'6 months' },
                rfa: null
            },
        ]
    },

    // ─── Alpha Tankers ────────────────────────────────────────
    {
        id:'v4', client:'Alpha Tankers',
        name:'Alpha Prime', type:'Chemical Tanker', flag:'Greece',
        imo:'9344892', built:2008, gt:19500,
        engineType:'MAN B&W 6S50MC', enginePower:'9 480 kW',
        classificationSociety:'American Bureau of Shipping', piClub:'Greek P&I Club',
        hullInsurer:'Piraeus Insurance', hullValue:'USD 14,000,000',
        vesselRanks: null,
        ranks:[
            {
                rank:'Captain',
                onboard:{ name:'GEORGIOS STAVROS', shortName:'G. Stavros',  embark:'2026-02-15', signoff:'2026-08-15', contract:'6 months' },
                rfa:{ rfaNo:'RFR-1063', status:'active',
                      rfaStart:'2026-06-15', rfaEnd:'2027-02-15',
                      proposed:[], confirmedSeafarer:null }
            },
            {
                rank:'Chief Engineer',
                onboard:{ name:'LUIGI FERRARI',   shortName:'L. Ferrari',   embark:'2026-03-10', signoff:'2026-09-10', contract:'6 months' },
                rfa:{ rfaNo:'RFR-1074', status:'active',
                      rfaStart:'2026-07-10', rfaEnd:'2027-03-10',
                      proposed:[], confirmedSeafarer:null }
            },
            {
                rank:'Second Engineer',
                onboard:{ name:'PAULO SILVA',     shortName:'P. Silva',     embark:'2026-01-25', signoff:'2026-07-25', contract:'6 months' },
                rfa:{ rfaNo:'RFR-1049', status:'active',
                      rfaStart:'2026-05-25', rfaEnd:'2027-01-25',
                      proposed:[], confirmedSeafarer:null }
            },
            {
                rank:'Second Officer',
                onboard:{ name:'ARIS NIKOLAOU',   shortName:'A. Nikolaou',  embark:'2026-04-10', signoff:'2026-10-10', contract:'6 months' },
                rfa: null
            },
        ]
    },
    {
        id:'v5', client:'Alpha Tankers',
        name:'Alpha Horizon', type:'Oil Tanker', flag:'Greece',
        imo:'9489003', built:2012, gt:31200,
        engineType:'MAN B&W 7S60ME-C8', enginePower:'16 520 kW',
        classificationSociety:'DNV GL', piClub:'Greek P&I Club',
        hullInsurer:'Piraeus Insurance', hullValue:'USD 21,000,000',
        vesselRanks: null,
        ranks:[
            {
                rank:'Captain',
                onboard:{ name:'KONSTANTINOS PAPADAKIS', shortName:'K. Papadakis', embark:'2026-03-01', signoff:'2026-09-01', contract:'6 months' },
                rfa:{ rfaNo:'RFR-1068', status:'active',
                      rfaStart:'2026-07-01', rfaEnd:'2027-03-01',
                      proposed:[], confirmedSeafarer:null }
            },
            {
                rank:'Chief Officer',
                onboard:{ name:'YIANNIS MANOLIS', shortName:'Y. Manolis',   embark:'2026-02-20', signoff:'2026-08-20', contract:'6 months' },
                rfa:{ rfaNo:'RFR-1060', status:'active',
                      rfaStart:'2026-06-20', rfaEnd:'2027-02-20',
                      proposed:[], confirmedSeafarer:null }
            },
            {
                rank:'Chief Engineer',
                onboard:{ name:'SPIROS ALEXIOU',  shortName:'S. Alexiou',   embark:'2026-01-05', signoff:'2026-07-05', contract:'6 months' },
                rfa:{ rfaNo:'RFR-1044', status:'approval',
                      rfaStart:'2026-05-05', rfaEnd:'2027-01-05',
                      proposed:[
                          { name:'MARCO ESPOSITO', nationality:'Italian', service:63 },
                      ], confirmedSeafarer:null }
            },
        ]
    },

    // ─── Pacific Logistics ────────────────────────────────────
    {
        id:'v6', client:'Pacific Logistics',
        name:'Pacific Trader', type:'RoRo', flag:'Singapore',
        imo:'9603310', built:2016, gt:15800,
        engineType:'Wartsila 9L34DF', enginePower:'7 560 kW',
        classificationSociety:'ClassNK', piClub:'Japan P&I Club',
        hullInsurer:'Tokio Marine', hullValue:'USD 28,000,000',
        vesselRanks: null,
        ranks:[
            {
                rank:'Captain',
                onboard:{ name:'TANAKA HIROSHI',  shortName:'T. Hiroshi',   embark:'2026-04-01', signoff:'2026-10-01', contract:'6 months' },
                rfa: null
            },
            {
                rank:'Chief Officer',
                onboard:{ name:'PARK JOON-HO',    shortName:'P. Joon-Ho',   embark:'2026-03-15', signoff:'2026-09-15', contract:'6 months' },
                rfa:{ rfaNo:'RFR-1069', status:'active',
                      rfaStart:'2026-07-15', rfaEnd:'2027-03-15',
                      proposed:[], confirmedSeafarer:null }
            },
            {
                rank:'Chief Engineer',
                onboard:{ name:'LEE SUNG-MIN',    shortName:'L. Sung-Min',  embark:'2026-02-28', signoff:'2026-08-28', contract:'6 months' },
                rfa:{ rfaNo:'RFR-1057', status:'active',
                      rfaStart:'2026-06-28', rfaEnd:'2027-02-28',
                      proposed:[], confirmedSeafarer:null }
            },
            {
                rank:'Second Officer',
                onboard:{ name:'NGUYEN VAN AN',   shortName:'N. Van An',    embark:'2026-04-15', signoff:'2026-10-15', contract:'6 months' },
                rfa: null
            },
        ]
    },
];
