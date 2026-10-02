/* ── views/ClientPreparation.js ───────────────────────────────
   Client UI → On Preparation, and the Atlantis "Preparation Checklist" dialog.
   Templates in index.html: tpl-client-preparation, tpl-preparation-dialog

   Requests On Preparation (erpStore.rfaRows): approved embarkations
   (replacement rows → rfeTasks, standalone RFE rows → tasks), sign-offs,
   extensions and promotions with status 'preparation'. The checklist
   (data/preparation.js) lists document requirements and manual tasks with
   their fulfilment — read-only for the client and WITHOUT the internal parts
   of the Atlantis screen (edit contract / allotments, cancel, costs, totals).

   - ClientPreparationView — page: list filtered by type / vessel / status;
                             each row opens the checklist dialog.
   - PreparationDialog     — global <preparation-dialog>, opened by setting
                             erpStore.clientUi.prepRef (request number); also
                             opened from green / request bars on the Rotation Plan.

   Depends on globals: erpStore, allVessels, allClientsData, utils.js, crew.js,
     documents.js, preparation.js, ClientCommon.js (atlDate, AtlTable)
   Exposes globals: ClientPreparationView, PreparationDialog,
     clientPreparationItems(), findPrepItem(), contractPdf()
──────────────────────────────────────────────────────────────── */

const PREP_DUE_DAYS = 14;    // preparation due this many days before the date

const PREP_STATUS = {
    preparation: { label: 'On Preparation', color: 'info' },
    ready:       { label: 'Ready',          color: 'success' },
};

const PREP_KIND_CHIP = {
    rfe: { text: 'Embarkation', color: 'light-blue-darken-2' },
    rfs: { text: 'Sign-off',    color: 'red-darken-4' },
    rfx: { text: 'Extension',   color: 'amber-darken-3' },
    rfp: { text: 'Promotion',   color: 'deep-orange-darken-1' },
};

function _prepItem(row, kind, ref) {
    const progress = prepProgress(row, kind);
    return {
        ref, kind, row, progress,
        vessel:     allVessels.find(v => v.id === row.vesselId),
        rank:       row.rank,
        seafarerId: prepSeafarerId(row, kind),
        date:       row.deadline,
        due:        isoDate(new Date(d(row.deadline).getTime() - PREP_DUE_DAYS * 86400000)),
        port:       kind === 'rfe' ? (row.embarkPort || row.port) : (row.port || row.signoffPort || null),
        status:     progress.complete ? 'ready' : 'preparation',
    };
}

// Requests On Preparation on the client's vessels
function clientPreparationItems(client) {
    const R = erpStore.rfaRows;
    if (!client || !R) return [];
    return [
        ...R.replacement.filter(r => r.rfeStatus === 'OnPreparation').map(r => _prepItem(r, 'rfe', r.rfeNo)),
        ...R.embarkation.filter(r => r.rfeStatus === 'OnPreparation').map(r => _prepItem(r, 'rfe', r.rfaNo)),
        ...R.signoff.filter(r => r.status === 'preparation').map(r => _prepItem(r, 'rfs', r.rfaNo)),
        ...R.extension.filter(r => r.status === 'preparation').map(r => _prepItem(r, 'rfx', r.rfaNo)),
        ...R.promotion.filter(r => r.status === 'preparation').map(r => _prepItem(r, 'rfp', r.rfaNo)),
    ].filter(i => client.vesselIds.includes(i.row.vesselId));
}

function findPrepItem(ref) {
    const R = erpStore.rfaRows;
    if (!ref || !R) return null;
    let r = R.replacement.find(x => x.rfeNo === ref && x.rfeStatus === 'OnPreparation');
    if (r) return _prepItem(r, 'rfe', ref);
    r = R.embarkation.find(x => x.rfaNo === ref && x.rfeStatus === 'OnPreparation');
    if (r) return _prepItem(r, 'rfe', ref);
    for (const [tab, kind] of [['signoff', 'rfs'], ['extension', 'rfx'], ['promotion', 'rfp']]) {
        r = R[tab].find(x => x.rfaNo === ref && x.status === 'preparation');
        if (r) return _prepItem(r, kind, ref);
    }
    return null;
}

function _prepDaysLeft(iso) { return daysB(d(isoDate(TODAY)), d(iso)); }

