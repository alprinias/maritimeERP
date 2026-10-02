/* ── views/ClientAppraisals.js ────────────────────────────────
   Client UI → Appraisals: end-of-service appraisals of seafarers.
   Templates in index.html: tpl-client-appraisals, tpl-appraisal-dialog

   - ClientAppraisalsView — recent sign-offs (completed tours on the client's
                            vessels) with their appraisal status; "Add
                            appraisal" per row or from the toolbar.
   - AppraisalDialog      — global <appraisal-dialog>, opened by setting
                            erpStore.clientUi.appraisal = { key, mode }
                            (mode 'new' | 'view' | 'edit'; key null = pick the
                            service in the form). Sections from
                            APPRAISAL_SECTIONS graded 1-10, optional comments,
                            rehire yes / no with a required justification for no.

   Depends on globals: erpStore, allVessels, allClientsData, utils.js, crew.js,
     appraisals.js, ClientCommon.js (atlDate, AtlTable)
   Exposes globals: ClientAppraisalsView, AppraisalDialog, clientAppraisalTours(),
     appraisalPdf()
──────────────────────────────────────────────────────────────── */

// Completed tours on the client's vessels that signed off in the last `months` (0 = all)
function clientAppraisalTours(client, months) {
    if (!client) return [];
    const today = isoDate(TODAY);
    const from = months ? isoDate(addM(TODAY, -months)) : '';
    return crewPastAssignments
        .filter(t => client.vesselIds.includes(t.vesselId) && t.signoff <= today && t.signoff >= from)
        .sort((a, b) => b.signoff.localeCompare(a.signoff));
}

function _apprBand(n) {
    return n <= 3 ? 'poor' : n <= 5 ? 'below' : n <= 7 ? 'meets' : 'exceeds';
}

// Appraisal as a PDF (all sections, grades, averages, rehire decision)
function appraisalPdf(a) {
    const s = seafarerById(a.seafarerId);
    const v = allVessels.find(x => x.id === a.vesselId);
    const avg = appraisalAverages(a);
    const pdf = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    const W = pdf.internal.pageSize.getWidth();
    pdf.setFillColor(21, 101, 192); pdf.rect(0, 0, W, 64, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(17); pdf.setTextColor(255, 255, 255);
    pdf.text('SEAFARER APPRAISAL', 40, 40);
    pdf.setFontSize(10); pdf.text('crossworld', W - 40, 40, { align: 'right' });
    pdf.autoTable({
        startY: 84, theme: 'plain', styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 140 } }, margin: { left: 40, right: 40 },
        body: [
            ['Seafarer', s ? fullNameLF(s) : '—'],
            ['Rank', a.rank.toUpperCase()],
            ['Vessel', v.name.toUpperCase() + ' — ' + v.type + ' — IMO ' + v.imo],
            ['Service', atlDate(a.embark) + ' – ' + atlDate(a.signoff)],
            ['Appraised by', a.appraiser + ' on ' + atlDate(a.date)],
        ],
    });
    const body = [];
    APPRAISAL_SECTIONS.forEach(sec => {
        body.push([{ content: sec.title + (avg.sections[sec.id] != null ? '   (average ' + avg.sections[sec.id] + ')' : ''), colSpan: 3,
                     styles: { fillColor: [232, 240, 254], textColor: [21, 101, 192], fontStyle: 'bold' } }]);
        sec.criteria.forEach(c => {
            const g = a.grades[c.id];
            body.push([c.label, g != null ? String(g) : '—', g != null ? gradeMeta(g).label : '']);
        });
        if (a.comments[sec.id]) body.push([{ content: 'Comments: ' + a.comments[sec.id], colSpan: 3, styles: { fontStyle: 'italic' } }]);
    });
    pdf.autoTable({
        startY: pdf.lastAutoTable.finalY + 12, head: [['Criterion', 'Grade (1-10)', '']], body,
        styles: { fontSize: 9, cellPadding: 4 }, headStyles: { fillColor: [245, 245, 245], textColor: [33, 33, 33], fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'center', cellWidth: 80 }, 2: { cellWidth: 140 } }, margin: { left: 40, right: 40 },
    });
    pdf.autoTable({
        startY: pdf.lastAutoTable.finalY + 12, theme: 'plain', styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 140 } }, margin: { left: 40, right: 40 },
        body: [
            ['Overall score', (avg.overall != null ? avg.overall + ' / 10 — ' + gradeMeta(avg.overall).label : '—')],
            ['Rehire', a.rehire ? 'Yes' : 'No'],
            ...(a.rehire ? [] : [['Justification', a.justification]]),
            ...(a.remarks ? [['Remarks', a.remarks]] : []),
        ],
    });
    pdf.setFontSize(8); pdf.setTextColor(140, 140, 140);
    pdf.text('Client Portal — mockup', 40, pdf.internal.pageSize.getHeight() - 24);
    return pdf;
}

