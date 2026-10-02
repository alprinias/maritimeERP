/* ── views/ClientRotation.js ──────────────────────────────────
   Client UI → Rotation Plan: read-only Gantt in the Atlantis style.
   Template in index.html: tpl-client-rotation · styles: .atl-gantt* / .atl-bar*

   One block per client vessel, one row per position (rank + "1/2" counter
   when a rank has several positions). Rows outside the safe manning are
   grey. Bars per row:
     past     — completed tours (grey hatched)
     running  — current service (blue) up to the planned sign-off
     rfs      — sign-off request ending at the sign-off date (maroon)
     rfx      — requested extension beyond the contract end (gold)
     rfp      — promotion request (orange) + diamond and dashed arrow to the
                position of the new rank
     search / approval / preparation / ready — the planned relief service
   Standalone RFEs get their own row. Hover shows an Atlantis hover card.
   Clicking a relief bar backed by an RFE opens the approval dialog; nothing
   opens for running / past services. On touch screens a tap shows the bar's
   card in a bottom sheet (with Review where relevant).

   Phones get a crew plan instead of the Gantt (phoneGroups): one card per
   position with the current holder, requests, next relief (Review button when
   awaiting approval) and previous tour; a tap shows all its bars in a sheet.

   Depends on globals: erpStore, allVessels, allClientsData, utils.js,
     crew.js, atlDate (ClientCommon.js)
   Exposes global: ClientRotationView
──────────────────────────────────────────────────────────────── */

const GANTT_ROW_H = 40;           // px — keep in sync with .atl-gantt__row

const GANTT_REQUEST_KINDS = ['rfs', 'rfx', 'rfp', 'search', 'approval', 'preparation', 'ready'];

// Atlantis stage wording for relief bars
const GANTT_STAGE_LABEL = {
    search:      'Search',
    approval:    'Principal Approval',
    preparation: 'Preparation',
    ready:       'Ready',
};

function _ganttAddDays(iso, n) { return isoDate(new Date(d(iso).getTime() + n * 86400000)); }

function _ganttServiceBar(kind, seafarerId, from, to, rank) {
    const s = seafarerById(seafarerId);
    return {
        kind, from, to,
        label: barLabel(s),
        tip: {
            title: fullNameLF(s) || '—',
            chip:  kind === 'past' ? 'Completed' : 'On Board',
            lines: [['Rank', rank.toUpperCase()],
                    ['Sign-on', atlDate(from)],
                    [kind === 'past' ? 'Sign-off' : 'Est. Sign-off', atlDate(to)]],
        },
    };
}

// Planned relief service: label is the request number until a candidate is approved
function _ganttReliefBar(relief, end) {
    const s = seafarerById(relief.seafarerId);
    const named = isApprovedStage(relief.stage) && (s || relief.name);
    const lines = [['Handover', atlDate(relief.date)], ['End of Service', atlDate(end)]];
    if (named) lines.unshift(['Seafarer', s ? fullNameLF(s) : relief.name]);
    if (relief.port) lines.push(['Port', relief.port]);
    return {
        kind: relief.stage, from: relief.date, to: end, ref: relief.ref,
        label: named ? (s ? barLabel(s) : relief.name) : relief.ref,
        tip: { title: relief.ref, chip: GANTT_STAGE_LABEL[relief.stage], lines },
    };
}

