/* ── views/RFAs.js ────────────────────────────────────────────
   Operations → RFAs view for Maritime ERP.

   Registers a local Vue component: rfa-card
   The rfa-card template lives in index.html as:
     <script type="text/x-template" id="tpl-rfa-card">
   The view template lives in index.html as:
     <script type="text/x-template" id="tpl-rfas">

   Architecture:
   - RfaCardComponent  — shared summary card (client, vessel, rank, deadline,
                         seafarer). Used as a list item in the left pane.
                         All RFA types share it; seafarer shown only when present.
   - RFAsView          — parent view. Registers rfa-card locally. Owns filter
                         state, data aggregation, task state, and selection state.

   Depends on globals: allVessels (vessels.js), isoDate, addM, TODAY (utils.js),
                       erpStore (store.js)
   Exposes globals: RFAsView, ensureRfaRows(), rfaCandidates(), pendingCandidates(),
                    principalApprove(), principalRejectAll()

   Candidates "On Approval" are decided by the principal in the Client UI;
   this view shows their state read-only (Awaiting / Approved / Rejected by principal).
──────────────────────────────────────────────────────────────── */

// ── Default task lists per RFA type ──────────────────────────
// Each new RFA of that type gets a fresh copy of these tasks. group = the
// Atlantis "Manual Tasks" group shown in the client preparation checklist
// (cost stays internal — never shown to the client).
const DEFAULT_TASKS = {
    rfs: [
        { name: 'Notify seafarer of sign-off date',    cost: 0,   group: 'GENERAL' },
        { name: 'Arrange travel & flights',            cost: 450, group: 'TRAVEL' },
        { name: 'Book port agent for disembarkation',  cost: 200, group: 'TRAVEL' },
        { name: 'Collect original documents onboard',  cost: 0,   group: 'DOCUMENTS' },
        { name: 'Process final wage account',          cost: 0,   group: 'GENERAL' },
        { name: 'Medical clearance certificate',       cost: 85,  group: 'DOCUMENTS' },
        { name: 'Update crew list with flag state',    cost: 0,   group: 'DOCUMENTS' },
    ],
    rfx: [
        { name: 'Obtain seafarer consent for extension', cost: 0,   group: 'GENERAL' },
        { name: 'Verify certificate validity covers extension', cost: 0, group: 'DOCUMENTS' },
        { name: 'Medical fitness confirmation',          cost: 85,  group: 'GENERAL' },
        { name: 'Amend employment agreement',            cost: 0,   group: 'DOCUMENTS' },
        { name: 'Notify flag state / MLC compliance',   cost: 120, group: 'DOCUMENTS' },
        { name: 'Update rotation plan',                  cost: 0,   group: 'GENERAL' },
    ],
    rfp: [
        { name: 'Verify promotion eligibility & sea service', cost: 0,   group: 'GENERAL' },
        { name: 'Confirm certificate of competency (CoC)',    cost: 0,   group: 'DOCUMENTS' },
        { name: 'Issue new employment contract at new rank',  cost: 0,   group: 'DOCUMENTS' },
        { name: 'Notify flag state of rank change',          cost: 150, group: 'DOCUMENTS' },
        { name: 'Update crew list & vessel documentation',    cost: 0,   group: 'DOCUMENTS' },
        { name: 'Salary adjustment effective date',          cost: 0,   group: 'GENERAL' },
    ],
    rfe: [
        { name: 'Confirm seafarer acceptance',               cost: 0,   group: 'GENERAL' },
        { name: 'Verify all certificates are valid',         cost: 0,   group: 'DOCUMENTS' },
        { name: 'Has passed medical examination (PEME)',     cost: 120, group: 'GENERAL' },
        { name: 'Arrange travel & flights to join port',     cost: 450, group: 'TRAVEL' },
        { name: 'Book port agent for embarkation',           cost: 200, group: 'TRAVEL' },
        { name: 'Issue joining instructions & vessel info',  cost: 0,   group: 'GENERAL' },
        { name: 'Has signed employment contract',            cost: 0,   group: 'DOCUMENTS' },
        { name: 'Update crew list with flag state',          cost: 0,   group: 'DOCUMENTS' },
        { name: 'Received working gear',                     cost: 150, group: 'GENERAL' },
        { name: 'Pre-departure briefing completed',          cost: 0,   group: 'GENERAL' },
    ],
};