// ── Appraisal form dialog ─────────────────────────────────────
const AppraisalDialog = {
    template: '#tpl-appraisal-dialog',

    data() {
        return { store: erpStore, draft: null, mode: 'new' };
    },

    watch: {
        'store.clientUi.appraisal': {
            immediate: true,
            handler(v) { if (v) this.init(v); },
        },
    },

    computed: {
        open: {
            get() { return !!this.store.clientUi.appraisal; },
            set(v) { if (!v) this.store.clientUi.appraisal = null; },
        },
        client()    { return allClientsData.find(c => c.id === this.store.clientUi.clientId) || null; },
        readonly()  { return this.mode === 'view'; },
        sections()  { return APPRAISAL_SECTIONS; },
        tour()      { return this.draft && this.draft.key ? appraisalTourByKey(this.draft.key) : null; },
        seafarer()  { return this.tour ? seafarerById(this.tour.seafarerId) : null; },
        vessel()    { return this.tour ? allVessels.find(v => v.id === this.tour.vesselId) : null; },
        // New appraisal without a preselected service: services of the last 12 months not appraised yet
        pickable()  { return this.mode === 'new' && !this.store.clientUi.appraisal.key; },
        pendingTours() {
            return clientAppraisalTours(this.client, 12)
                .filter(t => !appraisalFor(appraisalKey(t)))
                .map(t => ({ key: appraisalKey(t),
                             label: fullNameLF(seafarerById(t.seafarerId)) + ' — ' + t.rank.toUpperCase() + ' — '
                                    + allVessels.find(v => v.id === t.vesselId).name.toUpperCase() + ' — signed off ' + atlDate(t.signoff) }));
        },
        averages()  { return appraisalAverages(this.draft); },
        missing() {
            return APPRAISAL_SECTIONS.reduce((n, s) => n + s.criteria.filter(c => this.draft.grades[c.id] == null).length, 0);
        },
        valid() {
            return !!this.tour && this.missing === 0 && this.draft.rehire !== null
                && (this.draft.rehire || !!this.draft.justification.trim());
        },
        title() {
            return { new: 'New Appraisal', edit: 'Edit Appraisal', view: 'Appraisal' }[this.mode];
        },
    },

    methods: {
        atlDate, fullNameLF,
        init(v) {
            this.mode = v.mode || 'new';
            const a = v.key ? appraisalFor(v.key) : null;
            this.draft = a && this.mode !== 'new'
                ? JSON.parse(JSON.stringify(a))
                : { key: v.key || null, grades: {}, comments: {}, rehire: null, justification: '', remarks: '',
                    appraiser: this.client ? this.client.alias + ' Crewing Department' : '', date: isoDate(TODAY) };
        },
        band: _apprBand,
        gradeLabel(n) { const g = gradeMeta(n); return g ? g.label : ''; },
        setGrade(cid, n) { if (!this.readonly) this.draft.grades[cid] = n; },
        months(t) { return Math.round(daysB(d(t.embark), d(t.signoff)) / 30.44); },
        openProfile() { if (this.seafarer) this.store.clientUi.profileId = this.seafarer.id; },
        save() {
            const t = this.tour;
            const rec = Object.assign({}, this.draft, {
                seafarerId: t.seafarerId, vesselId: t.vesselId, rank: t.rank, embark: t.embark, signoff: t.signoff,
                clientId: this.client ? this.client.id : null, date: isoDate(TODAY),
                justification: this.draft.rehire ? '' : this.draft.justification.trim(),
            });
            const i = this.store.appraisals.findIndex(a => a.key === rec.key);
            if (i >= 0) this.store.appraisals.splice(i, 1, rec); else this.store.appraisals.push(rec);
            this.store.clientUi.toast = 'Appraisal saved for ' + fullNameLF(this.seafarer);
            this.store.clientUi.appraisal = { key: rec.key, mode: 'view' };
        },
        edit()  { this.store.clientUi.appraisal = { key: this.draft.key, mode: 'edit' }; },
        print() { appraisalPdf(appraisalFor(this.draft.key)).save('Appraisal_' + (this.seafarer.lastName || 'seafarer').replace(/\W+/g, '_') + '.pdf'); },
    },
};

