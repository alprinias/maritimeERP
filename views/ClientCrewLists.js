/* ── views/ClientCrewLists.js ─────────────────────────────────
   Client UI → Crew Lists. Template in index.html: tpl-client-crew-lists

   Four lists for the client selected in the portal top bar:
   - onboard   — embarked on the client's vessels on a date (today or earlier)
   - ashore    — dedicated to the client and ashore today (last vessel / sign-off)
   - approved  — approved for a future embarkation (est. date and port) in a period
   - changes   — crew changes in a period, completed and planned in separate sections

   Every list has fixed columns (Full Name, Rank, Age) and optional columns
   chosen in the table's COLUMNS menu; Export PDF prints the visible columns.
   Clicking a Full Name opens the profile modal (erpStore.clientUi.profileId).

   Depends on globals: erpStore, allVessels, allClientsData, allSeafarers, utils.js,
     crew.js, documents.js, atlDate (ClientCommon.js)
   Exposes global: ClientCrewListsView
──────────────────────────────────────────────────────────────── */

// ── Column catalogue ──────────────────────────────────────────
const _expCls = stKey => r => ({ expired: 'atl-text-error', expiring: 'atl-text-warning' })[r[stKey]] || '';
const _dateCol = (key, title, def, stKey) =>
    ({ key, title, def: !!def, format: v => v ? atlDate(v) : '—', cls: stKey ? _expCls(stKey) : undefined });

const _fixedCols = () => [
    { key: 'fullName', title: 'Full Name', fixed: true, type: 'link' },
    { key: 'rank',     title: 'Rank',      fixed: true },
    { key: 'age',      title: 'Age',       fixed: true },
];
const _docCols = () => [
    { key: 'passportNo', title: 'Passport No.' },
    _dateCol('passportExp', 'Passport Expiry', false, 'passportExp_st'),
    { key: 'sbNo',       title: "Seaman's Book No." },
    _dateCol('sbExp', "Seaman's Book Expiry", false, 'sbExp_st'),
    { key: 'coc',        title: 'CoC / Certificate' },
    _dateCol('medicalExp', 'Medical Expiry', false, 'medicalExp_st'),
    { key: 'docStatus',  title: 'Documents', type: 'chip', chip: r => r.docChip, def: true },
];
const _col = (key, title, def) => ({ key, title, def: !!def });

const CREW_LIST_COLUMNS = {
    onboard: [
        ..._fixedCols(),
        _col('nationality', 'Nationality', true),
        _col('vessel', 'Vessel', true),
        _dateCol('signOnDate', 'Sign-on Date', true),
        _col('signOnPort', 'Sign-on Port'),
        _dateCol('signOffDate', 'Sign-off (est.)', true),
        _col('signOffPort', 'Sign-off Port'),
        _col('contract', 'Contract (months)'),
        _col('daysOnBoard', 'Days on Board', true),
        _dateCol('availability', 'Available From'),
        ..._docCols(),
    ],
    ashore: [
        ..._fixedCols(),
        _col('nationality', 'Nationality', true),
        _col('lastVessel', 'Last Vessel', true),
        _dateCol('lastSignOff', 'Last Sign-off', true),
        _col('lastSignOffPort', 'Sign-off Port'),
        _col('daysAshore', 'Days Ashore'),
        _dateCol('availability', 'Available From', true),
        ..._docCols(),
    ],
    approved: [
        ..._fixedCols(),
        _col('nationality', 'Nationality', true),
        _col('vessel', 'Vessel', true),
        _dateCol('estEmbark', 'Est. Embarkation', true),
        _col('embarkPort', 'Embarkation Port', true),
        _col('relieving', 'Relieving', true),
        _col('ref', 'Request'),
        _dateCol('availability', 'Available From'),
        ..._docCols(),
    ],
    changes: [
        _dateCol('date', 'Date', true),
        { key: 'change', title: 'Change', type: 'chip', chip: r => r.changeChip, def: true },
        ..._fixedCols(),
        _col('vessel', 'Vessel', true),
        _col('port', 'Port', true),
        _col('status', 'Status', true),
        _col('nationality', 'Nationality'),
        _col('ref', 'Request'),
        ..._docCols(),
    ],
};

