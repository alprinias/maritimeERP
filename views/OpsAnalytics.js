/* ── views/OpsAnalytics.js ────────────────────────────────────
   Operations → RFE Analytics (internal ERP, Atlantis look, Apache ECharts).
   Template in index.html: tpl-ops-analytics · styles: .atl-an* in client-portal.css

   How long Requests For Embarkation take from stage to stage, for the
   Operations department (own performance) and management (the department).
   - Filters (one row, scope everything): period, client, vessel type, rank,
     seafarer pool, user, user group · statistic median (default) / average ·
     compare by · targets
   - KPI tiles · start-to-embarkation bars per group (7 steps stacked, ordinal blue ramp,
     target marker, table view) · spread per step (box plot) · monthly trend per
     step (small multiples) · rework (loops back to search) · in-flight RFEs
   Steps are measured on the final pass (data/analytics.js rfeStepDurations).

   Depends on globals: echarts, erpStore, allVessels, allClientsData, utils.js,
     analytics.js, preparation.js, RFAs.js (ensureRfaRows), ClientCommon.js (atlDate)
   Exposes globals: EChart (component <e-chart>), OpsAnalyticsView
──────────────────────────────────────────────────────────────── */

const AN_FONT = "'Inter', 'Roboto', sans-serif";
const AN_INK = { primary: '#212121', secondary: '#616161', muted: '#9e9e9e', grid: '#eeeeee', axis: '#bdbdbd' };
const AN_LOW_SAMPLE = 5;      // groups with fewer RFEs are greyed out

// ── <e-chart :option :height> — thin ECharts wrapper ─────────
const EChart = {
    props: { option: { type: Object, required: true }, height: { type: [Number, String], default: 300 } },
    emits: ['bar-click'],
    template: '<div class="atl-echart" :style="{ height: typeof height === \'number\' ? height + \'px\' : height }"></div>',
    mounted() {
        this.chart = echarts.init(this.$el, null, { renderer: 'svg' });
        this.chart.setOption(this.option, true);
        this.chart.on('click', p => this.$emit('bar-click', p));
        this.ro = new ResizeObserver(() => this.chart && this.chart.resize());
        this.ro.observe(this.$el);
    },
    watch: {
        option: { deep: true, handler(o) { if (this.chart) this.chart.setOption(o, true); } },
        height() { this.$nextTick(() => this.chart && this.chart.resize()); },
    },
    beforeUnmount() { if (this.ro) this.ro.disconnect(); if (this.chart) this.chart.dispose(); },
};

// Atlantis search / approval stripes (Gantt: repeating-linear-gradient(135deg,
// #DCE8F7 0 7px, #A9C5EA 7px 9px)) as a seamless 13 × 13 tile for ECharts pattern fills
let _anHatchTile = null;
function _anHatch() {
    if (!_anHatchTile) {
        const c = document.createElement('canvas'); c.width = c.height = 13;
        const x = c.getContext('2d');
        x.fillStyle = '#DCE8F7'; x.fillRect(0, 0, 13, 13);
        x.strokeStyle = '#A9C5EA'; x.lineWidth = 2.6;
        [-13, 0, 13].forEach(k => { x.beginPath(); x.moveTo(k, 13); x.lineTo(k + 13, 0); x.stroke(); });
        _anHatchTile = c;
    }
    return { image: _anHatchTile, repeat: 'repeat' };
}
const AN_APPROVAL_STRIP = '#7E57C2';
// Refusals & rejections: refusals in Atlantis blue, rejections in the approval purple
const AN_DEC = { refused: '#1565C0', rejected: '#7E57C2', noAnswer: '#757575' };
const AN_BAR = 22;   // bar thickness (px)