// Gantt rows of a vessel: positions in rank order, then standalone RFE rows
function clientGanttRows(vessel) {
    const rows = vessel.ranks.map(row => {
        const pos   = rankPos(vessel, row);
        const total = vessel.ranks.filter(r => r.rank === row.rank).length;
        const bars  = [];
        let promo   = null;

        crewPastAssignments
            .filter(a => a.vesselId === vessel.id && a.rank === row.rank && a.pos === pos)
            .forEach(a => bars.push(_ganttServiceBar('past', a.seafarerId, a.embark, a.signoff, row.rank)));

        if (row.onboard) {
            const ob  = row.onboard;
            const s   = seafarerById(ob.seafarerId);
            // A promoted seafarer leaves this position on the promotion date
            const promoDate = row.rfa && row.rfa.type === 'Promote' && row.rfa.newRank ? row.rfa.rfaEnd : null;
            const off = promoDate && promoDate < crewSignoffDate(row) ? promoDate : crewSignoffDate(row);
            bars.push(_ganttServiceBar('running', ob.seafarerId, ob.embark, off, row.rank));

            const prepLine = st => st === 'preparation' ? [['Status', 'On Preparation']] : [];
            if (row.rfs) {
                const from = [row.rfs.dateCreated, _ganttAddDays(off, -45)].sort()[1];
                bars.push({ kind: 'rfs', from, to: off, label: row.rfs.rfaNo, ref: row.rfs.rfaNo,
                    tip: { title: row.rfs.rfaNo, chip: 'Sign-off',
                           lines: [['Seafarer', fullNameLF(s)], ['Sign-off', atlDate(off)], ['Port', row.rfs.port], ...prepLine(row.rfs.status)] } });
            }
            if (row.rfa && row.rfa.type === 'Extend') {
                bars.push({ kind: 'rfx', from: ob.signoff, to: row.rfa.rfaEnd, label: row.rfa.rfaNo, ref: row.rfa.rfaNo,
                    tip: { title: row.rfa.rfaNo, chip: 'Extension',
                           lines: [['Seafarer', fullNameLF(s)], ['Contract end', atlDate(ob.signoff)], ['Extended to', atlDate(row.rfa.rfaEnd)], ...prepLine(row.rfa.status)] } });
            }
            if (row.rfa && row.rfa.type === 'Promote') {
                const date = row.rfa.rfaEnd;
                bars.push({ kind: 'rfp', from: _ganttAddDays(date, -45), to: date, label: row.rfa.rfaNo, ref: row.rfa.rfaNo,
                    tip: { title: row.rfa.rfaNo, chip: 'Promotion',
                           lines: [['Seafarer', fullNameLF(s)], ['To rank', (row.rfa.newRank || '—').toUpperCase()], ['Promotion date', atlDate(date)], ...prepLine(row.rfa.status)] } });
                if (row.rfa.newRank) promo = { date, toRank: row.rfa.newRank };
            }
            const relief = crewRelief(vessel, row);
            if (relief) {
                const legacy = !row.rfr_rfe && row.rfa && (!row.rfa.type || row.rfa.type === 'Replace');
                const end = legacy ? row.rfa.rfaEnd : isoDate(addM(d(relief.date), 6));
                bars.push(_ganttReliefBar(relief, end));
            }
        }
        return { key: vessel.id + '|' + row.rank + '|' + pos, rank: row.rank, pos, total,
                 safeManning: row.safeManning !== false, extra: false, bars, promo, rfsDate: row.rfs && row.rfs.signoffDate };
    });

    standaloneRfes(vessel).forEach(r => {
        rows.push({ key: vessel.id + '|' + r.ref, rank: r.rank, pos: null, total: 1,
                    safeManning: true, extra: true, bars: [_ganttReliefBar(r, r.end)], promo: null });
    });

    const order = rank => { const i = CREW_RANK_ORDER.indexOf(rank); return i < 0 ? 99 : i; };
    return rows.sort((a, b) => (order(a.rank) - order(b.rank)) || (a.extra - b.extra) || (a.pos - b.pos));
}

