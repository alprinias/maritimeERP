/* ── views/ClientApprovals.js ─────────────────────────────────
   Client UI → Pending Approvals, and the Atlantis approval dialog.
   Templates in index.html: tpl-client-approvals, tpl-approval-dialog

   Approval requests are the RFE rows of erpStore.rfaRows (replacement rows →
   rfeCandidates, embarkation rows → candidates) on the client's vessels.
   Candidates the agency sent for approval have acceptance 'onApproval'; the
   principal approves ONE (→ joining preparation) or rejects ALL with a
   reason (→ the agency continues the candidate search). Decisions use
   principalApprove / principalRejectAll (RFAs.js), so the internal RFAs view
   shows them read-only.

   - ClientApprovalsView  — page: list of requests, waiting for approval by
                            default or all requests in a join-date period;
                            each opens the approval dialog (the Rotation Plan
                            page opens it from its relief bars too).
   - ApprovalDialog       — global <approval-dialog>, opened by setting
                            erpStore.clientUi.approvalRef (request number).

   Depends on globals: erpStore, allVessels, allClientsData, utils.js, crew.js,
     documents.js, RFAs.js (ensureRfaRows, pendingCandidates, principal*),
     ClientCommon.js (atlDate, AtlTable, documentPdf)
   Exposes globals: ClientApprovalsView, ApprovalDialog, clientApprovalItems(),
     findApprovalItem(), cvPdf()
──────────────────────────────────────────────────────────────── */

const APPROVAL_DUE_DAYS = 14;    // decision due this many days before joining

const APPROVAL_STATUS = {
    pending:  { label: 'Awaiting your approval', color: 'deep-purple' },
    approved: { label: 'Approved',               color: 'success' },
    rejected: { label: 'Rejected — new search',  color: 'error' },
    search:   { label: 'Candidate search',       color: 'blue-grey' },
};

// Approval view of an RFE row (kind 'rfr' = replacement, 'rfe' = standalone)
function _approvalItem(row, kind) {
    const vessel  = allVessels.find(v => v.id === row.vesselId);
    const pending = pendingCandidates(row);
    const last    = row.approvalHistory[row.approvalHistory.length - 1];
    const status  = row.rfeStatus === 'OnPreparation' ? 'approved'
                  : pending.length ? 'pending'
                  : last && last.action === 'rejected' ? 'rejected' : 'search';
    return {
        ref:       kind === 'rfr' ? row.rfeNo : row.rfaNo,
        kind, row, vessel, pending, status,
        rank:      row.rank,
        joinDate:  row.deadline,
        due:       isoDate(new Date(d(row.deadline).getTime() - APPROVAL_DUE_DAYS * 86400000)),
        port:      kind === 'rfr' ? row.embarkPort : row.port,
        relieving: kind === 'rfr' ? row.seafarer : null,
        sentCount: rfaCandidates(row).filter(c => c.acceptance === 'onApproval').length,
    };
}

function clientApprovalItems(client) {
    if (!client || !erpStore.rfaRows) return [];
    return [
        ...erpStore.rfaRows.replacement.map(r => _approvalItem(r, 'rfr')),
        ...erpStore.rfaRows.embarkation.map(r => _approvalItem(r, 'rfe')),
    ].filter(i => client.vesselIds.includes(i.row.vesselId));
}

function findApprovalItem(ref) {
    if (!ref || !erpStore.rfaRows) return null;
    const rfr = erpStore.rfaRows.replacement.find(r => r.rfeNo === ref);
    if (rfr) return _approvalItem(rfr, 'rfr');
    const rfe = erpStore.rfaRows.embarkation.find(r => r.rfaNo === ref);
    return rfe ? _approvalItem(rfe, 'rfe') : null;
}

function _daysLeft(iso) { return daysB(d(isoDate(TODAY)), d(iso)); }
function _daysLeftText(iso) {
    const n = _daysLeft(iso);
    return n < 0 ? Math.abs(n) + ' Days overdue' : n === 0 ? 'Today' : n + ' Days left';
}

// Services summary of a pool seafarer: { total, atRank, asOfficer } as "n trips · Mm"
function _serviceStats(s) {
    const fmt = x => x ? x.count + ' trips · ' + x.months + 'm' : '—';
    if (!s || !s.services) return { total: '—', atRank: '—', asOfficer: '—' };
    const tot = s.services.reduce((a, x) => ({ count: a.count + x.count, months: a.months + x.months }), { count: 0, months: 0 });
    return {
        total:     fmt(tot),
        atRank:    fmt(s.services.find(x => x.label === 'At Rank')),
        asOfficer: fmt(s.services.find(x => x.label === 'As Officer')),
    };
}