// ── Statistics ────────────────────────────────────────────────
function _anQuantile(sorted, q) {
    if (!sorted.length) return null;
    const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
function _anStat(values, kind) {
    if (!values.length) return null;
    if (kind === 'average') return values.reduce((a, b) => a + b, 0) / values.length;
    return _anQuantile(values.slice().sort((a, b) => a - b), 0.5);
}
function _anEsc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const _anFmt = v => v == null ? '—' : (Math.round(v * 10) / 10).toFixed(1);

// Stage → the step that starts there (an RFE "in" a stage is waiting for that step)
const AN_STEP_OF_STAGE = { created: 's1', search: 's2', ask: 's3', accepted: 's4', approval: 's5', preparation: 's6', ready: 's7' };

// Current stage of a live RFE row of erpStore.rfaRows
function _anLiveStage(row, kind) {
    if (row.rfeStatus === 'OnPreparation') return prepIsComplete(row, 'rfe') ? 'ready' : 'preparation';
    const c = (kind === 'rfr' ? row.rfeCandidates : row.candidates) || [];
    if (c.some(x => x.acceptance === 'onApproval' && !x.approvalChoice)) return 'approval';
    if (c.some(x => x.acceptance === 'accepted')) return 'accepted';
    if (c.some(x => x.acceptance === 'pending')) return 'ask';
    return 'search';
}

const OpsAnalyticsView = {
    template: '#tpl-ops-analytics',

    data() {
        return {
            store:       erpStore,
            period:      12,          // months (by embarkation date)
            stat:        'median',    // 'median' | 'average'
            compareBy:   'client',
            f: { client: null, vesselType: null, rank: null, pool: null, user: null, group: null },
            leadView:    'chart',     // 'chart' | 'table'
            targetsOpen: false,
            draftTargets: null,
            leadVisible: ['n', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 'total'],
            flightVisible: ['client', 'vessel', 'user', 'stage', 'days', 'target', 'status'],
            tab:         'time',      // 'time' | 'decisions'
            decSide:     'refusal',   // by-group table: 'refusal' | 'rejection'
            selReason:   null,        // { kind: 'refused' | 'rejected' | 'noAnswer', id } — filters the cases table
            casesVisible: ['kindText', 'reasonText', 'pool', 'rank', 'client', 'vessel', 'user'],
        };
    },

    created() { ensureRfaRows(); },

    computed: {
        steps() { return RFE_STEPS; },
        statLabel() { return this.stat === 'median' ? 'Median' : 'Average'; },
        targets() { return this.store.rfeTargets; },
        targetTotal() { return RFE_STEPS.reduce((n, s) => n + (+this.targets[s.id] || 0), 0); },

        // ── Filter options ────────────────────────────────────
        options() {
            const uniq = a => [...new Set(a)].sort();
            return {
                client:     allClientsData.map(c => ({ value: c.id, title: c.name })),
                vesselType: uniq(rfeHistory.map(r => r.vesselType)),
                rank:       CREW_RANK_ORDER.filter(r => rfeHistory.some(x => x.rank === r)).map(r => ({ value: r, title: r.toUpperCase() })),
                pool:       RFE_POOLS.map(p => ({ value: p.id, title: p.label })),
                user:       OPS_USERS.map(u => ({ value: u.id, title: u.name })),
                group:      OPS_GROUPS.map(g => ({ value: g.id, title: g.name })),
            };
        },
        compareItems() {
            return [
                { value: 'all',        title: 'All RFEs (no grouping)' },
                { value: 'client',     title: 'Principal' },
                { value: 'rank',       title: 'Rank' },
                { value: 'vesselType', title: 'Vessel type' },
                { value: 'pool',       title: 'Seafarer pool' },
                { value: 'user',       title: 'User' },
                { value: 'group',      title: 'User group' },
            ];
        },

        // ── Completed RFEs in scope ───────────────────────────
        completed() {
            const from = TODAY.getTime() - this.period * 30.44 * 86400000;
            const F = this.f;
            return rfeHistory
                .map(r => Object.assign({ d: rfeStepDurations(r.events), embarkedAt: r.events[r.events.length - 1].at }, r))
                .filter(r => r.d && r.embarkedAt >= from
                    && (!F.client || r.clientId === F.client) && (!F.vesselType || r.vesselType === F.vesselType)
                    && (!F.rank || r.rank === F.rank) && (!F.pool || r.pool === F.pool)
                    && (!F.user || r.userId === F.user) && (!F.group || r.groupId === F.group));
        },

        // Group key + label of an RFE for the chosen comparison
        groupsOf() { return this.groupBy(this.completed, 'All RFEs'); },

        // Per group: stat per step, stat of total, n — sorted slowest first
        groupStats() {
            return this.groupsOf.map(g => {
                const steps = {};
                RFE_STEPS.forEach(s => { steps[s.id] = _anStat(g.items.map(r => r.d.steps[s.id]), this.stat); });
                const totals = g.items.map(r => r.d.total);
                return {
                    key: g.key, label: g.label, n: g.items.length, low: g.items.length < AN_LOW_SAMPLE, steps,
                    sumSteps: RFE_STEPS.reduce((a, s) => a + (steps[s.id] || 0), 0),
                    total: _anStat(totals, this.stat),
                    withinTarget: totals.filter(t => t <= this.targetTotal).length / (totals.length || 1),
                    loops: g.items.filter(r => r.d.loops > 0),
                };
            }).sort((a, b) => b.sumSteps - a.sumSteps);
        },

        // ── KPI tiles ─────────────────────────────────────────
        kpis() {
            const all = this.completed;
            const steps = RFE_STEPS.map(s => ({ s, v: _anStat(all.map(r => r.d.steps[s.id]), this.stat) }));
            const slowest = steps.slice().sort((a, b) => b.v - a.v)[0];
            const over = steps.map(x => Object.assign({ ratio: x.v / (this.targets[x.s.id] || 1) }, x)).sort((a, b) => b.ratio - a.ratio)[0];
            const totals = all.map(r => r.d.total);
            const within = totals.filter(t => t <= this.targetTotal).length / (totals.length || 1);
            const loops = all.filter(r => r.d.loops > 0);
            return [
                { id: 'lead', label: this.statLabel + ' start to embarkation time', icon: 'mdi-timer-outline',
                  value: _anFmt(_anStat(totals, this.stat)) + ' d', sub: 'Created → Embarked · ' + all.length + ' RFEs' },
                { id: 'within', label: 'Within target', icon: 'mdi-target',
                  value: Math.round(within * 100) + '%', sub: 'Start to embarkation ≤ ' + this.targetTotal + ' d (sum of step targets)',
                  status: within >= 0.8 ? { text: 'On track', icon: 'mdi-check-circle-outline', color: 'success' }
                        : within >= 0.6 ? { text: 'Watch', icon: 'mdi-alert-outline', color: 'warning' }
                        : { text: 'Below 60%', icon: 'mdi-alert-circle-outline', color: 'error' } },
                { id: 'done', label: 'Completed RFEs', icon: 'mdi-ferry', value: String(all.length),
                  sub: 'Embarked in the last ' + this.period + ' months' },
                { id: 'slowest', label: 'Slowest step', icon: 'mdi-snail',
                  value: slowest ? _anFmt(slowest.v) + ' d' : '—', sub: slowest ? slowest.s.label : '' },
                { id: 'over', label: 'Most over target', icon: 'mdi-flag-outline',
                  value: over ? Math.round(over.ratio * 100) + '%' : '—',
                  sub: over ? over.s.label + ' · ' + _anFmt(over.v) + ' of ' + this.targets[over.s.id] + ' d' : '',
                  status: over && over.ratio > 1 ? { text: 'Over target', icon: 'mdi-alert-circle-outline', color: 'error' }
                                                 : { text: 'All within', icon: 'mdi-check-circle-outline', color: 'success' } },
                { id: 'rework', label: 'Rework rate', icon: 'mdi-backup-restore',
                  value: Math.round(loops.length / (all.length || 1) * 100) + '%',
                  sub: loops.length + ' RFEs back to search · ' + _anFmt(_anStat(loops.map(r => r.d.rework), this.stat)) + ' d lost each' },
            ];
        },

        // ── Chart 1: start-to-embarkation bars per group ─────────────────
        leadHeight() { return Math.max(160, this.groupStats.length * 44 + 110); },
        leadOption() {
            const G = this.groupStats;
            const maxTotal = Math.max(this.targetTotal, ...G.map(g => g.sumSteps));
            const labelMin = maxTotal * 0.065;          // a segment label must fit inside its segment
            const statLabel = this.statLabel;
            const series = RFE_STEPS.map((s, i) => ({
                name: s.short, type: 'bar', stack: 'lead', barWidth: AN_BAR,
                itemStyle: { color: s.hatch ? _anHatch() : s.color, borderColor: '#ffffff', borderWidth: 1,
                             borderRadius: i === RFE_STEPS.length - 1 ? [0, 4, 4, 0] : 0 },
                emphasis: { focus: 'none', itemStyle: { opacity: 0.85 } },
                label: { show: true, position: 'inside', color: s.ink, fontSize: 11, fontFamily: AN_FONT,
                         formatter: p => (p.value >= labelMin ? _anFmt(p.value) : '') },
                data: G.map(g => ({ value: g.steps[s.id] || 0, itemStyle: g.low ? { opacity: 0.35 } : undefined })),
                markLine: i === 0 ? {
                    silent: true, symbol: 'none',
                    lineStyle: { color: AN_INK.secondary, type: 'dashed', width: 1 },
                    label: { formatter: 'Target ' + this.targetTotal + ' d', color: AN_INK.secondary, fontFamily: AN_FONT, fontSize: 11, position: 'end' },
                    data: [{ xAxis: this.targetTotal }],
                } : undefined,
            }));
            // total at the bar tip (zero-width stacked bar carrying the label)
            series.push({
                name: '_total', type: 'bar', stack: 'lead', barWidth: AN_BAR, itemStyle: { color: 'transparent' },
                tooltip: { show: false }, legendHoverLink: false, silent: true,
                label: { show: true, position: 'right', color: AN_INK.primary, fontFamily: AN_FONT, fontSize: 12, fontWeight: 600,
                         formatter: p => _anFmt(G[p.dataIndex].sumSteps) + ' d' + (G[p.dataIndex].low ? '  · low sample' : '') },
                data: G.map(() => 0.0001),
            });
            // purple bottom strip of the approval segment (as on the Atlantis Gantt)
            const before = g => RFE_STEPS.slice(0, 4).reduce((a, s) => a + (g.steps[s.id] || 0), 0);
            series.push({
                name: '_approvalStrip', type: 'custom', silent: true, tooltip: { show: false }, z: 5,
                encode: { x: [0, 1], y: 2 },
                data: G.map((g, i) => [before(g), before(g) + (g.steps.s5 || 0), i]),
                renderItem: (params, api) => {
                    const a = api.coord([api.value(0), api.value(2)]), b = api.coord([api.value(1), api.value(2)]);
                    const w = b[0] - a[0] - 1;
                    if (w <= 0) return null;
                    return { type: 'rect', shape: { x: a[0] + 0.5, y: a[1] + AN_BAR / 2 - 5.5, width: w, height: 5 },
                             style: { fill: AN_APPROVAL_STRIP, opacity: G[params.dataIndex].low ? 0.35 : 1 } };
                },
            });
            return {
                textStyle: { fontFamily: AN_FONT },
                grid: { top: 14, left: 24, right: 110, bottom: 28, containLabel: true },
                xAxis: { type: 'value', name: 'days', nameLocation: 'end', nameTextStyle: { color: AN_INK.muted },
                         max: v => Math.ceil(Math.max(v.max, this.targetTotal) * 1.05),
                         axisLabel: { color: AN_INK.muted }, splitLine: { lineStyle: { color: AN_INK.grid } },
                         axisLine: { show: true, lineStyle: { color: AN_INK.axis } } },
                yAxis: { type: 'category', inverse: true, data: G.map(g => g.label + '  (n=' + g.n + ')'),
                         axisTick: { show: false }, axisLine: { lineStyle: { color: AN_INK.axis } },
                         axisLabel: { color: AN_INK.primary, fontSize: 12,
                                      formatter: (v, i) => (G[i] && G[i].low ? '{low|' + v + '}' : v),
                                      rich: { low: { color: AN_INK.muted } } } },
                tooltip: {
                    trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#fff', borderColor: '#e0e0e0',
                    textStyle: { color: AN_INK.primary, fontFamily: AN_FONT, fontSize: 12 },
                    formatter: ps => {
                        const g = G[ps[0].dataIndex];
                        const rows = RFE_STEPS.map(s => '<div style="display:flex;align-items:center;gap:8px">'
                            + '<span class="atl-an__swatch ' + (s.cls || '') + '" style="' + (s.cls ? '' : 'background:' + s.color) + '"></span>'
                            + '<b style="min-width:42px;text-align:right">' + _anFmt(g.steps[s.id]) + ' d</b>'
                            + '<span style="color:' + AN_INK.secondary + '">' + _anEsc(s.label) + '</span></div>').join('');
                        return '<div style="font-weight:600;margin-bottom:4px">' + _anEsc(g.label) + ' · ' + g.n + ' RFEs'
                            + (g.low ? ' · low sample' : '') + '</div>' + rows
                            + '<div style="margin-top:6px;border-top:1px solid #eee;padding-top:4px">Sum of step ' + statLabel.toLowerCase() + 's <b>'
                            + _anFmt(g.sumSteps) + ' d</b><br>' + statLabel + ' start to embarkation time <b>' + _anFmt(g.total) + ' d</b> · within target <b>'
                            + Math.round(g.withinTarget * 100) + '%</b></div>';
                    },
                },
                series,
            };
        },
        leadColumns() {
            return [
                { key: 'label', title: this.compareItems.find(c => c.value === this.compareBy).title, fixed: true },
                { key: 'n', title: 'RFEs' },
                ...RFE_STEPS.map(s => ({ key: s.id, title: s.short + ' (d)', format: v => _anFmt(v) })),
                { key: 'total', title: this.statLabel + ' start to embarkation (d)', format: v => _anFmt(v) },
                { key: 'within', title: 'Within target', format: v => Math.round(v * 100) + '%' },
                { key: 'rework', title: 'Rework rate', format: v => Math.round(v * 100) + '%' },
            ];
        },
        leadRows() {
            return this.groupStats.map(g => Object.assign({ _key: g.key, label: g.label + (g.low ? ' (low sample)' : ''), n: g.n,
                total: g.total, within: g.withinTarget, rework: g.loops.length / (g.n || 1) }, g.steps));
        },

        // ── Chart 2: spread per step (box plot) ───────────────
        boxOption() {
            const all = this.completed;
            // Box = quartiles (so its middle line is always the median); whiskers = the
            // lowest / highest values within 1.5 × box length of the box; beyond = outliers.
            // Average mode adds the average as a marker.
            const BOX = 'Middle 50% · usual range', avgMode = this.stat === 'average';
            const boxes = [], outliers = [], means = [];
            RFE_STEPS.forEach((s, i) => {
                const v = all.map(r => r.d.steps[s.id]).sort((a, b) => a - b);
                means.push(_anStat(v, 'average'));
                const q1 = _anQuantile(v, 0.25), q2 = _anQuantile(v, 0.5), q3 = _anQuantile(v, 0.75);
                const lo = q1 - 1.5 * (q3 - q1), hi = q3 + 1.5 * (q3 - q1);
                const inside = v.filter(x => x >= lo && x <= hi);
                boxes.push({ value: [inside[0] || q1, q1, q2, q3, inside[inside.length - 1] || q3],
                             itemStyle: { color: s.color + '55', borderColor: s.line || s.color, borderWidth: 1.5 } });
                v.filter(x => x < lo || x > hi).forEach(x => outliers.push([Math.round(x * 10) / 10, i]));
            });
            return {
                textStyle: { fontFamily: AN_FONT },
                legend: { top: 0, left: 0, itemGap: 18, textStyle: { color: AN_INK.secondary, fontSize: 12 },
                          data: [BOX, ...(avgMode ? ['Average'] : []), 'Outlier', 'Target'] },
                grid: { top: 36, left: 8, right: 24, bottom: 28, containLabel: true },
                xAxis: { type: 'value', name: 'days', nameTextStyle: { color: AN_INK.muted }, axisLabel: { color: AN_INK.muted },
                         splitLine: { lineStyle: { color: AN_INK.grid } }, axisLine: { show: true, lineStyle: { color: AN_INK.axis } } },
                yAxis: { type: 'category', inverse: true, data: RFE_STEPS.map(s => s.short), axisTick: { show: false },
                         axisLabel: { color: AN_INK.primary }, axisLine: { lineStyle: { color: AN_INK.axis } } },
                tooltip: { trigger: 'item', backgroundColor: '#fff', borderColor: '#e0e0e0', textStyle: { color: AN_INK.primary, fontFamily: AN_FONT, fontSize: 12 },
                    formatter: p => {
                        const s = RFE_STEPS[p.dataIndex] || RFE_STEPS[p.value[1]];
                        if (p.seriesName === BOX) {
                            const [mn, a, m, b, mx] = p.value.slice(-5);
                            return '<b>' + _anEsc(s.label) + '</b><br>Median <b>' + _anFmt(m) + ' d</b> · average <b>' + _anFmt(means[p.dataIndex]) + ' d</b>'
                                + '<br>Middle 50% of RFEs ' + _anFmt(a) + '–' + _anFmt(b) + ' d'
                                + '<br>Usual range (whiskers) ' + _anFmt(mn) + '–' + _anFmt(mx) + ' d<br>Target ' + this.targets[s.id] + ' d';
                        }
                        if (p.seriesName === 'Average') return '<b>' + _anEsc(RFE_STEPS[p.value[1]].label) + '</b><br>Average <b>' + _anFmt(p.value[0]) + ' d</b>';
                        if (p.seriesName === 'Target') return '<b>' + _anEsc(RFE_STEPS[p.value[1]].label) + '</b><br>Target <b>' + p.value[0] + ' d</b>';
                        return '<b>' + _anEsc(RFE_STEPS[p.value[1]].label) + '</b><br>Outlier <b>' + _anFmt(p.value[0]) + ' d</b>';
                    } },
                series: [
                    { name: BOX, type: 'boxplot', boxWidth: [10, 22], data: boxes,
                      itemStyle: { color: '#A9C5EA55', borderColor: '#4F7DBF' } },
                    ...(avgMode ? [{ name: 'Average', type: 'scatter', symbol: 'circle', symbolSize: 11, z: 4,
                      data: means.map((m, i) => [Math.round(m * 10) / 10, i]),
                      itemStyle: { color: '#ffffff', borderColor: '#E07A35', borderWidth: 2.5 } }] : []),
                    { name: 'Outlier', type: 'scatter', symbolSize: 8, data: outliers,
                      itemStyle: { color: '#9e9e9e', borderColor: '#fff', borderWidth: 2 } },
                    { name: 'Target', type: 'scatter', symbol: 'diamond', symbolSize: 13, z: 5,
                      data: RFE_STEPS.map((s, i) => [+this.targets[s.id], i]),
                      itemStyle: { color: AN_INK.primary, borderColor: '#fff', borderWidth: 2 } },
                ],
            };
        },

        // ── Chart 3: monthly trend per step (small multiples) ─
        months() {
            const out = [];
            const d0 = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth(), 1));
            for (let i = this.period - 1; i >= 0; i--) {
                const m = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() - i, 1));
                out.push({ key: m.getUTCFullYear() + '-' + m.getUTCMonth(), label: ATL_MONTHS[m.getUTCMonth()] + " '" + String(m.getUTCFullYear()).slice(2) });
            }
            return out;
        },
        trendOptions() {
            const byMonth = {};
            this.completed.forEach(r => {
                const dt = new Date(r.embarkedAt);
                const k = dt.getUTCFullYear() + '-' + dt.getUTCMonth();
                (byMonth[k] = byMonth[k] || []).push(r);
            });
            return RFE_STEPS.map(s => {
                const data = this.months.map(m => {
                    const v = (byMonth[m.key] || []).map(r => r.d.steps[s.id]);
                    return v.length ? Math.round(_anStat(v, this.stat) * 10) / 10 : null;
                });
                const last = data.map((v, i) => [v, i]).filter(x => x[0] != null).pop();
                return { step: s, option: {
                    textStyle: { fontFamily: AN_FONT },
                    grid: { top: 14, left: 4, right: 34, bottom: 4, containLabel: true },
                    xAxis: { type: 'category', data: this.months.map(m => m.label), boundaryGap: false,
                             axisLabel: { color: AN_INK.muted, fontSize: 10, interval: Math.ceil(this.months.length / 4) - 1 },
                             axisTick: { show: false }, axisLine: { lineStyle: { color: AN_INK.axis } } },
                    yAxis: { type: 'value', min: 0, splitNumber: 3, axisLabel: { color: AN_INK.muted, fontSize: 10 },
                             splitLine: { lineStyle: { color: AN_INK.grid } } },
                    tooltip: { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: AN_INK.axis } },
                               backgroundColor: '#fff', borderColor: '#e0e0e0', textStyle: { color: AN_INK.primary, fontFamily: AN_FONT, fontSize: 12 },
                               formatter: ps => '<b>' + (ps[0].value == null ? '—' : _anFmt(ps[0].value) + ' d') + '</b> · ' + _anEsc(ps[0].name)
                                   + '<br><span style="color:' + AN_INK.secondary + '">' + this.statLabel + ' · target ' + this.targets[s.id] + ' d</span>' },
                    series: [{
                        type: 'line', data, connectNulls: true, showSymbol: false, symbolSize: 8,
                        lineStyle: { width: 2, color: s.line || s.color }, itemStyle: { color: s.line || s.color, borderColor: '#fff', borderWidth: 2 },
                        endLabel: { show: !!last, color: AN_INK.primary, fontSize: 11, formatter: p => _anFmt(p.value) },
                        markLine: { silent: true, symbol: 'none', lineStyle: { color: AN_INK.secondary, type: 'dashed', width: 1 },
                                    label: { show: false }, data: [{ yAxis: +this.targets[s.id] }] },
                    }],
                } };
            });
        },

        // ── Rework per group ──────────────────────────────────
        reworkRows() {
            return this.groupStats.map(g => ({
                key: g.key, label: g.label, n: g.n, loops: g.loops.length,
                rate: g.loops.length / (g.n || 1),
                lost: _anStat(g.loops.map(r => r.d.rework), this.stat),
            })).sort((a, b) => b.rate - a.rate);
        },

        // ── In-flight RFEs (live rows of the RFAs view) ───────
        flightRows() {
            const R = this.store.rfaRows;
            if (!R) return [];
            const live = [
                ...R.replacement.map(r => ({ row: r, kind: 'rfr', ref: r.rfeNo })),
                ...R.embarkation.map(r => ({ row: r, kind: 'rfe', ref: r.rfaNo })),
            ];
            const median = {};
            RFE_STEPS.forEach(s => { median[s.id] = _anStat(rfeHistory.map(r => rfeStepDurations(r.events)).filter(Boolean).map(d => d.steps[s.id]), 'median'); });
            const F = this.f;
            return live.map(x => {
                const v = allVessels.find(vs => vs.id === x.row.vesselId);
                const client = allClientsData.find(c => c.vesselIds.includes(x.row.vesselId));
                const user = opsUserForClient(client.id, x.ref);
                const stage = _anLiveStage(x.row, x.kind);
                const step = AN_STEP_OF_STAGE[stage];
                const days = this.daysInStage(x.ref, stage);
                const target = +this.targets[step];
                const status = days > target ? { text: 'Over target', icon: 'mdi-alert-circle-outline', color: 'error' }
                             : days > median[step] * 1.5 ? { text: 'Slower than usual', icon: 'mdi-alert-outline', color: 'warning' }
                             : { text: 'On track', icon: 'mdi-check-circle-outline', color: 'success' };
                return {
                    _key: x.ref, ref: x.ref, client: client.name, clientId: client.id, vessel: v.name.toUpperCase(), vesselType: v.type,
                    rank: x.row.rank.toUpperCase(), rankRaw: x.row.rank, user: user.name, userId: user.id,
                    group: OPS_GROUPS.find(g => g.id === user.groupId).name, groupId: user.groupId,
                    stage: RFE_STAGES.find(s => s.id === stage).label, stage_sort: RFE_STAGES.findIndex(s => s.id === stage),
                    days, target, typical: Math.round(median[step] * 10) / 10,
                    statusChip: status, status: status.text, status_sort: status.color === 'error' ? 0 : status.color === 'warning' ? 1 : 2,
                };
            }).filter(r => (!F.client || r.clientId === F.client) && (!F.vesselType || r.vesselType === F.vesselType)
                        && (!F.rank || r.rankRaw === F.rank) && (!F.user || r.userId === F.user) && (!F.group || r.groupId === F.group))
              .sort((a, b) => a.status_sort - b.status_sort || b.days - a.days);
        },
        flightColumns() {
            return [
                { key: 'ref',    title: 'Request', fixed: true },
                { key: 'rank',   title: 'Rank',    fixed: true },
                { key: 'client', title: 'Principal' },
                { key: 'vessel', title: 'Vessel' },
                { key: 'user',   title: 'User' },
                { key: 'group',  title: 'Group' },
                { key: 'stage',  title: 'Current stage' },
                { key: 'days',   title: 'Days in stage' },
                { key: 'target', title: 'Target (d)' },
                { key: 'typical', title: 'Typical (median d)' },
                { key: 'status', title: 'Status', type: 'chip', chip: r => r.statusChip },
            ];
        },

        /* ══ Refusals & rejections tab ══════════════════════════
           One record per candidate decision: history (rfeHistory[].cands) + live
           rows of the RFAs view. Period = decision date ("Decided in"); the pool
           filter / grouping uses the candidate's own pool. */
        decisions() {
            const from = TODAY.getTime() - this.period * 30.44 * 86400000;
            const F = this.f;
            const out = [];
            rfeHistory.forEach(r => r.cands.forEach(c => out.push({
                ref: r.ref, clientId: r.clientId, vesselId: r.vesselId, vesselType: r.vesselType, rank: r.rank,
                userId: r.userId, groupId: r.groupId, name: c.name, pool: c.pool, outcome: c.outcome,
                reason: c.reason, note: '', at: c.at, live: false,
            })));
            const R = this.store.rfaRows;
            if (R) {
                [...R.replacement.map(r => ({ row: r, ref: r.rfeNo, cands: r.rfeCandidates || [] })),
                 ...R.embarkation.map(r => ({ row: r, ref: r.rfaNo, cands: r.candidates || [] }))].forEach(x => {
                    const v = allVessels.find(vs => vs.id === x.row.vesselId);
                    const client = allClientsData.find(c => c.vesselIds.includes(x.row.vesselId));
                    const user = opsUserForClient(client.id, x.ref);
                    x.cands.forEach(c => {
                        let outcome = null, reason = null, note = '';
                        if (c.acceptance === 'refused')       { outcome = 'refused'; reason = c.refusalReason || 'other'; note = c.refusalNote || ''; }
                        else if (c.acceptance === 'noAnswer') { outcome = 'noAnswer'; }
                        else if (c.acceptance === 'accepted') { outcome = 'accepted'; }
                        else if (c.acceptance === 'onApproval') {
                            outcome = c.approvalChoice === 'rejected' ? 'rejected' : c.approvalChoice || 'onApproval';
                            if (outcome === 'rejected') { reason = c.rejectionReason || 'other'; note = c.rejectionNote || ''; }
                        }
                        if (!outcome) return;
                        out.push({ ref: x.ref, clientId: client.id, vesselId: v.id, vesselType: v.type, rank: x.row.rank,
                                   userId: user.id, groupId: user.groupId, name: c.name, pool: c.groupId || 'new',
                                   outcome, reason, note, at: c.decidedAt || Date.now(), live: true });
                    });
                });
            }
            return out.filter(d => d.at >= from
                && (!F.client || d.clientId === F.client) && (!F.vesselType || d.vesselType === F.vesselType)
                && (!F.rank || d.rank === F.rank) && (!F.pool || d.pool === F.pool)
                && (!F.user || d.userId === F.user) && (!F.group || d.groupId === F.group));
        },
        decCounts() { return this._decCounts(this.decisions); },

        decKpis() {
            const c = this.decCounts;
            const top = kind => this.reasonStats(kind)[0];
            const tr = top('refused'), tj = top('rejected');
            return [
                { id: 'ref', label: 'Seafarer refusal rate', icon: 'mdi-account-cancel-outline', value: this.pct(c.refusalRate),
                  sub: c.refused + ' refused of ' + c.asked + ' asked' },
                { id: 'na', label: 'No answer', icon: 'mdi-phone-off-outline', value: this.pct(c.noAnswerRate),
                  sub: c.noAnswer + ' of ' + c.asked + ' asked did not answer in time' },
                { id: 'rej', label: 'Principal rejection rate', icon: 'mdi-close-circle-outline', value: this.pct(c.rejectionRate),
                  sub: c.rejected + ' rejected of ' + c.sent + ' sent for approval · ' + c.notFavored + ' not favored (not counted)' },
                { id: 'asked', label: 'Asked per filled RFE', icon: 'mdi-account-multiple-outline',
                  value: c.approved ? (c.asked / c.approved).toFixed(1) : '—', sub: 'Candidates asked for each approved one' },
                { id: 'topref', label: 'Top refusal reason', icon: 'mdi-account-alert-outline',
                  value: tr ? this.pct(tr.share) : '—', sub: tr ? tr.label : 'No refusals' },
                { id: 'toprej', label: 'Top rejection reason', icon: 'mdi-account-remove-outline',
                  value: tj ? this.pct(tj.share) : '—', sub: tj ? tj.label : 'No rejections' },
            ];
        },

        // Extra days per reason (statistic of the median / average toggle):
        //  refusal  → search + acceptance days of RFEs with that refusal reason minus
        //             the same for RFEs without any refusal
        //  rejection → rework days (lost to the rejected pass) of RFEs with that reason
        lostByReason() {
            const refs = new Set(this.decisions.filter(d => !d.live).map(d => d.ref));
            const rfes = rfeHistory.filter(r => refs.has(r.ref)).map(r => ({ r, d: rfeStepDurations(r.events) }));
            const sa = x => x.d.steps.s2 + x.d.steps.s3;
            const base = _anStat(rfes.filter(x => !x.r.cands.some(c => c.outcome === 'refused')).map(sa), this.stat) || 0;
            const out = { refused: {}, rejected: {} };
            SEAFARER_REFUSAL_REASONS.forEach(z => {
                const v = rfes.filter(x => x.r.cands.some(c => c.outcome === 'refused' && c.reason === z.id)).map(sa);
                out.refused[z.id] = v.length ? Math.max(0, _anStat(v, this.stat) - base) : null;
            });
            PRINCIPAL_REJECTION_REASONS.forEach(z => {
                const v = rfes.filter(x => x.r.cands.some(c => c.outcome === 'rejected' && c.reason === z.id)).map(x => x.d.rework);
                out.rejected[z.id] = v.length ? _anStat(v, this.stat) : null;
            });
            return out;
        },

        refusalOption()   { return this.reasonOption('refused'); },
        rejectionOption() { return this.reasonOption('rejected'); },
        refusalHeight()   { return this.reasonStats('refused').length * 34 + 50; },
        rejectionHeight() { return this.reasonStats('rejected').length * 34 + 50; },

        // Time lost per reason, both sides on one axis (days)
        lostOption() {
            const rows = [
                ...this.reasonStats('refused').map(r => Object.assign({ kind: 'refused' }, r)),
                ...this.reasonStats('rejected').map(r => Object.assign({ kind: 'rejected' }, r)),
            ].filter(r => r.lost != null && r.count >= 3).sort((a, b) => b.lost - a.lost);
            const mk = (kind, name, color) => ({
                name, type: 'bar', stack: 'lost', barWidth: 16,
                itemStyle: { color, borderRadius: [0, 4, 4, 0] },
                label: { show: true, position: 'right', color: AN_INK.primary, fontSize: 11, formatter: p => (p.value ? '+' + _anFmt(p.value) + ' d' : '') },
                data: rows.map(r => (r.kind === kind ? Math.round(r.lost * 10) / 10 : null)),
            });
            return {
                textStyle: { fontFamily: AN_FONT },
                legend: { top: 0, left: 0, itemGap: 18, textStyle: { color: AN_INK.secondary, fontSize: 12 }, data: ['Seafarer refusal', 'Principal rejection'] },
                grid: { top: 32, left: 24, right: 60, bottom: 24, containLabel: true },
                xAxis: { type: 'value', name: 'days', nameTextStyle: { color: AN_INK.muted }, axisLabel: { color: AN_INK.muted },
                         splitLine: { lineStyle: { color: AN_INK.grid } }, axisLine: { show: true, lineStyle: { color: AN_INK.axis } } },
                yAxis: { type: 'category', inverse: true, data: rows.map(r => r.label), axisTick: { show: false },
                         axisLabel: { color: AN_INK.primary, fontSize: 12 }, axisLine: { lineStyle: { color: AN_INK.axis } } },
                tooltip: { trigger: 'item', backgroundColor: '#fff', borderColor: '#e0e0e0', textStyle: { color: AN_INK.primary, fontFamily: AN_FONT, fontSize: 12 },
                    formatter: p => {
                        const r = rows[p.dataIndex];
                        return '<b>' + _anEsc(r.label) + '</b><br>' + (r.kind === 'refused' ? 'Seafarer refusal' : 'Principal rejection')
                            + ' · ' + r.count + ' cases<br>' + this.statLabel + ' extra <b>' + _anFmt(r.lost) + ' d</b>'
                            + '<br><span style="color:' + AN_INK.secondary + '">' + (r.kind === 'refused'
                                ? 'Search + acceptance days vs RFEs without refusals'
                                : 'Days lost to the rejected pass (back to search)') + '</span>';
                    } },
                series: [mk('refused', 'Seafarer refusal', AN_DEC.refused), mk('rejected', 'Principal rejection', AN_DEC.rejected)],
            };
        },
        lostHeight() {
            const n = [...this.reasonStats('refused'), ...this.reasonStats('rejected')].filter(r => r.lost != null && r.count >= 3).length;
            return n * 28 + 60;
        },

        // By group × reason: share of the group's refusals (or rejections) per reason
        decGroups() {
            const kind = this.decSide === 'refusal' ? 'refused' : 'rejected';
            const reasons = kind === 'refused' ? SEAFARER_REFUSAL_REASONS : PRINCIPAL_REJECTION_REASONS;
            const rows = this.groupBy(this.decisions, 'All candidates').map(g => {
                const c = this._decCounts(g.items);
                const hits = g.items.filter(d => d.outcome === kind);
                const share = {};
                reasons.forEach(z => { share[z.id] = hits.length ? hits.filter(d => d.reason === z.id).length / hits.length : 0; });
                return { key: g.key, label: g.label, base: kind === 'refused' ? c.asked : c.sent, n: hits.length,
                         rate: kind === 'refused' ? c.refusalRate : c.rejectionRate, share, low: hits.length < AN_LOW_SAMPLE };
            }).sort((a, b) => b.rate - a.rate);
            return { kind, reasons: reasons.filter(z => rows.some(r => r.share[z.id] > 0)), rows };
        },

        // Monthly rates (small multiples)
        decTrendOptions() {
            const byMonth = {};
            this.decisions.forEach(d => {
                const dt = new Date(d.at), k = dt.getUTCFullYear() + '-' + dt.getUTCMonth();
                (byMonth[k] = byMonth[k] || []).push(d);
            });
            const defs = [
                { id: 'refusalRate',   label: 'Seafarer refusal rate',   color: AN_DEC.refused },
                { id: 'noAnswerRate',  label: 'No answer rate',          color: AN_DEC.noAnswer },
                { id: 'rejectionRate', label: 'Principal rejection rate', color: AN_DEC.rejected },
            ];
            return defs.map(def => ({ def, option: {
                textStyle: { fontFamily: AN_FONT },
                grid: { top: 14, left: 4, right: 38, bottom: 4, containLabel: true },
                xAxis: { type: 'category', data: this.months.map(m => m.label), boundaryGap: false,
                         axisLabel: { color: AN_INK.muted, fontSize: 10, interval: Math.ceil(this.months.length / 4) - 1 },
                         axisTick: { show: false }, axisLine: { lineStyle: { color: AN_INK.axis } } },
                yAxis: { type: 'value', min: 0, splitNumber: 3, axisLabel: { color: AN_INK.muted, fontSize: 10, formatter: v => Math.round(v * 100) + '%' },
                         splitLine: { lineStyle: { color: AN_INK.grid } } },
                tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: '#e0e0e0', textStyle: { color: AN_INK.primary, fontFamily: AN_FONT, fontSize: 12 },
                           formatter: ps => '<b>' + (ps[0].value == null ? '—' : Math.round(ps[0].value * 100) + '%') + '</b> · ' + _anEsc(ps[0].name) },
                series: [{
                    type: 'line', connectNulls: true, showSymbol: false, lineStyle: { width: 2, color: def.color }, itemStyle: { color: def.color },
                    endLabel: { show: true, color: AN_INK.primary, fontSize: 11, formatter: p => Math.round(p.value * 100) + '%' },
                    data: this.months.map(m => { const v = byMonth[m.key]; return v && v.length >= AN_LOW_SAMPLE ? this._decCounts(v)[def.id] : null; }),
                }],
            } }));
        },

        // Cases (refusals, no answers, rejections) — filtered by a clicked reason
        caseRows() {
            const S = this.selReason;
            return this.decisions
                .filter(d => ['refused', 'noAnswer', 'rejected'].includes(d.outcome))
                .filter(d => !S || (d.outcome === S.kind && (S.kind === 'noAnswer' || d.reason === S.id)))
                .map((d, i) => ({
                    _key: d.ref + '|' + i, date: isoDate(new Date(d.at)), ref: d.ref, name: d.name,
                    kindText: d.outcome === 'refused' ? 'Seafarer refused' : d.outcome === 'noAnswer' ? 'No answer' : 'Principal rejected',
                    kindChip: d.outcome === 'refused' ? { text: 'Seafarer refused', color: 'primary', icon: 'mdi-account-cancel-outline' }
                            : d.outcome === 'noAnswer' ? { text: 'No answer', color: 'grey', icon: 'mdi-phone-off-outline' }
                            : { text: 'Principal rejected', color: '#7E57C2', icon: 'mdi-close-circle-outline' },
                    reasonText: d.outcome === 'refused' ? refusalReasonLabel(d.reason) : d.outcome === 'rejected' ? rejectionReasonLabel(d.reason) : '—',
                    note: d.note || '', pool: RFE_POOLS.find(p => p.id === d.pool).label, rank: d.rank.toUpperCase(),
                    client: allClientsData.find(c => c.id === d.clientId).name,
                    vessel: allVessels.find(v => v.id === d.vesselId).name.toUpperCase(),
                    user: OPS_USERS.find(u => u.id === d.userId).name,
                    date_sort: -d.at,
                }));
        },
        caseColumns() {
            return [
                { key: 'date',       title: 'Date', fixed: true, format: v => atlDate(v) },
                { key: 'ref',        title: 'Request', fixed: true },
                { key: 'name',       title: 'Seafarer' },
                { key: 'kindText',   title: 'Outcome', type: 'chip', chip: r => r.kindChip },
                { key: 'reasonText', title: 'Reason' },
                { key: 'note',       title: 'Note' },
                { key: 'pool',       title: 'Pool' },
                { key: 'rank',       title: 'Rank' },
                { key: 'client',     title: 'Principal' },
                { key: 'vessel',     title: 'Vessel' },
                { key: 'user',       title: 'User' },
            ];
        },
        selReasonText() {
            const S = this.selReason;
            if (!S) return '';
            return S.kind === 'noAnswer' ? 'No answer' : (S.kind === 'refused' ? 'Seafarer refused: ' + refusalReasonLabel(S.id) : 'Principal rejected: ' + rejectionReasonLabel(S.id));
        },

        pdfSubtitle() {
            const F = this.f, o = this.options;
            const name = (list, v) => { const x = list.find(i => (i.value || i) === v); return x ? (x.title || x) : v; };
            const parts = ['Last ' + this.period + ' months', this.statLabel];
            Object.keys(F).forEach(k => { if (F[k]) parts.push(name(o[k], F[k])); });
            return parts.join('  ·  ');
        },
        activeFilterCount() { return Object.values(this.f).filter(Boolean).length; },
    },

    methods: {
        // Groups of items (RFEs or candidate decisions — same field names) by compareBy
        groupBy(items, allLabel) {
            const by = this.compareBy;
            if (by === 'all') return [{ key: 'all', label: allLabel, items }];
            const label = {
                client:     id => (allClientsData.find(c => c.id === id) || {}).name || id,
                rank:       r => r.toUpperCase(),
                vesselType: t => t,
                pool:       p => (RFE_POOLS.find(x => x.id === p) || { label: p }).label,
                user:       id => OPS_USERS.find(u => u.id === id).name,
                group:      id => OPS_GROUPS.find(g => g.id === id).name,
            };
            const keyOf = { client: 'clientId', rank: 'rank', vesselType: 'vesselType', pool: 'pool', user: 'userId', group: 'groupId' };
            const map = {};
            items.forEach(r => {
                const k = r[keyOf[by]];
                (map[k] = map[k] || { key: k, label: label[by](k), items: [] }).items.push(r);
            });
            return Object.values(map);
        },
        // Counts and rates of a list of candidate decisions
        _decCounts(items) {
            const n = o => items.filter(d => d.outcome === o).length;
            const c = { refused: n('refused'), noAnswer: n('noAnswer'), rejected: n('rejected'),
                        approved: n('approved'), notFavored: n('notFavored') };
            c.asked = items.length;                                     // every candidate asked for acceptance
            c.sent  = c.rejected + c.approved + c.notFavored;           // decided by the principal
            c.refusalRate   = c.asked ? c.refused / c.asked : 0;
            c.noAnswerRate  = c.asked ? c.noAnswer / c.asked : 0;
            c.rejectionRate = c.sent ? c.rejected / c.sent : 0;
            return c;
        },
        // Reasons of one side: [{ id, label, count, share, lost }] most frequent first
        reasonStats(kind) {
            const list = kind === 'refused' ? SEAFARER_REFUSAL_REASONS : PRINCIPAL_REJECTION_REASONS;
            const hits = this.decisions.filter(d => d.outcome === kind);
            return list.map(z => {
                const count = hits.filter(d => d.reason === z.id).length;
                return { id: z.id, label: z.label, count, share: hits.length ? count / hits.length : 0, lost: this.lostByReason[kind][z.id] };
            }).filter(r => r.count > 0).sort((a, b) => b.count - a.count);
        },
        // Sorted horizontal bars of reason counts (one hue per side), click → cases
        reasonOption(kind) {
            const rows = this.reasonStats(kind);
            const color = AN_DEC[kind];
            return {
                textStyle: { fontFamily: AN_FONT },
                grid: { top: 8, left: 24, right: 90, bottom: 24, containLabel: true },
                xAxis: { type: 'value', minInterval: 1, axisLabel: { color: AN_INK.muted },
                         splitLine: { lineStyle: { color: AN_INK.grid } }, axisLine: { show: true, lineStyle: { color: AN_INK.axis } } },
                yAxis: { type: 'category', inverse: true, data: rows.map(r => r.label), axisTick: { show: false },
                         axisLabel: { color: AN_INK.primary, fontSize: 12 }, axisLine: { lineStyle: { color: AN_INK.axis } } },
                tooltip: { trigger: 'item', backgroundColor: '#fff', borderColor: '#e0e0e0', textStyle: { color: AN_INK.primary, fontFamily: AN_FONT, fontSize: 12 },
                    formatter: p => {
                        const r = rows[p.dataIndex];
                        return '<b>' + _anEsc(r.label) + '</b><br>' + r.count + ' cases · ' + this.pct(r.share) + ' of all '
                            + (kind === 'refused' ? 'refusals' : 'rejections')
                            + (r.lost != null ? '<br>' + this.statLabel + ' extra ' + _anFmt(r.lost) + ' d' : '')
                            + '<br><span style="color:' + AN_INK.secondary + '">Click to list the cases</span>';
                    } },
                series: [{
                    type: 'bar', barWidth: 18, itemStyle: { color, borderRadius: [0, 4, 4, 0] }, cursor: 'pointer',
                    label: { show: true, position: 'right', color: AN_INK.primary, fontSize: 12,
                             formatter: p => rows[p.dataIndex].count + '  ·  ' + this.pct(rows[p.dataIndex].share) },
                    data: rows.map(r => r.count),
                }],
            };
        },
        onReasonClick(kind, p) {
            const r = this.reasonStats(kind)[p.dataIndex];
            if (!r) return;
            this.selReason = { kind, id: r.id };
            this.$nextTick(() => { const el = this.$refs.cases; if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
        },
        // Heat cell: share shaded in the side's hue (text flips to white on dark cells)
        heatStyle(share, kind) {
            const rgb = kind === 'refused' ? '21,101,192' : '126,87,194';
            return { background: 'rgba(' + rgb + ',' + (0.06 + share * 0.94).toFixed(2) + ')', color: share > 0.45 ? '#fff' : AN_INK.primary };
        },
        fmt: _anFmt,
        pct: v => Math.round(v * 100) + '%',
        // Days in the current stage: from the stage log, else a seeded entry date
        daysInStage(ref, stage) {
            const log = this.store.rfeStageLog[ref] || [];
            const e = log.filter(x => x.stage === stage).pop();
            if (e) return Math.max(0, Math.round((Date.now() - e.at) / 86400000));
            let h = 0;
            (ref + stage).split('').forEach(c => { h = (h * 31 + c.charCodeAt(0)) >>> 0; });
            return 1 + h % ({ search: 16, ask: 5, accepted: 3, approval: 9, preparation: 20, ready: 5 }[stage] || 6);
        },
        // Bar click: filter the page to that group and drill down one level
        onBarClick(p) {
            const g = this.groupStats[p.dataIndex];
            if (!g || this.compareBy === 'all') return;
            this.f[this.compareBy] = g.key;
            this.compareBy = { group: 'user', client: 'user', user: 'pool', rank: 'pool', vesselType: 'rank', pool: 'client' }[this.compareBy];
        },
        clearFilters() { Object.keys(this.f).forEach(k => { this.f[k] = null; }); },
        openTargets()  { this.draftTargets = Object.assign({}, this.targets); this.targetsOpen = true; },
        saveTargets()  {
            RFE_STEPS.forEach(s => { this.store.rfeTargets[s.id] = Math.max(0, +this.draftTargets[s.id] || 0); });
            this.targetsOpen = false;
        },
        resetTargets() { this.draftTargets = { s1: 1, s2: 10, s3: 3, s4: 2, s5: 5, s6: 14, s7: 3 }; },
        draftTotal()   { return RFE_STEPS.reduce((n, s) => n + (+this.draftTargets[s.id] || 0), 0); },
    },
};
