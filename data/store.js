/* ── data/store.js ────────────────────────────────────────────
   Shared in-memory state for Maritime ERP.
   Depends on: Vue (CDN), utils.js, vessels.js, seafarers.js.
   Exposes global: window.erpStore

   Views read and mutate this object instead of keeping private
   copies, so state survives navigation between routes and is
   visible across modules (e.g. an RFE approved in Client UI shows
   up in Operations → RFAs). Nothing is persisted across reloads.
──────────────────────────────────────────────────────────────── */

// Re-anchor seed dates to today (see utils.js) before anything derives from them
shiftSeedDates([allVessels, allSeafarers, seedRfeRows], seedMonthShift());

var erpStore = Vue.reactive({

    // Client UI — the client the portal is "logged in" as; the seafarer whose
    // profile modal is open and the request whose approval / preparation dialog
    // is open (null = closed); toast = snackbar message
    clientUi: { clientId: 'c1', profileId: null, approvalRef: null, prepRef: null, toast: '' },

    // Rotation Plan — standalone RFE rows (seeded once)
    rfeRows: seedRfeRows.map(r => Object.assign({}, r)),

    // Client appraisals of completed tours (seeded by data/appraisals.js)
    appraisals: [],

    // RFAs view — aggregated rows per tab ({ signoff, extension, ... }).
    // null until the RFAs view is first opened; merged on each later visit.
    rfaRows: null,
});
