/* ── views/ClientCrew.js ──────────────────────────────────────
   Client UI → Fleet & Crew view for Maritime ERP.
   The template lives in index.html as:
     <script type="text/x-template" id="tpl-client-crew">

   Read-only view scoped to the client selected in the top bar
   (erpStore.clientUi.clientId). Three tabs:
   - Crew List    — who is / was / will be on board on a chosen date
   - Crew Changes — pending sign-offs, embarkations, extensions, promotions
   - Former Crew  — completed tours on the client's vessels

   Internal-only data (wages, costs, candidate categories, CES scores,
   BMI) is deliberately not shown.

   Depends on globals: allVessels, allClientsData, erpStore, TODAY, d, addM,
     daysB, isoDate (utils.js), crew.js helpers, documents.js helpers
   Exposes global: ClientCrewView
──────────────────────────────────────────────────────────────── */
const ClientCrewView = {
    template: '#tpl-client-crew',

    data() {
        return {
            store:          erpStore,
            activeTab:      'crew',        // 'crew' | 'changes' | 'former'
            filterVessel:   '',
            onDate:         isoDate(TODAY),
            todayStr:       isoDate(TODAY),
            changesHorizon: 90,            // days ahead; 0 = all
            formerSearch:   '',
        };
    },

    watch: {
        'store.clientUi.clientId'() { this.filterVessel = ''; },
    },

    computed: {
        client() {
            return allClientsData.find(c => c.id === this.store.clientUi.clientId) || null;
        },
        clientVessels() {
            if (!this.client) return [];
            return allVessels.filter(v => this.client.vesselIds.includes(v.id));
        },
        shownVessels() {
            return this.clientVessels.filter(v => !this.filterVessel || v.id === this.filterVessel);
        },

        tabs() {
            return [
                { id: 'crew',    label: 'Crew List',    count: this.crewByVessel.reduce((n, g) => n + g.rows.filter(r => r.kind !== 'unknown').length, 0) },
                { id: 'changes', label: 'Crew Changes', count: this.changes.length },
                { id: 'former',  label: 'Former Crew',  count: this.formerCrew.length },
            ];
        },

        // ── Summary cards (always relative to today) ──────────
        vesselCards() {
            const in30 = isoDate(addM(TODAY, 1));
            return this.clientVessels.map(v => {
                const crew = crewOnDate(v, this.todayStr).filter(r => r.kind === 'current');
                const events = crewEvents(v);
                let expiring = 0, expired = 0;
                crew.forEach(r => {
                    const s = docSummary(r.seafarerId);
                    expiring += s.expiring; expired += s.expired;
                });
                return {
                    vessel:   v,
                    onboard:  crew.length,
                    changes:  events.filter(e => !e.overdue && e.date <= in30).length,
                    overdue:  events.filter(e => e.overdue).length,
                    expiring, expired,
                };
            });
        },

        // ── Crew List ─────────────────────────────────────────
        dateMode() {
            if (this.onDate < this.todayStr) return 'past';
            if (this.onDate > this.todayStr) return 'future';
            return 'today';
        },
        crewByVessel() {
            return this.shownVessels.map(v => ({ vessel: v, rows: crewOnDate(v, this.onDate || this.todayStr) }));
        },

        // ── Crew Changes ──────────────────────────────────────
        changes() {
            const limit = this.changesHorizon ? isoDate(new Date(TODAY.getTime() + this.changesHorizon * 86400000)) : null;
            const out = [];
            this.shownVessels.forEach(v => {
                crewEvents(v).forEach(e => {
                    if (limit && e.date > limit) return;
                    out.push(Object.assign({ vesselName: v.name }, e));
                });
            });
            return out.sort((a, b) => a.date.localeCompare(b.date));
        },
        overdueChanges()  { return this.changes.filter(e => e.overdue); },
        upcomingChanges() { return this.changes.filter(e => !e.overdue); },

        // ── Former Crew ───────────────────────────────────────
        formerCrew() {
            const ids = this.shownVessels.map(v => v.id);
            const q = this.formerSearch.trim().toUpperCase();
            return crewPastAssignments
                .filter(a => ids.includes(a.vesselId))
                .map(a => {
                    const p = seafarerById(a.seafarerId) || {};
                    const v = allVessels.find(x => x.id === a.vesselId);
                    return Object.assign({ name: p.name, nationality: p.nationality, vesselName: v.name,
                                           nowOnboard: this.currentVesselOf(a.seafarerId) }, a);
                })
                .filter(a => !q || (a.name || '').includes(q) || a.rank.toUpperCase().includes(q)
                                || (a.nationality || '').toUpperCase().includes(q))
                .sort((a, b) => b.signoff.localeCompare(a.signoff));
        },
    },

    methods: {
        person(id) { return seafarerById(id); },
        docs(id)   { return id ? docSummary(id) : null; },

        // Name of the client vessel this seafarer is on today, if any
        currentVesselOf(seafarerId) {
            const v = this.clientVessels.find(v => v.ranks.some(r => r.onboard && r.onboard.seafarerId === seafarerId));
            return v ? v.name : null;
        },

        shiftMonths(n) { this.onDate = isoDate(addM(d(this.onDate || this.todayStr), n)); },
        goToday()      { this.onDate = this.todayStr; },

        fmtDate(iso) {
            if (!iso) return '—';
            return d(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
        },
        fmtDuration(fromIso, toIso) {
            const days = daysB(d(fromIso), d(toIso));
            const m = Math.floor(days / 30.44);
            const rest = Math.round(days - m * 30.44);
            return m > 0 ? `${m}m ${rest}d` : `${days}d`;
        },
        daysBetween(fromIso, toIso) { return daysB(d(fromIso), d(toIso)); },

        // Relief / change stage → client-facing label + badge classes
        stageMeta(stage) {
            return {
                search:      { label: 'Candidate search',       cls: 'bg-violet-50 text-violet-700 border-violet-200' },
                approval:    { label: 'Awaiting your approval', cls: 'bg-purple-100 text-purple-800 border-purple-300' },
                preparation: { label: 'Joining preparation',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
                requested:   { label: 'Sign-off requested',     cls: 'bg-rose-50 text-rose-700 border-rose-200' },
                relief:      { label: 'Relief planned',         cls: 'bg-sky-50 text-sky-700 border-sky-200' },
                contract:    { label: 'Contract end — no relief yet', cls: 'bg-gray-50 text-gray-500 border-gray-200' },
                active:      { label: 'Requested',              cls: 'bg-orange-50 text-orange-700 border-orange-200' },
                completed:   { label: 'Completed',              cls: 'bg-green-50 text-green-700 border-green-200' },
            }[stage] || { label: stage, cls: 'bg-gray-50 text-gray-500 border-gray-200' };
        },
        eventMeta(type) {
            return {
                signoff:   { label: 'Sign-off',    icon: '↑', cls: 'bg-rose-100 text-rose-800' },
                embark:    { label: 'Embarkation', icon: '↓', cls: 'bg-sky-100 text-sky-800' },
                extension: { label: 'Extension',   icon: '⏩', cls: 'bg-teal-100 text-teal-800' },
                promotion: { label: 'Promotion',   icon: '⬆', cls: 'bg-purple-100 text-purple-800' },
            }[type];
        },
    },
};