// ── Appraisals page ───────────────────────────────────────────
const ClientAppraisalsView = {
    template: '#tpl-client-appraisals',

    data() {
        return {
            store:        erpStore,
            period:       6,            // months back; 0 = all
            // '' | 'pending' | 'done' — ?status= lets the dashboard deep-link to the pending ones
            status:       ['pending', 'done'].includes(this.$route.query.status) ? this.$route.query.status : '',
            filterVessel: null,
            visible:      ['signOff', 'status', 'overall', 'rehire', 'appraisalDate'],
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
        tours() {
            return clientAppraisalTours(this.client, this.period)
                .filter(t => !this.filterVessel || t.vesselId === this.filterVessel);
        },
        pendingCount() { return this.tours.filter(t => !appraisalFor(appraisalKey(t))).length; },
        columns() {
            const avgCol = (key, title) => ({ key, title, format: v => v == null ? '—' : v.toFixed(1) });
            return [
                { key: 'fullName',  title: 'Full Name', fixed: true, type: 'link' },
                { key: 'rank',      title: 'Rank',      fixed: true },
                { key: 'vessel',    title: 'Vessel',    fixed: true },
                { key: 'signOn',    title: 'Sign-on',   format: v => atlDate(v) },
                { key: 'signOff',   title: 'Sign-off',  format: v => atlDate(v) },
                { key: 'duration',  title: 'Months' },
                { key: 'status',    title: 'Appraisal', type: 'chip', chip: r => r.statusChip },
                avgCol('overall', 'Overall (1-10)'),
                { key: 'rehire',    title: 'Rehire',    type: 'chip', chip: r => r.rehireChip },
                avgCol('performance', 'Performance'),
                avgCol('behaviour', 'Behaviour'),
                avgCol('knowledge', 'Knowledge'),
                avgCol('soft', 'Soft Skills'),
                { key: 'appraiser',     title: 'Appraised by' },
                { key: 'appraisalDate', title: 'Appraised on', format: v => v ? atlDate(v) : '—' },
                { key: 'nationality',   title: 'Nationality' },
            ];
        },
        rows() {
            return this.tours.map(t => {
                const key = appraisalKey(t);
                const a = appraisalFor(key);
                const s = seafarerById(t.seafarerId) || {};
                const avg = a ? appraisalAverages(a) : { sections: {}, overall: null };
                return {
                    _key: key, key, seafarerId: t.seafarerId, appraised: !!a,
                    fullName: fullNameLF(s), nationality: (s.nationality || '').toUpperCase(),
                    rank: t.rank.toUpperCase(), rank_sort: CREW_RANK_ORDER.indexOf(t.rank),
                    vessel: allVessels.find(v => v.id === t.vesselId).name.toUpperCase(),
                    signOn: t.embark, signOff: t.signoff,
                    duration: Math.round(daysB(d(t.embark), d(t.signoff)) / 30.44),
                    status: a ? 'Appraised' : 'To be appraised', status_sort: a ? 1 : 0,
                    statusChip: a ? { text: 'Appraised', color: 'success' } : { text: 'To be appraised', color: 'warning' },
                    overall: avg.overall,
                    performance: avg.sections.performance, behaviour: avg.sections.behaviour,
                    knowledge: avg.sections.knowledge, soft: avg.sections.soft,
                    rehire: a ? (a.rehire ? 'Yes' : 'No') : '—',
                    rehireChip: a ? (a.rehire ? { text: 'Rehire', color: 'success' } : { text: 'Do not rehire', color: 'error' }) : null,
                    appraiser: a ? a.appraiser : '—', appraisalDate: a ? a.date : null,
                };
            }).filter(r => !this.status || (this.status === 'pending' ? !r.appraised : r.appraised));
        },
        pdfSubtitle() {
            const parts = [this.client ? this.client.name : '',
                           this.period ? 'Signed off in the last ' + this.period + ' months' : 'All sign-offs'];
            if (this.filterVessel) parts.push('Vessel: ' + this.vesselItems.find(v => v.id === this.filterVessel).name);
            return parts.join('  ·  ');
        },
    },

    methods: {
        openProfile(row) { this.store.clientUi.profileId = row.seafarerId; },
        add(row)  { this.store.clientUi.appraisal = { key: row ? row.key : null, mode: 'new' }; },
        view(row) { this.store.clientUi.appraisal = { key: row.key, mode: 'view' }; },
        pdf(row)  { appraisalPdf(appraisalFor(row.key)).save('Appraisal_' + row.fullName.split(',')[0].replace(/\W+/g, '_') + '.pdf'); },
    },
};