// Mock employment contract (embarkation) / contract amendment (extension, promotion)
function contractPdf(item) {
    const s = seafarerById(item.seafarerId);
    const v = item.vessel;
    const rank = item.kind === 'rfp' ? item.row.newRank : item.rank;
    const start = item.kind === 'rfx' ? (item.row.currentSignoff || item.date) : item.date;
    const end = item.kind === 'rfx' ? item.date : prepNeedUntil(item.row, item.kind);
    const title = item.kind === 'rfe' ? 'CONTRACT OF EMPLOYMENT'
                : item.kind === 'rfx' ? 'CONTRACT AMENDMENT — EXTENSION' : 'CONTRACT AMENDMENT — PROMOTION';
    const terms = (v.vesselContract || []).find(c => c.rank === rank);
    const pdf = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    const W = pdf.internal.pageSize.getWidth();
    pdf.setFillColor(21, 101, 192); pdf.rect(0, 0, W, 64, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(17); pdf.setTextColor(255, 255, 255);
    pdf.text(title, 40, 40);
    pdf.setFontSize(10); pdf.text('crossworld', W - 40, 40, { align: 'right' });
    pdf.setTextColor(33, 33, 33); pdf.setFontSize(10);
    const rows = [
        ['Request', item.ref],
        ['Principal', v.client],
        ['Seafarer', s ? fullNameLF(s) : '—'],
        ['Nationality', s ? (s.nationality || '').toUpperCase() : '—'],
        ['Rank', (rank || '').toUpperCase()],
        ['Vessel', v.name.toUpperCase() + ' — ' + v.type + ' — ' + v.flag + ' flag — IMO ' + v.imo],
        ['Period', atlDate(start) + ' – ' + atlDate(end)],
        ['Port of joining', item.port || '—'],
        ['Collective agreement', terms ? terms.cba : 'As per applicable CBA'],
    ];
    pdf.autoTable({
        startY: 90, body: rows, theme: 'plain',
        styles: { fontSize: 10, cellPadding: 5 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 150 } },
        margin: { left: 40, right: 40 },
    });
    if (terms) {
        const money = n => n == null ? '—' : Number(n).toFixed(2);
        pdf.autoTable({
            startY: pdf.lastAutoTable.finalY + 16,
            head: [['Monthly wages (USD)', 'Amount']],
            body: [['Basic salary', money(terms.basicSalary)], ['Guaranteed overtime', money(terms.guaranteedOt)],
                   ['Fixed overtime', money(terms.fixedOt)], ['Leave pay', money(terms.leavePay)],
                   ['Leave subsistence', money(terms.leaveSubsistence)], ['Allowance', money(terms.allowance)],
                   ['Supplementary wages', money(terms.suppWages)]],
            styles: { fontSize: 9 }, headStyles: { fillColor: [245, 245, 245], textColor: [33, 33, 33], fontStyle: 'bold' },
            margin: { left: 40, right: 40 },
        });
    }
    const y = pdf.lastAutoTable.finalY + 60;
    pdf.setDrawColor(150); pdf.line(40, y, 230, y); pdf.line(W - 230, y, W - 40, y);
    pdf.setFontSize(9); pdf.text('Seafarer', 40, y + 14); pdf.text('For the principal / manning agent', W - 230, y + 14);
    pdf.setFontSize(8); pdf.setTextColor(140, 140, 140);
    pdf.text('Mockup contract generated by the Client Portal mockup — not a legal document.', 40, pdf.internal.pageSize.getHeight() - 24);
    return pdf;
}

// ── Preparation dialog ────────────────────────────────────────
const PreparationDialog = {
    template: '#tpl-preparation-dialog',

    data() {
        return { store: erpStore, viewerDoc: null };
    },

    computed: {
        open: {
            get() { return !!this.store.clientUi.prepRef; },
            set(v) { if (!v) this.store.clientUi.prepRef = null; },
        },
        item()       { return findPrepItem(this.store.clientUi.prepRef); },
        kindMeta()   { return PREP_KINDS[this.item.kind]; },
        statusMeta() { return PREP_STATUS[this.item.status]; },
        seafarer()   { return seafarerById(this.item.seafarerId); },
        refLabel()   { return this.item.ref.replace('-', ' – '); },
        vesselLine() {
            const v = this.item.vessel;
            return [v.name, v.type, this.item.port].filter(Boolean).join(' – ').toUpperCase();
        },
        // Document requirements grouped by category, in rule order
        docGroups() {
            const groups = [];
            prepDocRequirements(this.item.row, this.item.kind).forEach(r => {
                let g = groups.find(x => x.name === r.category);
                if (!g) groups.push(g = { name: r.category, items: [] });
                g.items.push(r);
            });
            return groups;
        },
        // Manual tasks grouped (DOCUMENTS, GENERAL, TRAVEL) — no costs
        taskGroups() {
            const order = ['DOCUMENTS', 'GENERAL', 'TRAVEL'];
            const tasks = prepManualTasks(this.item.row, this.item.kind);
            return order.map(name => ({ name, items: tasks.filter(t => (t.group || 'GENERAL') === name) }))
                        .filter(g => g.items.length);
        },
    },

    methods: {
        atlDate, fullNameLF,
        daysLeftText(iso) {
            const n = _prepDaysLeft(iso);
            return n < 0 ? Math.abs(n) + ' Days overdue' : n + ' Days left';
        },
        daysLeftCls(iso) { return _prepDaysLeft(iso) <= 14 ? 'text-error' : ''; },
        reqNote(r) {
            return {
                valid:    'Valid until ' + atlDate(r.doc && r.doc.expiryDate),
                noexpiry: 'No expiry',
                renewed:  'Renewed during preparation',
                missing:  'Missing — to be obtained',
                expires:  (r.doc && r.doc.expiryDate < isoDate(TODAY) ? 'Expired ' : 'Expires ') + atlDate(r.doc && r.doc.expiryDate)
                          + ' — renewal needed (valid until ' + atlDate(r.until) + ' required)',
            }[r.state];
        },
        openProfile() { if (this.item.seafarerId) this.store.clientUi.profileId = this.item.seafarerId; },
        viewDoc(r)    { this.viewerDoc = r.doc; },
        printContract() { contractPdf(this.item).save(this.item.ref + '_contract.pdf'); },
    },
};