// done: task ids already completed (seed data), or true for all
function makeTasks(type, done) {
    return (DEFAULT_TASKS[type] || []).map((t, i) => ({
        id: i + 1,
        name: t.name,
        cost: t.cost,
        group: t.group,
        done: done === true || (Array.isArray(done) && done.includes(i + 1)),
    }));
}

// ── Shared RFA Card component ─────────────────────────────────
const RfaCardComponent = {
    template: '#tpl-rfa-card',
    props: {
        rfa:      { type: Object, required: true },
        selected: { type: Boolean, default: false },
    },
    emits: ['select'],
    computed: {
        typeBadgeClass() {
            const n = this.rfa.rfaNo || '';
            if (n.startsWith('RFS')) return 'bg-rose-100 text-rose-800';
            if (n.startsWith('RFX')) return 'bg-teal-100 text-teal-800';
            if (n.startsWith('RFP')) return 'bg-purple-100 text-purple-800';
            return 'bg-gray-100 text-gray-600';
        },
        statusClass() {
            return {
                active:      'bg-orange-50  text-orange-700  border-orange-200',
                approval:    'bg-purple-50  text-purple-700  border-purple-200',
                preparation: 'bg-yellow-50  text-yellow-700  border-yellow-200',
                completed:   'bg-green-50   text-green-700   border-green-200',
            }[this.rfa.status] || 'bg-gray-50 text-gray-500 border-gray-200';
        },
        isOverdue() {
            return !!this.rfa.deadline && this.rfa.deadline < isoDate(TODAY);
        },
        isDueSoon() {
            if (!this.rfa.deadline || this.isOverdue) return false;
            return this.rfa.deadline <= isoDate(addM(TODAY, 1));
        },
        deadlineClass() {
            if (this.isOverdue)  return 'text-red-600';
            if (this.isDueSoon)  return 'text-amber-600';
            return 'text-gray-700';
        },
    },
};