// Mock CV of a seafarer as a jsPDF instance
function cvPdf(s) {
    const pdf = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    const W = pdf.internal.pageSize.getWidth();
    pdf.setFillColor(21, 101, 192); pdf.rect(0, 0, W, 70, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(20); pdf.setTextColor(255, 255, 255);
    pdf.text('CURRICULUM VITAE', 40, 44);
    pdf.setFontSize(10); pdf.text('crossworld', W - 40, 44, { align: 'right' });
    pdf.setTextColor(33, 33, 33); pdf.setFontSize(16);
    pdf.text(fullNameLF(s), 40, 110);
    const c = allClientsData.find(x => x.id === dedicatedClientOf(s.id));
    const facts = [
        ['Rank', s.rank.toUpperCase()], ['Nationality', (s.nationality || '').toUpperCase()],
        ['Age', String(seafarerAge(s))], ['Available from', atlDate(availabilityOf(s.id))],
        ['Dedicated to', c ? c.name : '—'],
    ];
    pdf.setFontSize(10);
    facts.forEach((f, i) => {
        pdf.setFont('helvetica', 'bold');   pdf.text(f[0] + ':', 40, 135 + i * 16);
        pdf.setFont('helvetica', 'normal'); pdf.text(f[1], 150, 135 + i * 16);
    });
    const head = { fillColor: [245, 245, 245], textColor: [33, 33, 33], fontStyle: 'bold' };
    pdf.autoTable({
        startY: 230, head: [['Sea service', 'Rank', 'Trips', 'Months']],
        body: (s.services || []).map(x => [x.label, x.rank.toUpperCase(), x.count, x.months]),
        styles: { fontSize: 9 }, headStyles: head, margin: { left: 40, right: 40 },
    });
    const tours = seafarerTours(s.id);
    if (tours.length) {
        pdf.autoTable({
            startY: pdf.lastAutoTable.finalY + 20, head: [['Vessel', 'Rank', 'Sign-on', 'Sign-off']],
            body: tours.map(t => [allVessels.find(v => v.id === t.vesselId).name.toUpperCase(), t.rank.toUpperCase(),
                                  atlDate(t.embark), t.current ? 'On board' : atlDate(t.signoff)]),
            styles: { fontSize: 9 }, headStyles: head, margin: { left: 40, right: 40 },
        });
    }
    pdf.autoTable({
        startY: pdf.lastAutoTable.finalY + 20, head: [['Certificates & documents', 'Category', 'Expiry']],
        body: seafarerDocuments(s.id).map(x => [x.name, x.category, x.expiryDate ? atlDate(x.expiryDate) : '—']),
        styles: { fontSize: 8 }, headStyles: head, margin: { left: 40, right: 40 },
    });
    pdf.setFontSize(8); pdf.setTextColor(140, 140, 140);
    pdf.text('Mockup CV generated by the Client Portal mockup.', 40, pdf.internal.pageSize.getHeight() - 24);
    return pdf;
}

// ── Approval dialog ───────────────────────────────────────────
const ApprovalDialog = {
    template: '#tpl-approval-dialog',

    data() {
        return {
            store:      erpStore,
            choice:     null,      // candidate id selected with the Approve radio
            rejectOpen: false,
            reason:     '',
            cvDoc:      null,
            cvSeafarer: null,
        };
    },

    watch: {
        'store.clientUi.approvalRef'() { this.choice = null; this.reason = ''; this.rejectOpen = false; },
    },

    computed: {
        open: {
            get() { return !!this.store.clientUi.approvalRef; },
            set(v) { if (!v) this.store.clientUi.approvalRef = null; },
        },
        item()       { return findApprovalItem(this.store.clientUi.approvalRef); },
        statusMeta() { return APPROVAL_STATUS[this.item.status]; },
        refLabel()   { return this.item.ref.replace('-', ' – '); },
        vesselLine() {
            const v = this.item.vessel;
            return [v.name, v.type, this.item.port].filter(Boolean).join(' – ').toUpperCase();
        },
        history()    { return this.item.row.approvalHistory.slice().reverse(); },
        approvedName() {
            const s = seafarerById(seafarerIdByName(this.item.row.confirmedSeafarer));
            return s ? fullNameLF(s) : this.item.row.confirmedSeafarer;
        },
        chosen()     { return this.choice ? seafarerById(this.choice) : null; },
    },

    methods: {
        atlDate, fullNameLF,
        daysLeftText: _daysLeftText,
        daysLeftCls(iso) { return _daysLeft(iso) <= 14 ? 'text-error' : ''; },
        person(c)     { return seafarerById(c.id); },
        dedication(c) {
            const cl = allClientsData.find(x => x.id === dedicatedClientOf(c.id));
            return cl ? cl.name.toUpperCase() : null;
        },
        age(c)        { return seafarerAge(this.person(c)); },
        avail(c)      { return availabilityOf(c.id); },
        stats(c)      { return _serviceStats(this.person(c)); },
        openProfile(c) { this.store.clientUi.profileId = c.id; },
        openCv(c) {
            const s = this.person(c);
            this.cvSeafarer = s;
            this.cvDoc = {
                id: 'cv' + s.id, category: 'Internal Doc', name: 'Curriculum Vitae', number: 'CV-' + s.id,
                country: '—', issuedBy: 'CROSSWORLD', issueDate: isoDate(TODAY), expiryDate: null,
                fileName: (s.lastName || s.name).replace(/\W+/g, '_') + '_CV.pdf',
                statusText: 'Current', pdf: () => cvPdf(s),
            };
        },
        confirmApprove() {
            const name = fullNameLF(this.chosen);
            principalApprove(this.item.row, this.choice);
            this.choice = null;
            this.store.clientUi.toast = 'Approved ' + name + ' for ' + this.item.ref;
        },
        confirmReject() {
            principalRejectAll(this.item.row, this.reason.trim());
            this.rejectOpen = false;
            this.reason = '';
            this.store.clientUi.toast = 'All candidates rejected for ' + this.item.ref + ' — the agency continues the search';
        },
    },
};

// ── Pending Approvals page ────────────────────────────────────
const ClientApprovalsView = {
    template: '#tpl-client-approvals',

    data() {
        return {
            store:        erpStore,
            mode:         'pending',       // 'pending' | 'all'
            filterVessel: null,
            from:         isoDate(addM(TODAY, -3)),
            to:           isoDate(addM(TODAY, 6)),
            visible:      ['joinDate', 'due', 'daysLeft', 'candidates', 'relieving', 'status', 'approved'],
        };
    },

    watch: {
        'store.clientUi.clientId'() { this.filterVessel = null; },
    },

    computed: {
        client() { return allClientsData.find(c => c.id === this.store.clientUi.clientId) || null; },
        vesselItems() {
            return this.client ? allVessels.filter(v => this.client.vesselIds.includes(v.id)).map(v => ({ id: v.id, name: v.name })) : [];
        },
        items()        { return clientApprovalItems(this.client); },
        pendingCount() { return this.items.filter(i => i.status === 'pending').length; },
        columns() {
            const dueCls = r => r.status === 'pending' && r.daysLeft <= 14 ? 'atl-text-error' : '';
            return [
                { key: 'ref',        title: 'Request',      fixed: true, type: 'link' },
                { key: 'vessel',     title: 'Vessel',       fixed: true },
                { key: 'rank',       title: 'Rank',         fixed: true },
                { key: 'joinDate',   title: 'Join Date',    format: v => atlDate(v) },
                { key: 'port',       title: 'Join Port' },
                { key: 'due',        title: 'Approval Due', format: v => atlDate(v), cls: dueCls },
                { key: 'daysLeft',   title: 'Days Left',    cls: dueCls },
                { key: 'candidates', title: 'Candidates' },
                { key: 'relieving',  title: 'Relieving' },
                { key: 'status',     title: 'Status', type: 'chip', chip: r => r.statusChip },
                { key: 'approved',   title: 'Approved Seafarer' },
                { key: 'decision',   title: 'Last Decision' },
            ];
        },
        rows() {
            return this.items
                .filter(i => !this.filterVessel || i.row.vesselId === this.filterVessel)
                .filter(i => this.mode === 'pending'
                    ? i.status === 'pending'
                    : (!this.from || i.joinDate >= this.from) && (!this.to || i.joinDate <= this.to))
                .map(i => {
                    const last = i.row.approvalHistory[i.row.approvalHistory.length - 1];
                    const relieved = i.relieving ? seafarerById(seafarerIdByName(i.relieving)) : null;
                    const approved = i.status === 'approved' ? seafarerById(seafarerIdByName(i.row.confirmedSeafarer)) : null;
                    return {
                        _key: i.ref, ref: i.ref, status: APPROVAL_STATUS[i.status].label,
                        statusChip: { text: APPROVAL_STATUS[i.status].label, color: APPROVAL_STATUS[i.status].color },
                        vessel: i.vessel.name.toUpperCase(),
                        rank: i.rank.toUpperCase(), rank_sort: CREW_RANK_ORDER.indexOf(i.rank),
                        joinDate: i.joinDate, port: i.port, due: i.due, daysLeft: _daysLeft(i.joinDate),
                        candidates: i.status === 'pending' ? i.pending.length + ' awaiting' : (i.sentCount || '—'),
                        relieving: relieved ? fullNameLF(relieved) : (i.relieving || '— (new position)'),
                        approved: approved ? fullNameLF(approved) : (i.status === 'approved' ? i.row.confirmedSeafarer : '—'),
                        decision: last ? (last.action === 'approved' ? 'Approved ' : 'Rejected all ') + atlDate(last.date)
                                         + (last.reason ? ' — ' + last.reason : '') : '—',
                    };
                })
                .sort((a, b) => a.joinDate.localeCompare(b.joinDate));
        },
        pdfSubtitle() {
            const parts = [this.client ? this.client.name : ''];
            parts.push(this.mode === 'pending' ? 'Waiting for approval' : 'All requests, joining ' + atlDate(this.from) + ' – ' + atlDate(this.to));
            if (this.filterVessel) parts.push('Vessel: ' + this.vesselItems.find(v => v.id === this.filterVessel).name);
            return parts.join('  ·  ');
        },
    },

    methods: {
        openItem(row) { this.store.clientUi.approvalRef = row.ref; },
    },
};
