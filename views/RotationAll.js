/* ── views/RotationAll.js ─────────────────────────────────────
   Fleet Rotation — All Vessels view component (pure JS, no HTML).
   The template lives in index.html as:
     <script type="text/x-template" id="tpl-rotation-all">

   Depends on globals from data/ files:
     utils.js     → TODAY, d, addM, daysB, isoDate, fmtShort, shortName
     vessels.js   → allVessels
     seafarers.js → allSeafarers, seedRfeRows
     store.js     → erpStore (rfeRows)
   Exposes global: RotationAllView
──────────────────────────────────────────────────────────────── */
const RotationAllView = {
    template: '#tpl-rotation-all',

    data() {
        return {
            viewMonths:    12,
            dayWidth:      3.0,
            rankColWidth:  240,
            ganttStartStr: isoDate(addM(TODAY, -3)),
            includeRatings: false,
            filterClient:  '',
            filterVessel:  '',
            filterRank:    '',
            filterRfType:  '',
            ctxMenu:  { visible: false, x: 0, y: 0, vessel: null, row: null },
            modal:    { visible: false, action: '', vessel: null, row: null },
            extendForm:  { newSignoff: '' },
            replaceForm: { replacementDate: '', port: '' },
            promoteForm: { newRank: '', promotionDate: '' },
            embarkForm:  { rank: '', embarkDate: '', port: '', contractMonths: 6, contractVariation: 1 },
            signoffForm: { signoffDate: '', port: '' },
            rfaModal: {
                visible: false, kind: null, data: null, row: null, vessel: null,
                editStatus: '', confirmDelete: false,
                rfcIssued: false, selectedCandidates: [],
                availFilter: '', showCompare: false, showProposal: false,
            },
            todayStr: isoDate(TODAY),
            // Shared copy of seedRfeRows — survives navigation (data/store.js)
            rfeRows: erpStore.rfeRows,
            allSeafarers,
        };
    },

    computed: {
        ganttStart()       { return d(this.ganttStartStr); },
        ganttEnd()         { return addM(this.ganttStart, this.viewMonths); },
        ganttTotalDays()   { return daysB(this.ganttStart, this.ganttEnd); },
        todayOffset()      { return Math.max(0, daysB(this.ganttStart, TODAY)); },
        rfaHorizonOffset() { return Math.max(0, daysB(this.ganttStart, addM(TODAY, 2))); },

        ganttMonths() {
            const months = [];
            let cursor = new Date(this.ganttStart);
            let offsetDays = 0;
            while (cursor < this.ganttEnd) {
                const yr = cursor.getFullYear(), mo = cursor.getMonth();
                const next = new Date(yr, mo + 1, 1);
                const end  = new Date(Math.min(next, this.ganttEnd));
                const days = Math.round((end - cursor) / 86400000);
                months.push({
                    key: cursor.toISOString(),
                    label: cursor.toLocaleString('en', { month:'short', year:'2-digit' }),
                    days, offsetDays,
                });
                offsetDays += days;
                cursor = next;
            }
            return months;
        },

        allClients()    { return [...new Set(allVessels.map(v => v.client))].sort(); },
        clientVessels() { return allVessels.filter(v => v.client === this.filterClient); },
        allRanks() {
            const ranks = new Set();
            allVessels.forEach(v => v.ranks.forEach(r => {
                if (this.includeRatings || !r.isRating) ranks.add(r.rank);
            }));
            return [...ranks].sort();
        },

        rankHierarchy() {
            return ['Ordinary Seaman','Able Seaman','Bosun','Third Officer','Third Engineer',
                    'Second Officer','Second Engineer','Chief Officer','Chief Engineer','Master'];
        },
        higherRanks() {
            const currentRank = this.modal.row && this.modal.row.rank;
            if (!currentRank) return this.rankHierarchy;
            const idx = this.rankHierarchy.indexOf(currentRank);
            return idx >= 0 ? this.rankHierarchy.slice(idx + 1) : this.rankHierarchy;
        },

        rfaModalTypeName() {
            return { rfs:'RFS — Sign Off', rfr:'RFR — Replace', rfe:'RFE — Embark', rfp:'RFP — Promote', rfx:'RFX — Extend' }[this.rfaModal.kind] || 'RFA';
        },
        rfaModalHeaderClass() {
            return { rfs:'bg-rose-700', rfr:'bg-amber-600', rfe:'bg-sky-700', rfp:'bg-purple-700', rfx:'bg-teal-700' }[this.rfaModal.kind] || 'bg-slate-700';
        },
        rfaStatusBadgeClass() {
            return { active:'bg-orange-400/30 text-orange-100', approval:'bg-purple-400/30 text-purple-100', preparation:'bg-yellow-400/30 text-yellow-100', completed:'bg-green-400/30 text-green-100' }[this.rfaModal.editStatus] || 'bg-white/20';
        },
        rfaStatusOptions() {
            return [
                { value:'active',      label:'Active',      icon:'●', activeClass:'bg-orange-100 border-orange-400 text-orange-700' },
                { value:'approval',    label:'Approval',    icon:'◈', activeClass:'bg-purple-100 border-purple-400 text-purple-700' },
                { value:'preparation', label:'Preparation', icon:'◆', activeClass:'bg-yellow-100 border-yellow-400 text-yellow-700' },
                { value:'completed',   label:'Completed',   icon:'✓', activeClass:'bg-green-100 border-green-400 text-green-700' },
            ];
        },
        rfaModalAvailDefault() {
            if (!this.rfaModal.data || !this.rfaModal.data.embarkDate) return isoDate(TODAY);
            return isoDate(addM(d(this.rfaModal.data.embarkDate), -1));
        },
        candidateCategories() {
            return [
                { label: 'Client Ex-Crew', color: '#10b981' },
                { label: 'Other Ex-Crew',  color: '#3b82f6' },
                { label: 'New Candidates', color: '#f97316' },
            ];
        },

        allFlatRows() {
            const ft = this.filterRfType;
            return allVessels
                .filter(v => !this.filterClient  || v.client === this.filterClient)
                .filter(v => !this.filterVessel  || v.id     === this.filterVessel)
                .map(v => ({
                    vesselId: v.id,
                    client:   v.client,
                    name:     v.name,
                    type:     v.type,
                    flag:     v.flag,
                    ranks: v.ranks.filter(r =>
                        (this.includeRatings || !r.isRating) &&
                        (!this.filterRank || r.rank === this.filterRank) &&
                        (!ft || this.rowHasRfType(r, ft))
                    ),
                    rfeRows: this.rfeRows.filter(r =>
                        r.vesselId === v.id && (!ft || ft === 'rfe' || ft === 'any')
                    ),
                }))
                .filter(v => v.ranks.length > 0 || v.rfeRows.length > 0);
        },
    },

    mounted() {
        this._docClick = () => { this.ctxMenu.visible = false; };
        document.addEventListener('click', this._docClick);
    },
    unmounted() {
        document.removeEventListener('click', this._docClick);
    },

    methods: {
        getRfeCandidates(category) {
            const rank      = (this.rfaModal.row && this.rfaModal.row.rank) || (this.rfaModal.data && this.rfaModal.data.rank);
            const embark    = this.rfaModal.data && this.rfaModal.data.embarkDate;
            const availFrom = this.rfaModal.availFilter;
            return this.allSeafarers.filter(s => {
                if (s.rank !== rank) return false;
                if (s.category !== category) return false;
                if (embark   && s.availDate > embark)    return false;
                if (availFrom && s.availDate < availFrom) return false;
                return true;
            });
        },

        clampDays(dateStr) {
            const days = daysB(this.ganttStart, d(dateStr));
            return Math.max(0, Math.min(days, this.ganttTotalDays));
        },
        barStyle(fromStr, toStr) {
            const left  = this.clampDays(fromStr) * this.dayWidth;
            const right = this.clampDays(toStr)   * this.dayWidth;
            return { left: left + 'px', width: Math.max(right - left, 4) + 'px' };
        },
        rfaBarStyle(rfa) {
            return this.barStyle(rfa.rfaStart || isoDate(TODAY), rfa.rfaEnd);
        },

        openContextMenu(e, vessel, row) {
            e.stopPropagation();
            this.ctxMenu = { visible: true, x: e.clientX, y: e.clientY, vessel, row };
        },

        openModal(action, vessel, row) {
            this.modal = { visible: true, action, vessel, row };
            if (action === 'Embark') {
                this.embarkForm = { rank: '', embarkDate: '', port: '', contractMonths: 6, contractVariation: 1 };
            }
            if (action === 'Extend' && row) {
                this.extendForm.newSignoff = row.onboard.signoff;
            }
            if (action === 'Sign Off' && row) {
                this.signoffForm = { signoffDate: row.onboard.signoff, port: '' };
            }
            if (action === 'Replace' && row) {
                this.replaceForm = { replacementDate: row.onboard.signoff, port: '' };
            }
            if (action === 'Promote') {
                this.promoteForm = { newRank: '', promotionDate: '' };
            }
            this.$nextTick(() => { this.ctxMenu.visible = false; });
        },

        submitModal() {
            const row = this.modal.row;
            if (this.modal.action === 'Embark' && this.modal.vessel) {
                const f = this.embarkForm;
                const rfaNo = 'RFE-' + (1000 + Math.floor(Math.random() * 9000));
                this.rfeRows.push({
                    vesselId:          this.modal.vessel.vesselId || this.modal.vessel.id,
                    rfaNo,
                    rank:              f.rank,
                    dateCreated:       isoDate(TODAY),
                    embarkDate:        f.embarkDate,
                    port:              f.port,
                    contractMonths:    f.contractMonths,
                    contractVariation: f.contractVariation,
                    serviceEnd:        isoDate(addM(d(f.embarkDate), f.contractMonths)),
                    status:            'active',
                });
            }
            if (this.modal.action === 'Sign Off' && row) {
                const rfaNo = 'RFS-' + (1000 + Math.floor(Math.random() * 9000));
                row.rfs = { rfaNo, dateCreated: isoDate(TODAY), signoffDate: this.signoffForm.signoffDate, port: this.signoffForm.port, status: 'active' };
            }
            if (this.modal.action === 'Extend' && row) {
                const rfaNo = 'RFX-' + (2000 + Math.floor(Math.random() * 900));
                row.rfa = { rfaNo, type: 'Extend', status: 'active', rfaStart: isoDate(TODAY), rfaEnd: this.extendForm.newSignoff, proposed: [], confirmedSeafarer: null };
            }
            if (this.modal.action === 'Replace' && row) {
                const rfsNo = 'RFS-' + (1000 + Math.floor(Math.random() * 9000));
                const rfeNo = 'RFE-' + (1000 + Math.floor(Math.random() * 9000));
                row.rfs     = { rfaNo: rfsNo, dateCreated: isoDate(TODAY), signoffDate: this.replaceForm.replacementDate, port: this.replaceForm.port, status: 'active' };
                row.rfr_rfe = { rfaNo: rfeNo, dateCreated: isoDate(TODAY), embarkDate:  this.replaceForm.replacementDate, port: this.replaceForm.port, status: 'active' };
                this.rfeRows.push({
                    vesselId: this.modal.vessel.id, rfaNo: rfeNo, rank: row.rank,
                    dateCreated: isoDate(TODAY), embarkDate: this.replaceForm.replacementDate, port: this.replaceForm.port,
                    contractMonths: 6, contractVariation: 1,
                    serviceEnd: isoDate(addM(d(this.replaceForm.replacementDate), 6)), status: 'active',
                });
            }
            if (this.modal.action === 'Promote' && row) {
                const rfaNo = 'RFP-' + (1000 + Math.floor(Math.random() * 9000));
                row.rfa = { rfaNo, type: 'Promote', status: 'active', rfaStart: isoDate(TODAY), rfaEnd: this.promoteForm.promotionDate, newRank: this.promoteForm.newRank, proposed: [], confirmedSeafarer: null };
            }
            this.modal.visible = false;
        },

        rfaVisible(rfa) { return TODAY >= d(rfa.rfaStart); },

        rfaStatusIcon(status) {
            return { active:'●', approval:'◈', preparation:'◆', completed:'✓' }[status] || '';
        },

        openRfaModal(rfaData, kind, row, vessel) {
            this.rfaModal = {
                visible: true, kind, data: rfaData, row, vessel,
                editStatus: rfaData.status, confirmDelete: false,
                rfcIssued: false, selectedCandidates: [],
                availFilter: isoDate(TODAY),
                showCompare: false, showProposal: false,
            };
        },
        saveRfa() {
            if (this.rfaModal.data) this.rfaModal.data.status = this.rfaModal.editStatus;
            this.rfaModal.visible = false;
        },
        deleteRfa() {
            const { kind, row, data } = this.rfaModal;
            if (kind === 'rfx' || kind === 'rfp') row.rfa = null;
            if (kind === 'rfs') { row.rfs = null; }
            if (kind === 'rfr') { row.rfs = null; row.rfr_rfe = null; }
            if (kind === 'rfe') {
                const idx = this.rfeRows.findIndex(r => r.rfaNo === data.rfaNo);
                if (idx !== -1) this.rfeRows.splice(idx, 1);
            }
            this.rfaModal.visible = false;
        },

        resetGanttStart() { this.ganttStartStr = isoDate(addM(TODAY, -3)); },

        rowHasRfType(row, ft) {
            const rfaActive = row.rfa && row.rfa.type && row.rfa.rfaStart && (TODAY >= d(row.rfa.rfaStart));
            if (ft === 'any') return !!(row.rfs || row.rfr_rfe || rfaActive);
            if (ft === 'rfs') return !!row.rfs && !row.rfr_rfe;
            if (ft === 'rfr') return !!row.rfr_rfe;
            if (ft === 'rfx') return !!(rfaActive && row.rfa.type === 'Extend');
            if (ft === 'rfp') return !!(rfaActive && row.rfa.type === 'Promote');
            return false;
        },

        rfTypeActiveClass(type) {
            return {
                '':    'bg-slate-700 text-white',
                any:   'bg-slate-500 text-white',
                rfs:   'bg-rose-500 text-white',
                rfr:   'bg-amber-500 text-white',
                rfe:   'bg-sky-500 text-white',
                rfp:   'bg-purple-500 text-white',
                rfx:   'bg-teal-500 text-white',
            }[type] || 'bg-slate-700 text-white';
        },

        // Pass-through helpers so template can call them directly
        fmtShort, shortName, isoDate, addM, d,
    },
};