// ── RFAs view ─────────────────────────────────────────────────
const RFAsView = {
    template: '#tpl-rfas',

    components: { 'rfa-card': RfaCardComponent },

    data() {
        return {
            activeTab:      'signoff',
            filterClient:   '',
            filterVessel:   '',
            filterRank:     '',
            filterDeadline: '',
            selectedRfa:    null,
            rfeStatusFilter: '',       // '' | 'OnSearch' | 'OnPreparation'
            todayStr:       isoDate(TODAY),
            compareOpen:    false,

            // All aggregated rows, built once and mutated (tasks toggled in place)
            allRows: { signoff: [], extension: [], promotion: [] },
        };
    },

    created() {
        this.allRows = ensureRfaRows();
    },

    computed: {
        tabs() {
            return [
                { id: 'replacement', label: 'Replacement', icon: '🔄',
                  activeClass: 'border-amber-500 text-amber-700',
                  countClass:  'bg-amber-100 text-amber-700',
                  headerClass: 'bg-amber-700 text-white' },
                { id: 'embarkation', label: 'Embarkation', icon: '⚓',
                  activeClass: 'border-sky-500 text-sky-700',
                  countClass:  'bg-sky-100 text-sky-700',
                  headerClass: 'bg-sky-700 text-white' },
                { id: 'signoff',     label: 'Sign-Off',    icon: '🚪',
                  activeClass: 'border-rose-500 text-rose-700',
                  countClass:  'bg-rose-100 text-rose-700',
                  headerClass: 'bg-rose-700 text-white' },
                { id: 'extension',   label: 'Extension',   icon: '⏩',
                  activeClass: 'border-teal-500 text-teal-700',
                  countClass:  'bg-teal-100 text-teal-700',
                  headerClass: 'bg-teal-700 text-white' },
                { id: 'promotion',   label: 'Promotion',   icon: '⬆️',
                  activeClass: 'border-purple-500 text-purple-700',
                  countClass:  'bg-purple-100 text-purple-700',
                  headerClass: 'bg-purple-700 text-white' },
            ];
        },

        allClientNames() {
            return [...new Set(allVessels.map(v => v.client))].sort();
        },
        filteredVesselOptions() {
            return allVessels.filter(v => !this.filterClient || v.client === this.filterClient);
        },
        rankOptions() {
            return ['Master','Chief Officer','Second Officer','Third Officer',
                    'Chief Engineer','Second Engineer','Third Engineer',
                    'Bosun','Able Seaman','Oiler','Ordinary Seaman'];
        },

        // Checked candidates for the RFR's RFE side
        rfrCheckedCandidates() {
            if (!this.selectedRfa || !this.selectedRfa.rfeCandidates) return [];
            return this.selectedRfa.rfeCandidates.filter(c => c.checked);
        },
        rfrAcceptedCandidates() {
            if (!this.selectedRfa || !this.selectedRfa.rfeCandidates) return [];
            return this.selectedRfa.rfeCandidates.filter(c => c.checked && c.acceptance === 'accepted');
        },
        rfrCandidateGroups() {
            const all = this.selectedRfa && this.selectedRfa.rfeCandidates || [];
            const byGroup = id => all.filter(c => c.groupId === id);
            return [
                { id:'dedicated', label:'Dedicated', dotClass:'bg-emerald-500', countClass:'bg-emerald-100 text-emerald-700', candidates: byGroup('dedicated') },
                { id:'excrew',    label:'Ex-Crew',   dotClass:'bg-blue-500',    countClass:'bg-blue-100 text-blue-700',       candidates: byGroup('excrew') },
                { id:'new',       label:'New',        dotClass:'bg-amber-500',   countClass:'bg-amber-100 text-amber-700',     candidates: byGroup('new') },
            ];
        },
        completedTaskCount() {
            if (!this.selectedRfa) return 0;
            return this.selectedRfa.tasks.filter(t => t.done).length;
        },
        totalCost() {
            if (!this.selectedRfa) return '—';
            const sum = this.selectedRfa.tasks.reduce((s, t) => s + (t.cost || 0), 0);
            return '€ ' + sum.toLocaleString('en', { minimumFractionDigits: 2 });
        },
        progressPct() {
            if (!this.selectedRfa || !this.selectedRfa.tasks.length) return 0;
            return Math.round((this.completedTaskCount / this.selectedRfa.tasks.length) * 100);
        },
        progressColor() {
            if (this.progressPct === 100) return 'text-green-600';
            if (this.progressPct >= 50)  return 'text-blue-600';
            return 'text-gray-500';
        },
        progressBarClass() {
            if (this.progressPct === 100) return 'bg-green-500';
            if (this.progressPct >= 50)  return 'bg-blue-500';
            return 'bg-amber-400';
        },

        // Embarkation tab: apply both the global filters AND the rfeStatusFilter
        filteredRfeRows() {
            return (this.allRows.embarkation || []).filter(r => {
                if (this.filterClient  && r.client   !== this.filterClient)  return false;
                if (this.filterVessel  && r.vesselId !== this.filterVessel)  return false;
                if (this.filterRank    && r.rank     !== this.filterRank)    return false;
                if (this.filterDeadline && r.deadline && r.deadline > this.filterDeadline) return false;
                if (this.rfeStatusFilter && r.rfeStatus !== this.rfeStatusFilter) return false;
                return true;
            });
        },

        // Candidates for the currently selected RFE — stored directly on the rfa object
        activeCandidates() {
            if (!this.selectedRfa) return [];
            return this.selectedRfa.candidates || [];
        },

        // Three groups: Dedicated / Ex-Crew / New
        candidateGroups() {
            const all = this.activeCandidates;
            const byGroup = id => all.filter(c => c.groupId === id);
            return [
                { id: 'dedicated', label: 'Dedicated',
                  dotClass: 'bg-emerald-500', countClass: 'bg-emerald-100 text-emerald-700',
                  candidates: byGroup('dedicated') },
                { id: 'excrew',    label: 'Ex-Crew',
                  dotClass: 'bg-blue-500',    countClass: 'bg-blue-100 text-blue-700',
                  candidates: byGroup('excrew') },
                { id: 'new',       label: 'New',
                  dotClass: 'bg-amber-500',   countClass: 'bg-amber-100 text-amber-700',
                  candidates: byGroup('new') },
            ];
        },

        totalCandidatesForRfe() {
            return this.activeCandidates.length;
        },

        checkedCandidates() {
            return this.activeCandidates.filter(c => c.checked);
        },

        // Checked AND acceptance === 'accepted' (enables Send for Approval)
        acceptedCandidates() {
            return this.activeCandidates.filter(c => c.checked && c.acceptance === 'accepted');
        },
    },

    methods: {
        // ── Filter + select ────────────────────────────────────
        filteredRows(tabId) {
            const rows = this.allRows[tabId] || [];
            return rows.filter(r => {
                if (this.filterClient  && r.client   !== this.filterClient)   return false;
                if (this.filterVessel  && r.vesselId !== this.filterVessel)   return false;
                if (this.filterRank    && r.rank     !== this.filterRank)     return false;
                if (this.filterDeadline && r.deadline && r.deadline > this.filterDeadline) return false;
                return true;
            });
        },

        selectRfa(rfa) {
            this.selectedRfa = rfa;
            // Build candidate list directly on the rfa object — guaranteed reactive
            // since allRows entries are already tracked by Vue.
            if (rfa.rfeStatus === 'OnSearch' && !rfa.candidates) {
                rfa.candidates = this.buildCandidatesForRfe(rfa);
            }
        },

        // Mark checked+accepted candidates as 'onApproval' and clear their checkboxes.
        // source: undefined (Embarkation tab) | 'rfr' (Replacement RFE bottom section)
        sendForApproval(rfa, source) {
            const candidates = source === 'rfr'
                ? rfa.rfeCandidates
                : rfa.candidates;
            if (!candidates) return;
            candidates.forEach(c => {
                if (c.checked && c.acceptance === 'accepted') {
                    c.acceptance = 'onApproval';
                    c.checked = false;
                }
            });
        },

        // Approve / reject of candidates On Approval is done by the principal in
        // the Client UI (principalApprove / principalRejectAll below).

        // Build reactive candidate objects for an RFE from allSeafarers.
        // proposed: seafarer ids already sent to the principal (seed data).
        buildCandidatesForRfe(rfe, proposed) {
            const groupMap = {
                'Client Ex-Crew': 'dedicated',
                'Other Ex-Crew':  'excrew',
                'New Candidates': 'new',
            };
            return allSeafarers
                .filter(s => s.rank === rfe.rank)
                .map(s => ({
                    id:             s.id,
                    name:           s.name,
                    age:            s.age,
                    nationality:    s.nationality,
                    availDate:      s.availDate,
                    services:       s.services,
                    groupId:        groupMap[s.category] || 'new',
                    checked:        false,
                    // null|'pending'|'accepted'|'refused'|'onApproval'
                    acceptance:     (proposed || []).includes(s.id) ? 'onApproval' : null,
                    approvalChoice: null,   // null|'approved'|'rejected' — set by the principal
                }));
        },

        // Service stat helpers
        totalTrips(c) {
            return c.services.reduce((s, sv) => s + sv.count, 0);
        },
        totalMonths(c) {
            return c.services.reduce((s, sv) => s + sv.months, 0);
        },
        serviceAt(c, label) {
            return c.services.find(sv => sv.label === label) || { count: 0, months: 0 };
        },

        resetFilters() {
            this.filterClient    = '';
            this.filterVessel    = '';
            this.filterRank      = '';
            this.filterDeadline  = '';
            this.rfeStatusFilter = '';
        },

        // ── Data builders ──────────────────────────────────────
        // Per-section helpers for RFR (independent RFS and RFE task lists)
        rfrSectionCost(tasks) {
            const sum = (tasks || []).reduce((s, t) => s + (t.cost || 0), 0);
            return sum > 0 ? '€ ' + sum.toFixed(2) : '—';
        },
        rfrSectionPct(tasks) {
            if (!tasks || !tasks.length) return 0;
            return Math.round((tasks.filter(t => t.done).length / tasks.length) * 100);
        },

        buildReplacementRows() {
            const rows = [];
            allVessels.forEach(v => {
                v.ranks.forEach(r => {
                    if (!r.rfs || !r.rfr_rfe) return;
                    // 'approval' = still searching, with candidates sent to the principal
                    const rfeStatus = ['active', 'approval'].includes(r.rfr_rfe.status) ? 'OnSearch' : 'OnPreparation';
                    // Build candidate list for the RFE side if OnSearch
                    const rfeCandidates = rfeStatus === 'OnSearch'
                        ? this.buildCandidatesForRfe({ rank: r.rank }, r.rfr_rfe.proposed)
                        : [];
                    rows.push({
                        rfaNo:       'RFR-' + r.rfs.rfaNo.split('-')[1],  // use RFR prefix for display
                        rfsNo:       r.rfs.rfaNo,
                        rfeNo:       r.rfr_rfe.rfaNo,
                        client:      v.client,
                        vesselId:    v.id,
                        vesselName:  v.name,
                        vesselType:  v.type,
                        rank:        r.rank,
                        seafarer:    r.onboard && r.onboard.name,
                        signoffDate: r.rfs.signoffDate,
                        signoffPort: r.rfs.port,
                        deadline:    r.rfr_rfe.embarkDate,
                        embarkPort:  r.rfr_rfe.port,
                        status:      r.rfs.status,
                        rfeStatus,
                        rfsTasks:      makeTasks('rfs', r.rfs.prepDone),
                        rfeTasks:      rfeStatus === 'OnPreparation' ? makeTasks('rfe', r.rfr_rfe.prepDone) : [],
                        prepRenewed:   r.rfr_rfe.renewed || null,   // documents renewed during preparation
                        confirmedSeafarer: r.rfr_rfe.confirmedSeafarer || null,
                        rfeCandidates,
                        approvalHistory: [],   // principal decisions (Client UI)
                    });
                });
            });
            return rows;
        },

        buildSignoffRows() {
            const rows = [];
            allVessels.forEach(v => {
                v.ranks.forEach(r => {
                    if (!r.rfs) return;
                    rows.push({
                        rfaNo:      r.rfs.rfaNo,
                        client:     v.client,
                        vesselId:   v.id,
                        vesselName: v.name,
                        vesselType: v.type,
                        rank:       r.rank,
                        seafarer:   r.onboard && r.onboard.name,
                        deadline:   r.rfs.signoffDate,
                        port:       r.rfs.port,
                        status:     r.rfs.status,
                        tasks:      makeTasks('rfs', r.rfs.prepDone),
                    });
                });
            });
            return rows;
        },

        buildExtensionRows() {
            const rows = [];
            allVessels.forEach(v => {
                v.ranks.forEach(r => {
                    if (!r.rfa || r.rfa.type !== 'Extend') return;
                    rows.push({
                        rfaNo:          r.rfa.rfaNo,
                        client:         v.client,
                        vesselId:       v.id,
                        vesselName:     v.name,
                        vesselType:     v.type,
                        rank:           r.rank,
                        seafarer:       r.onboard && r.onboard.name,
                        currentSignoff: r.onboard && r.onboard.signoff,
                        deadline:       r.rfa.rfaEnd,
                        status:         r.rfa.status,
                        tasks:          makeTasks('rfx', r.rfa.prepDone),
                        prepRenewed:    r.rfa.renewed || null,
                    });
                });
            });
            return rows;
        },

        buildEmbarkationRows() {
            const rows = [];
            seedRfeRows.forEach(rfe => {
                const vessel = allVessels.find(v => v.id === rfe.vesselId) || {};
                // 'approval' = still searching, with candidates sent to the principal
                const rfeStatus = ['active', 'approval'].includes(rfe.status) ? 'OnSearch' : 'OnPreparation';
                rows.push({
                    rfaNo:      rfe.rfaNo,
                    client:     vessel.client    || '—',
                    vesselId:   rfe.vesselId,
                    vesselName: vessel.name      || '—',
                    vesselType: vessel.type      || '—',
                    rank:       rfe.rank,
                    seafarer:   null,
                    deadline:   rfe.embarkDate,
                    port:       rfe.port,
                    status:     rfe.status,
                    rfeStatus,
                    contractMonths:    rfe.contractMonths,
                    contractVariation: rfe.contractVariation,
                    confirmedSeafarer: rfe.confirmedSeafarer || null,
                    // populated lazily by selectRfa() — on the row so Vue tracks it — or
                    // up front when candidates were already sent to the principal
                    candidates: rfe.proposed ? this.buildCandidatesForRfe(rfe, rfe.proposed) : null,
                    tasks: rfeStatus === 'OnPreparation' ? makeTasks('rfe', rfe.prepDone) : [],
                    prepRenewed: rfe.renewed || null,
                    approvalHistory: [],   // principal decisions (Client UI)
                });
            });
            return rows;
        },

        buildPromotionRows() {
            const rows = [];
            allVessels.forEach(v => {
                v.ranks.forEach(r => {
                    if (!r.rfa || r.rfa.type !== 'Promote') return;
                    rows.push({
                        rfaNo:      r.rfa.rfaNo,
                        client:     v.client,
                        vesselId:   v.id,
                        vesselName: v.name,
                        vesselType: v.type,
                        rank:       r.rank,
                        newRank:    r.rfa.newRank || '—',
                        seafarer:   r.onboard && r.onboard.name,
                        deadline:   r.rfa.rfaEnd,
                        status:     r.rfa.status,
                        tasks:      makeTasks('rfp', r.rfa.prepDone),
                        prepRenewed: r.rfa.renewed || null,
                    });
                });
            });
            return rows;
        },
    },
};