// Client-facing wording of a crew change stage
const CREW_STAGE_LABEL = {
    search:      'Candidate search',
    approval:    'Awaiting your approval',
    preparation: 'Approved — joining preparation',
    ready:       'Approved — ready to join',
    requested:   'Sign-off requested',
    relief:      'Relief planned',
    contract:    'Contract end',
    active:      'Requested',
    completed:   'Completed',
};

const CREW_CHANGE_CHIP = {
    signon:    { text: 'Sign-on',   color: 'light-blue-darken-2' },
    signoff:   { text: 'Sign-off',  color: 'red-darken-4' },
    extension: { text: 'Extension', color: 'amber-darken-3' },
    promotion: { text: 'Promotion', color: 'deep-orange-darken-1' },
};

// Person columns shared by every list (blank "to be nominated" when no seafarer)
function _crewPersonFields(seafarerId, fallbackName) {
    const s = seafarerById(seafarerId);
    if (!s) {
        return { seafarerId: null, fullName: fallbackName || 'TO BE NOMINATED', fullName_link: false };
    }
    const pass = findDocument(s.id, 'Passport');
    const sb   = findDocument(s.id, "Seaman's Book");
    const med  = findDocument(s.id, 'Medical Certificate');
    const coc  = seafarerDocuments(s.id).find(x => x.category === 'STCW' &&
                 (x.name.indexOf('Certificate of Competency') === 0 || x.name.indexOf('Able Seafarer') === 0 || x.name.indexOf('Rating') === 0));
    const sum  = docSummary(s.id);
    const chip = sum.expired
        ? { text: sum.expired + ' expired' + (sum.expiring ? ' · ' + sum.expiring + ' expiring' : ''), color: 'error' }
        : sum.expiring ? { text: sum.expiring + ' expiring', color: 'warning' }
        : { text: 'All valid', color: 'success' };
    return {
        seafarerId:     s.id,
        fullName:       fullNameLF(s),
        age:            seafarerAge(s),
        nationality:    (s.nationality || '').toUpperCase(),
        passportNo:     pass && pass.number,
        passportExp:    pass && pass.expiryDate,  passportExp_st: pass && docStatus(pass),
        sbNo:           sb && sb.number,
        sbExp:          sb && sb.expiryDate,      sbExp_st: sb && docStatus(sb),
        coc:            coc ? coc.name.replace('Certificate of Competency — ', '').toUpperCase() : null,
        medicalExp:     med && med.expiryDate,    medicalExp_st: med && docStatus(med),
        availability:   availabilityOf(s.id),
        docStatus:      chip.text, docStatus_sort: sum.expired ? 0 : sum.expiring ? 1 : 2,
        docChip:        chip,
    };
}

function _rankFields(rank) {
    return { rank: rank.toUpperCase(), rank_sort: CREW_RANK_ORDER.indexOf(rank) };
}

