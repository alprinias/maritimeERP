/* ── data/preparation.js ──────────────────────────────────────
   Preparation checklist of a request "On Preparation" — what has to be
   fulfilled before the seafarer is cleared (Atlantis "Preparation Checklist").
   Depends on: utils.js, crew.js, documents.js
   Exposes globals:
     PREP_KINDS, PREP_DOC_RULES, prepSeafarerId(), prepNeedUntil(),
     prepDocRequirements(), prepManualTasks(), prepProgress(), prepIsComplete()

   A checklist has two parts:
   - Document requirements — documents the seafarer must hold, valid until the
     end of the planned service (derived from seafarerDocuments(); a row may
     carry prepRenewed = true when expired documents were renewed during the
     preparation).
   - Manual tasks — the request row's own task list (shared with the internal
     RFAs view, so progress ticked there shows up for the client). Costs are
     internal and never part of the client checklist.

   kind: 'rfe' embarkation (replacement or standalone RFE row) · 'rfs' sign-off ·
         'rfx' extension · 'rfp' promotion — rows from erpStore.rfaRows.
──────────────────────────────────────────────────────────────── */

var PREP_KINDS = {
    rfe: { label: 'Embarkation', dateLabel: 'Join Date' },
    rfs: { label: 'Sign-off',    dateLabel: 'Sign-off Date' },
    rfx: { label: 'Extension',   dateLabel: 'Extended to' },
    rfp: { label: 'Promotion',   dateLabel: 'Promotion Date' },
};

// [category, document name | '@coc' (own CoC / COP) | '@newcoc' (CoC / COP of the new rank)]
var PREP_DOC_RULES = {
    rfe: [['Travel Doc', 'Passport'], ['Travel Doc', "Seaman's Book"], ['Travel Doc', 'USA Visa'],
          ['STCW', '@coc'], ['STCW', 'Basic Training COP'], ['STCW', 'Prof. in Surv. Craft & Rescue Boat COP'],
          ['Medical', 'Medical Certificate (PEME)'], ['Medical', 'Drug & Alcohol Test']],
    rfx: [['Travel Doc', 'Passport'], ['Travel Doc', "Seaman's Book"],
          ['STCW', '@coc'], ['Medical', 'Medical Certificate (PEME)']],
    rfp: [['STCW', '@newcoc'], ['Medical', 'Medical Certificate (PEME)']],
    rfs: [],
};

// Seafarer the request is about (approved candidate for embarkations)
function prepSeafarerId(row, kind) {
    var name = kind === 'rfe' ? row.confirmedSeafarer : row.seafarer;
    return seafarerIdByName(name);
}

// Documents must stay valid until this date (end of the planned service)
function prepNeedUntil(row, kind) {
    if (kind === 'rfx') return row.deadline;                                   // extended sign-off
    if (kind === 'rfs') return row.deadline;
    return isoDate(addM(d(row.deadline), row.contractMonths || 6));           // join / promotion + contract
}

function prepDocRequirements(row, kind) {
    var id = prepSeafarerId(row, kind);
    var s = seafarerById(id);
    if (!s) return [];
    var until = prepNeedUntil(row, kind);
    var docs = seafarerDocuments(id);
    return (PREP_DOC_RULES[kind] || []).map(function (rule) {
        var name = rule[1];
        if (name === '@coc')    name = cocNameForRank(s.rank);        // null for ranks without one (cadets)
        if (name === '@newcoc') name = cocNameForRank(row.newRank);
        if (!name) return null;
        var doc = docs.find(x => x.name === name) || null;
        var valid = !!doc && (!doc.expiryDate || doc.expiryDate >= until);
        var renewed = !valid && !!row.prepRenewed;
        // state: 'valid' | 'noexpiry' | 'renewed' (fulfilled) · 'missing' | 'expires' (open)
        return {
            category: rule[0], name, doc, until, fulfilled: valid || renewed,
            state: renewed ? 'renewed' : !doc ? 'missing' : !doc.expiryDate ? 'noexpiry' : valid ? 'valid' : 'expires',
        };
    }).filter(Boolean);
}

// The row's own task list (embarkation of a replacement keeps it in rfeTasks)
function prepManualTasks(row, kind) {
    return (kind === 'rfe' && row.rfeTasks) ? row.rfeTasks : (row.tasks || []);
}

function prepProgress(row, kind) {
    var docs  = prepDocRequirements(row, kind);
    var tasks = prepManualTasks(row, kind);
    var done  = docs.filter(x => x.fulfilled).length + tasks.filter(t => t.done).length;
    var total = docs.length + tasks.length;
    return { done, total, docsOpen: docs.filter(x => !x.fulfilled).length,
             tasksOpen: tasks.filter(t => !t.done).length, complete: total > 0 && done === total };
}

// Cleared: every document requirement fulfilled and every task done
function prepIsComplete(row, kind) {
    return prepProgress(row, kind).complete;
}
