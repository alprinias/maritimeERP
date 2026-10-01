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
   Exposes global: RFAsView
──────────────────────────────────────────────────────────────── */

// ── Default task lists per RFA type ──────────────────────────
// Each new RFA of that type gets a fresh copy of these tasks.
const DEFAULT_TASKS = {
    rfs: [
        { name: 'Notify seafarer of sign-off date',    cost: 0 },
        { name: 'Arrange travel & flights',            cost: 450 },
        { name: 'Book port agent for disembarkation',  cost: 200 },
        { name: 'Collect original documents onboard',  cost: 0 },
        { name: 'Process final wage account',          cost: 0 },
        { name: 'Medical clearance certificate',       cost: 85 },
        { name: 'Update crew list with flag state',    cost: 0 },
    ],
    rfx: [
        { name: 'Obtain seafarer consent for extension', cost: 0 },
        { name: 'Verify certificate validity covers extension', cost: 0 },
        { name: 'Medical fitness confirmation',          cost: 85 },
        { name: 'Amend employment agreement',            cost: 0 },
        { name: 'Notify flag state / MLC compliance',   cost: 120 },
        { name: 'Update rotation plan',                  cost: 0 },
    ],
    rfp: [
        { name: 'Verify promotion eligibility & sea service', cost: 0 },
        { name: 'Confirm certificate of competency (CoC)',    cost: 0 },
        { name: 'Issue new employment contract at new rank',  cost: 0 },
        { name: 'Notify flag state of rank change',          cost: 150 },
        { name: 'Update crew list & vessel documentation',    cost: 0 },
        { name: 'Salary adjustment effective date',          cost: 0 },
    ],
    rfe: [
        { name: 'Confirm seafarer acceptance',               cost: 0 },
        { name: 'Verify all certificates are valid',         cost: 0 },
        { name: 'Medical fitness examination',               cost: 120 },
        { name: 'Arrange travel & flights to join port',     cost: 450 },
        { name: 'Book port agent for embarkation',           cost: 200 },
        { name: 'Issue joining instructions & vessel info',  cost: 0 },
        { name: 'Prepare & sign employment agreement',       cost: 0 },
        { name: 'Update crew list with flag state',          cost: 0 },
    ],
};

function makeTasks(type) {
    return (DEFAULT_TASKS[type] || []).map((t, i) => ({
        id: i + 1,
        name: t.name,
        cost: t.cost,
        done: false,
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
        // Rebuild from allVessels (picks up RFAs created in Rotation Plan),
        // but reuse row objects already in erpStore so task / candidate /
        // approval state survives navigating away and back.
        const fresh = {
            signoff:     this.buildSignoffRows(),
            extension:   this.buildExtensionRows(),
            promotion:   this.buildPromotionRows(),
            embarkation: this.buildEmbarkationRows(),
            replacement: this.buildReplacementRows(),
        };
        const cached = erpStore.rfaRows || {};
        Object.keys(fresh).forEach(tab => {
            const byNo = {};
            (cached[tab] || []).forEach(r => { byNo[r.rfaNo] = r; });
            fresh[tab] = fresh[tab].map(r => byNo[r.rfaNo] || r);
        });
        erpStore.rfaRows = fresh;
        this.allRows = erpStore.rfaRows;
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
            return ['Captain','Chief Officer','Second Officer','Third Officer',
                    'Chief Engineer','Second Engineer','Third Engineer',
                    'Bosun','AB Deck','Oiler','Ordinary Seaman'];
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

        // Set one candidate's approvalChoice to 'approved' — mutually exclusive.
        // Clears approvalChoice on all others that were 'approved'.
        // Triggers OnPreparation transition.
        setApproved(rfa, candidateId, source) {
            const candidates = source === 'rfr' ? rfa.rfeCandidates : rfa.candidates;
            if (!candidates) return;
            const target = candidates.find(c => c.id === candidateId);
            if (!target) return;
            // Toggle off — revert to no choice, go back to OnSearch
            if (target.approvalChoice === 'approved') {
                target.approvalChoice = null;
                rfa.rfeStatus = 'OnSearch';
                rfa.confirmedSeafarer = null;
                return;
            }
            // Clear any previously approved candidate
            candidates.forEach(c => {
                if (c.approvalChoice === 'approved') c.approvalChoice = null;
            });
            // Approve this one
            target.approvalChoice = 'approved';
            rfa.rfeStatus = 'OnPreparation';
            rfa.confirmedSeafarer = target.name;
            // Initialise task list
            if (source === 'rfr') {
                if (!rfa.rfeTasks || rfa.rfeTasks.length === 0) rfa.rfeTasks = makeTasks('rfe');
            } else {
                if (!rfa.tasks || rfa.tasks.length === 0) rfa.tasks = makeTasks('rfe');
            }
        },

        // Set one candidate's approvalChoice to 'rejected' — independent per candidate.
        setRejected(rfa, candidateId, source) {
            const candidates = source === 'rfr' ? rfa.rfeCandidates : rfa.candidates;
            if (!candidates) return;
            const target = candidates.find(c => c.id === candidateId);
            if (!target) return;
            // Toggle off if already rejected
            target.approvalChoice = target.approvalChoice === 'rejected' ? null : 'rejected';
            // If this candidate was previously approved, revert the RFE
            if (rfa.confirmedSeafarer === target.name && target.approvalChoice !== 'approved') {
                rfa.rfeStatus = 'OnSearch';
                rfa.confirmedSeafarer = null;
            }
        },

        // Build reactive candidate objects for an RFE from allSeafarers
        buildCandidatesForRfe(rfe) {
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
                    acceptance:     null,   // null|'pending'|'accepted'|'refused'|'onApproval'
                    approvalChoice: null,   // null|'approved'|'rejected' (set during onApproval phase)
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
            const groupMap = { 'Client Ex-Crew':'dedicated', 'Other Ex-Crew':'excrew', 'New Candidates':'new' };
            allVessels.forEach(v => {
                v.ranks.forEach(r => {
                    if (!r.rfs || !r.rfr_rfe) return;
                    const rfeStatus = (r.rfr_rfe.status === 'active') ? 'OnSearch' : 'OnPreparation';
                    // Build candidate list for the RFE side if OnSearch
                    const rfeCandidates = rfeStatus === 'OnSearch'
                        ? allSeafarers
                            .filter(s => s.rank === r.rank)
                            .map(s => ({
                                id: s.id, name: s.name, age: s.age,
                                nationality: s.nationality, availDate: s.availDate,
                                services: s.services,
                                groupId: groupMap[s.category] || 'new',
                                checked: false, acceptance: null, approvalChoice: null,
                            }))
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
                        rfsTasks:      makeTasks('rfs'),
                        rfeTasks:      rfeStatus === 'OnPreparation' ? makeTasks('rfe') : [],
                        rfeCandidates,
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
                        tasks:      makeTasks('rfs'),
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
                        tasks:          makeTasks('rfx'),
                    });
                });
            });
            return rows;
        },

        buildEmbarkationRows() {
            const rows = [];
            seedRfeRows.forEach(rfe => {
                const vessel = allVessels.find(v => v.id === rfe.vesselId) || {};
                const rfeStatus = (rfe.status === 'active') ? 'OnSearch' : 'OnPreparation';
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
                    confirmedSeafarer: null,
                    candidates: null,   // populated lazily by selectRfa() — on the row so Vue tracks it
                    tasks: rfeStatus === 'OnPreparation' ? makeTasks('rfe') : [],
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
                        tasks:      makeTasks('rfp'),
                    });
                });
            });
            return rows;
        },
    },
};