const ClientCrewListsView = {
    template: '#tpl-client-crew-lists',

    data() {
        const today = isoDate(TODAY);
        const visible = {};
        Object.keys(CREW_LIST_COLUMNS).forEach(k => {
            visible[k] = CREW_LIST_COLUMNS[k].filter(c => c.def).map(c => c.key);
        });
        return {
            store:        erpStore,
            todayStr:     today,
            // ?list= and ?vessel= let the dashboard deep-link into a list
            list:         ['onboard', 'ashore', 'approved', 'changes'].includes(this.$route.query.list) ? this.$route.query.list : 'onboard',
            filterVessel: this.$route.query.vessel || null,
            onDate:       today,
            approvedFrom: today,
            approvedTo:   isoDate(addM(TODAY, 6)),
            changesFrom:  isoDate(addM(TODAY, -3)),
            changesTo:    isoDate(addM(TODAY, 3)),
            filterRanks:  [],
            filterNats:   [],
            filterMenu:   false,
            visible,
        };
    },

    watch: {
        'store.clientUi.clientId'() { this.filterVessel = null; },
        onDate(v) { if (v && v > this.todayStr) this.onDate = this.todayStr; },
    },

    computed: {
        lists() {
            return [
                { id: 'onboard',  label: 'On Board',                 icon: 'mdi-ferry' },
                { id: 'ashore',   label: 'Ashore',                   icon: 'mdi-beach' },
                { id: 'approved', label: 'Approved for Embarkation', icon: 'mdi-account-check' },
                { id: 'changes',  label: 'Crew Changes',             icon: 'mdi-swap-vertical' },
            ];
        },
        client() { return allClientsData.find(c => c.id === this.store.clientUi.clientId) || null; },
        clientVessels() {
            return this.client ? allVessels.filter(v => this.client.vesselIds.includes(v.id)) : [];
        },
        vesselItems() { return this.clientVessels.map(v => ({ id: v.id, name: v.name })); },
        vessels() { return this.clientVessels.filter(v => !this.filterVessel || v.id === this.filterVessel); },
        vesselName() {
            const v = this.clientVessels.find(x => x.id === this.filterVessel);
            return v ? v.name : 'All vessels';
        },

        columns() { return CREW_LIST_COLUMNS[this.list]; },
        sections() {
            return this.list === 'changes'
                ? [{ id: 'completed', label: 'Completed changes', icon: 'mdi-check-circle-outline' },
                   { id: 'planned',   label: 'Planned changes',   icon: 'mdi-calendar-clock' }]
                : null;
        },

        rows() {
            if (!this.client) return [];
            if (this.list === 'onboard')  return this.buildOnboard();
            if (this.list === 'ashore')   return this.buildAshore();
            if (this.list === 'approved') return this.buildApproved();
            return this.buildChanges();
        },
        rankOptions() { return [...new Set(this.rows.map(r => r.rank).filter(Boolean))]; },
        natOptions()  { return [...new Set(this.rows.map(r => r.nationality).filter(Boolean))].sort(); },
        activeFilterCount() { return this.filterRanks.length + this.filterNats.length; },
        filteredRows() {
            return this.rows.filter(r =>
                (!this.filterRanks.length || this.filterRanks.includes(r.rank)) &&
                (!this.filterNats.length  || this.filterNats.includes(r.nationality)));
        },

        pdfTitle() { return 'Crew List — ' + this.lists.find(l => l.id === this.list).label; },
        pdfSubtitle() {
            const parts = [this.client ? this.client.name : '', 'Vessel: ' + this.vesselName];
            if (this.list === 'onboard')  parts.push('On board on ' + atlDate(this.onDate));
            if (this.list === 'ashore')   parts.push('Ashore on ' + atlDate(this.todayStr));
            if (this.list === 'approved') parts.push('Embarking ' + atlDate(this.approvedFrom) + ' – ' + atlDate(this.approvedTo));
            if (this.list === 'changes')  parts.push('Period ' + atlDate(this.changesFrom) + ' – ' + atlDate(this.changesTo));
            if (this.filterRanks.length)  parts.push('Rank: ' + this.filterRanks.join(', '));
            if (this.filterNats.length)   parts.push('Nationality: ' + this.filterNats.join(', '));
            return parts.join('  ·  ');
        },
    },

    methods: {
        atlDate,
        openProfile(row) { if (row.seafarerId) this.store.clientUi.profileId = row.seafarerId; },
        clearFilters()   { this.filterRanks = []; this.filterNats = []; },

        // 1. On board on a date
        buildOnboard() {
            const date = this.onDate || this.todayStr;
            const rows = [];
            this.vessels.forEach(v => crewOnDate(v, date).forEach(r => {
                if (r.kind !== 'current' && r.kind !== 'past') return;
                rows.push(Object.assign(
                    { _key: v.id + '|' + r.rank + '|' + r.pos },
                    _crewPersonFields(r.seafarerId),
                    _rankFields(r.rank),
                    {
                        vessel:      v.name.toUpperCase(),
                        signOnDate:  r.embark,
                        signOnPort:  crewPort(v.id, 'on' + r.seafarerId + r.embark),
                        signOffDate: r.signoff,
                        signOffPort: (r.relief && r.relief.port) || crewPort(v.id, 'off' + r.seafarerId + r.signoff),
                        contract:    Math.round(daysB(d(r.embark), d(r.signoff)) / 30.44),
                        daysOnBoard: daysB(d(r.embark), d(date)) + 1,
                    }));
            }));
            return rows;
        },

        // 2. Dedicated to the client and ashore today
        buildAshore() {
            const rows = [];
            ashoreDedicated(this.client.id).forEach(({ seafarerId: id, tour: t }) => {
                if (this.filterVessel && t.vesselId !== this.filterVessel) return;
                const v = allVessels.find(x => x.id === t.vesselId);
                rows.push(Object.assign(
                    { _key: 'a' + id },
                    _crewPersonFields(id),
                    _rankFields(seafarerById(id).rank),
                    {
                        lastVessel:      v.name.toUpperCase(),
                        lastSignOff:     t.signoff,
                        lastSignOffPort: crewPort(v.id, 'off' + id + t.signoff),
                        daysAshore:      daysB(d(t.signoff), d(this.todayStr)),
                    }));
            });
            return rows.sort((a, b) => a.rank_sort - b.rank_sort);
        },

        // 3. Approved for a future embarkation within the period
        buildApproved() {
            const rows = [];
            this.vessels.forEach(v => crewEvents(v).forEach(e => {
                if (e.type !== 'embark' || !isApprovedStage(e.stage) || !e.name) return;
                if (e.date < this.approvedFrom || e.date > this.approvedTo) return;
                const row = v.ranks.find(r => (r.rfr_rfe && r.rfr_rfe.rfaNo === e.ref) || (r.rfa && r.rfa.rfaNo === e.ref));
                const relieved = row && row.onboard ? seafarerById(row.onboard.seafarerId) : null;
                rows.push(Object.assign(
                    { _key: e.ref },
                    _crewPersonFields(e.seafarerId, e.name),
                    _rankFields(e.rank),
                    {
                        vessel:     v.name.toUpperCase(),
                        estEmbark:  e.date,
                        embarkPort: e.port || crewPort(v.id, e.ref),
                        relieving:  relieved ? fullNameLF(relieved) : '—',
                        ref:        e.ref,
                    }));
            }));
            return rows.sort((a, b) => a.estEmbark.localeCompare(b.estEmbark));
        },

        // 4. Crew changes in the period — completed (≤ today) and planned
        buildChanges() {
            const from = this.changesFrom, to = this.changesTo, today = this.todayStr;
            const inPeriod = date => date >= from && date <= to;
            const rows = [];
            const push = (section, type, date, v, rank, seafarerId, name, port, status, ref) => {
                rows.push(Object.assign(
                    { _key: [section, type, v.id, rank, date, seafarerId || name || '', ref || ''].join('|'), _section: section },
                    _crewPersonFields(seafarerId, name),
                    _rankFields(rank),
                    { date, change: CREW_CHANGE_CHIP[type].text, changeChip: CREW_CHANGE_CHIP[type],
                      vessel: v.name.toUpperCase(), port, status, ref: ref || '—' }));
            };
            this.vessels.forEach(v => {
                // Completed: sign-ons and sign-offs of past tours, sign-on of current tours
                const tours = crewPastAssignments.filter(a => a.vesselId === v.id).map(a => Object.assign({ current: false }, a));
                v.ranks.forEach(r => {
                    if (r.onboard) tours.push({ vesselId: v.id, rank: r.rank, seafarerId: r.onboard.seafarerId, embark: r.onboard.embark, current: true });
                });
                tours.forEach(t => {
                    if (t.embark <= today && inPeriod(t.embark)) {
                        push('completed', 'signon', t.embark, v, t.rank, t.seafarerId, null,
                             crewPort(v.id, 'on' + t.seafarerId + t.embark), 'COMPLETED');
                    }
                    if (!t.current && t.signoff <= today && inPeriod(t.signoff)) {
                        push('completed', 'signoff', t.signoff, v, t.rank, t.seafarerId, null,
                             crewPort(v.id, 'off' + t.seafarerId + t.signoff), 'COMPLETED');
                    }
                });
                // Planned: pending events (overdue ones stay planned until they happen)
                crewEvents(v).forEach(e => {
                    if (!inPeriod(e.date)) return;
                    const type = e.type === 'embark' ? 'signon' : e.type;
                    const status = (CREW_STAGE_LABEL[e.stage] || e.stage).toUpperCase() + (e.overdue ? ' (OVERDUE)' : '');
                    const named = e.type !== 'embark' || isApprovedStage(e.stage);
                    push('planned', type, e.date, v, e.rank,
                         named ? e.seafarerId : null, named ? e.name : null,
                         e.port || crewPort(v.id, (e.ref || '') + e.date), status, e.ref);
                });
            });
            return rows.sort((a, b) => a.date.localeCompare(b.date) || a.rank_sort - b.rank_sort);
        },
    },
};