// ── Shared RFA rows (RFAs view + Client UI) ───────────────────
/* Builds erpStore.rfaRows from allVessels / seedRfeRows, reusing row objects
   already in the store (by rfaNo) so task / candidate / approval state
   survives navigation and is shared with the Client UI. */
function ensureRfaRows() {
    const m = RFAsView.methods;
    const fresh = {
        signoff:     m.buildSignoffRows(),
        extension:   m.buildExtensionRows(),
        promotion:   m.buildPromotionRows(),
        embarkation: m.buildEmbarkationRows(),
        replacement: m.buildReplacementRows(),
    };
    const cached = erpStore.rfaRows || {};
    Object.keys(fresh).forEach(tab => {
        const byNo = {};
        (cached[tab] || []).forEach(r => { byNo[r.rfaNo] = r; });
        fresh[tab] = fresh[tab].map(r => byNo[r.rfaNo] || r);
    });
    erpStore.rfaRows = fresh;
    return erpStore.rfaRows;
}

// ── Principal decisions (made in the Client UI) ───────────────
// Candidates of an embarkation row (candidates) or a replacement row (rfeCandidates)
function rfaCandidates(row) {
    return row.rfeCandidates || row.candidates || [];
}

// Candidates sent to the principal and not decided yet
function pendingCandidates(row) {
    if (row.rfeStatus !== 'OnSearch') return [];
    return rfaCandidates(row).filter(c => c.acceptance === 'onApproval' && !c.approvalChoice);
}

// Approve one candidate: the others on approval stay undecided, the RFE moves
// to OnPreparation with the candidate as confirmed seafarer.
function principalApprove(row, candidateId) {
    const target = rfaCandidates(row).find(c => c.id === candidateId);
    if (!target) return;
    target.approvalChoice = 'approved';
    row.rfeStatus = 'OnPreparation';
    row.confirmedSeafarer = target.name;
    if (row.rfeCandidates) {
        if (!row.rfeTasks || !row.rfeTasks.length) row.rfeTasks = makeTasks('rfe');
    } else if (!row.tasks || !row.tasks.length) {
        row.tasks = makeTasks('rfe');
    }
    row.approvalHistory.push({ date: isoDate(new Date()), action: 'approved', candidates: [target.name] });
}

// Reject every candidate on approval (reason required); the RFE stays OnSearch
// so the agency continues the candidate search.
function principalRejectAll(row, reason) {
    const pending = pendingCandidates(row);
    pending.forEach(c => { c.approvalChoice = 'rejected'; });
    row.approvalHistory.push({ date: isoDate(new Date()), action: 'rejected', reason, candidates: pending.map(c => c.name) });
}