// ── On Preparation page ───────────────────────────────────────
const ClientPreparationView = {
    template: '#tpl-client-preparation',

    data() {
        return {
            store:        erpStore,
            kind:         '',          // '' | 'rfe' | 'rfs' | 'rfx' | 'rfp'
            filterVessel: null,
            visible:      ['type', 'seafarer', 'date', 'daysLeft', 'progress', 'openDocs', 'status'],
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
        items() { return clientPreparationItems(this.client); },
        kinds() {
            const count = k => this.items.filter(i => !k || i.kind === k).length;
            return [
                { id: '',    label: 'All',         count: count('') },
                { id: 'rfe', label: 'Embarkation', count: count('rfe') },
                { id: 'rfs', label: 'Sign-off',    count: count('rfs') },
                { id: 'rfx', label: 'Extension',   count: count('rfx') },
                { id: 'rfp', label: 'Promotion',   count: count('rfp') },
            ];
        },
        columns() {
            return [
                { key: 'ref',      title: 'Request',  fixed: true, type: 'link' },
                { key: 'vessel',   title: 'Vessel',   fixed: true },
                { key: 'rank',     title: 'Rank',     fixed: true },
                { key: 'type',     title: 'Type',     type: 'chip', chip: r => r.typeChip },
                { key: 'seafarer', title: 'Seafarer' },
                { key: 'date',     title: 'Date',     format: (v, r) => r.dateLabel + ' ' + atlDate(v) },
                { key: 'due',      title: 'Due',      format: v => atlDate(v) },
                { key: 'daysLeft', title: 'Days Left', cls: r => r.daysLeft <= 14 && r.statusId !== 'ready' ? 'atl-text-error' : '' },
                { key: 'progress', title: 'Progress' },
                { key: 'openDocs', title: 'Open Documents', cls: r => r.openDocs ? 'atl-text-warning' : '' },
                { key: 'status',   title: 'Status',   type: 'chip', chip: r => r.statusChip },
            ];
        },
        rows() {
            return this.items
                .filter(i => !this.kind || i.kind === this.kind)
                .filter(i => !this.filterVessel || i.row.vesselId === this.filterVessel)
                .map(i => {
                    const s = seafarerById(i.seafarerId);
                    return {
                        _key: i.ref, ref: i.ref, statusId: i.status,
                        vessel: i.vessel.name.toUpperCase(),
                        rank: i.rank.toUpperCase() + (i.kind === 'rfp' && i.row.newRank ? ' → ' + i.row.newRank.toUpperCase() : ''),
                        rank_sort: CREW_RANK_ORDER.indexOf(i.rank),
                        type: PREP_KIND_CHIP[i.kind].text, typeChip: PREP_KIND_CHIP[i.kind],
                        seafarer: s ? fullNameLF(s) : '—',
                        date: i.date, dateLabel: PREP_KINDS[i.kind].dateLabel, due: i.due,
                        daysLeft: _prepDaysLeft(i.date),
                        progress: i.progress.done + ' / ' + i.progress.total, progress_sort: i.progress.done / (i.progress.total || 1),
                        openDocs: i.progress.docsOpen || '—', openDocs_sort: i.progress.docsOpen,
                        status: PREP_STATUS[i.status].label,
                        statusChip: { text: PREP_STATUS[i.status].label, color: PREP_STATUS[i.status].color },
                    };
                })
                .sort((a, b) => a.date.localeCompare(b.date));
        },
        pdfSubtitle() {
            const parts = [this.client ? this.client.name : '', 'Type: ' + this.kinds.find(k => k.id === this.kind).label];
            if (this.filterVessel) parts.push('Vessel: ' + this.vesselItems.find(v => v.id === this.filterVessel).name);
            return parts.join('  ·  ');
        },
    },

    methods: {
        openItem(row) { this.store.clientUi.prepRef = row.ref; },
    },
};