const ClientRotationView = {
    template: '#tpl-client-rotation',

    data() {
        return {
            store:        erpStore,
            todayStr:     isoDate(TODAY),
            filterVessel: this.$route.query.vessel || null,   // dashboard deep link
            filterRank:   null,
            rfType:       '',
            windowMonths: 12,
            fromStr:      this.defaultFrom(),
            tip:          null,          // { bar, x, y } — hover card (mouse)
            sheet:        null,          // { title, bars } — bottom sheet (touch / phone)
        };
    },

    watch: {
        'store.clientUi.clientId'() { this.filterVessel = null; this.filterRank = null; },
    },

    computed: {
        client() { return allClientsData.find(c => c.id === this.store.clientUi.clientId) || null; },
        clientVessels() {
            return this.client ? allVessels.filter(v => this.client.vesselIds.includes(v.id)) : [];
        },
        vesselItems() { return this.clientVessels.map(v => ({ id: v.id, name: v.name })); },
        rankItems() {
            const ranks = new Set();
            this.clientVessels.forEach(v => v.ranks.forEach(r => ranks.add(r.rank)));
            return CREW_RANK_ORDER.filter(r => ranks.has(r)).map(r => ({ value: r, title: r.toUpperCase() }));
        },
        rfTypes() {
            return [
                { id: '',            label: 'All' },
                { id: 'any',         label: 'Any RF' },
                { id: 'rfr',         label: 'RFR' },
                { id: 'rfs',         label: 'RFS',         swatch: 'rfs' },
                { id: 'rfp',         label: 'RFP',         swatch: 'rfp' },
                { id: 'rfx',         label: 'RFX',         swatch: 'rfx' },
                { id: 'search',      label: 'Search',      swatch: 'search',      group: 'RFE' },
                { id: 'approval',    label: 'Approval',    swatch: 'approval' },
                { id: 'preparation', label: 'Preparation', swatch: 'preparation' },
                { id: 'ready',       label: 'Ready',       swatch: 'ready' },
            ];
        },

        // ── Time axis ─────────────────────────────────────────
        start()     { return d(this.fromStr || this.defaultFrom()); },
        end()       { return addM(this.start, this.windowMonths); },
        totalDays() { return daysB(this.start, this.end); },
        months() {
            const out = [];
            let cur = new Date(Date.UTC(this.start.getUTCFullYear(), this.start.getUTCMonth(), 1));
            while (cur < this.end) {
                const next = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
                const from = cur < this.start ? this.start : cur;
                const to   = next > this.end ? this.end : next;
                const mon = ATL_MONTHS[cur.getUTCMonth()].toUpperCase();
                const yy  = " '" + String(cur.getUTCFullYear()).slice(2);
                const w   = this.$vuetify.display.width;
                // narrow screens (tablets): JUL '26, narrowest: JUL with the year on the first month and January
                const label = w >= 1280 ? mon + ' ' + cur.getUTCFullYear()
                            : w >= 1024 || (this.windowMonths <= 6) ? mon + yy
                            : (out.length === 0 || cur.getUTCMonth() === 0) ? mon + yy : mon;
                out.push({ key: cur.toISOString(), label,
                           left: this.pct(isoDate(from)), width: this.pct(isoDate(to)) - this.pct(isoDate(from)) });
                cur = next;
            }
            return out;
        },
        todayPct()   { return this.pct(this.todayStr); },
        horizonPct() { return this.pct(isoDate(addM(TODAY, 2))); },

        // ── Rows ──────────────────────────────────────────────
        groups() {
            return this.clientVessels
                .filter(v => !this.filterVessel || v.id === this.filterVessel)
                .map(v => {
                    const rows = clientGanttRows(v).filter(r =>
                        (!this.filterRank || r.rank === this.filterRank) && this.matchesType(r));
                    return { vessel: v, rows, promos: this.promoArrows(rows) };
                })
                .filter(g => g.rows.length);
        },

        // Phone crew plan: each row summarised as current holder / requests / relief / previous
        phoneGroups() {
            return this.groups.map(g => Object.assign({}, g, {
                rows: g.rows.map(r => {
                    const cur  = r.bars.find(b => b.kind === 'running') || null;
                    // most recent completed tour
                    const prev = r.bars.filter(b => b.kind === 'past').sort((a, b) => b.to.localeCompare(a.to))[0] || null;
                    return Object.assign({}, r, {
                        cur, prev,
                        requests: r.bars.filter(b => ['rfs', 'rfx', 'rfp'].includes(b.kind)),
                        relief:   r.bars.find(b => GANTT_STAGE_LABEL[b.kind]) || null,
                    });
                }),
            }));
        },
        sheetOpen: {
            get() { return !!this.sheet; },
            set(v) { if (!v) this.sheet = null; },
        },
    },

    methods: {
        atlDate,
        defaultFrom() {
            const t = addM(TODAY, -3);
            return isoDate(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1)));
        },
        resetFrom() { this.fromStr = this.defaultFrom(); },
        resetAll()  { this.filterVessel = null; this.filterRank = null; this.rfType = ''; this.windowMonths = 12; this.resetFrom(); },

        pct(iso) {
            const p = daysB(this.start, d(iso)) / this.totalDays * 100;
            return Math.max(0, Math.min(100, p));
        },
        inWindow(bar) { return bar.to > isoDate(this.start) && bar.from < isoDate(this.end); },
        barStyle(bar) {
            const l = this.pct(bar.from), r = this.pct(bar.to);
            return { left: l + '%', width: Math.max(r - l, 0.25) + '%' };
        },
        // x position across the full row (rank column + timeline)
        lineLeft(p) { return 'calc(var(--atl-rank-col) + (100% - var(--atl-rank-col)) * ' + (p / 100) + ')'; },

        matchesType(row) {
            const t = this.rfType;
            if (!t) return true;
            const kinds = row.bars.map(b => b.kind);
            if (t === 'any') return kinds.some(k => GANTT_REQUEST_KINDS.includes(k));
            if (t === 'rfr') return !row.extra && kinds.some(k => GANTT_STAGE_LABEL[k]);
            return kinds.includes(t);
        },

        // Promotion arrows between rows of one vessel block (indexes in the shown rows)
        promoArrows(rows) {
            const out = [];
            rows.forEach((r, i) => {
                if (!r.promo) return;
                const targets = rows.map((x, j) => ({ x, j })).filter(o => o.x.rank === r.promo.toRank && !o.x.extra);
                const t = targets.find(o => o.x.rfsDate === r.promo.date) || targets[0];
                if (!t) return;
                const p = this.pct(r.promo.date);
                if (p <= 0 || p >= 100) return;
                const up = t.j < i;
                out.push({
                    key: r.key, up, p,
                    top:    (Math.min(i, t.j) * GANTT_ROW_H + GANTT_ROW_H / 2) + 'px',
                    height: (Math.abs(i - t.j) * GANTT_ROW_H) + 'px',
                    diamondTop: (i * GANTT_ROW_H + GANTT_ROW_H / 2) + 'px',
                });
            });
            return out;
        },

        // What a click on a bar opens: 'prep' — preparation checklist (green relief bars and
        // RFS / RFX / RFP bars of requests On Preparation); 'approval' — approval dialog
        // (other relief bars backed by an RFE, as in Atlantis); null — nothing
        barTarget(bar) {
            if (!bar.ref) return null;
            if (findPrepItem(bar.ref)) return 'prep';
            if (GANTT_STAGE_LABEL[bar.kind] && findApprovalItem(bar.ref)) return 'approval';
            return null;
        },
        canOpen(bar) { return !!this.barTarget(bar); },
        openLabel(bar) {
            const t = this.barTarget(bar);
            if (t === 'prep') return 'Preparation checklist';
            return bar.kind === 'approval' ? 'Review candidates' : 'Request details';
        },
        openBar(bar) {
            const target = this.barTarget(bar);
            if (!target) return;
            this.tip = null;
            this.sheet = null;
            if (target === 'prep') this.store.clientUi.prepRef = bar.ref;
            else this.store.clientUi.approvalRef = bar.ref;
        },
        // Touch screens can't hover: a tap shows the bar's card in a bottom sheet
        onBarClick(bar, row, vessel) {
            if (this.isTouch) this.sheet = { title: row.rank.toUpperCase() + ' · ' + vessel.name.toUpperCase(), bars: [bar] };
            else this.openBar(bar);
        },
        // Phone crew plan: a tap on a position shows all its bars, newest first
        openRowSheet(row, vessel) {
            this.sheet = { title: row.rank.toUpperCase() + ' · ' + vessel.name.toUpperCase(),
                           bars: row.bars.slice().sort((a, b) => b.from.localeCompare(a.from)) };
        },
        daysText(iso) {
            const n = daysB(d(this.todayStr), d(iso));
            return n < 0 ? Math.abs(n) + ' d overdue' : n + ' d left';
        },

        // ── Hover card ────────────────────────────────────────
        showTip(e, bar) { if (!this.isTouch) this.tip = { bar, x: e.clientX, y: e.clientY }; },
        moveTip(e)      { if (this.tip) { this.tip.x = e.clientX; this.tip.y = e.clientY; } },
        hideTip()       { this.tip = null; },
        tipStyle() {
            const w = 320, x = this.tip.x + 16 + w > window.innerWidth ? this.tip.x - w - 16 : this.tip.x + 16;
            const y = this.tip.y + 160 > window.innerHeight ? this.tip.y - 150 : this.tip.y + 16;
            return { left: x + 'px', top: y + 'px', width: w + 'px' };
        },
    },
};
