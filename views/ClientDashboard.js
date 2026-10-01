/* ── views/ClientDashboard.js ─────────────────────────────────
   Client UI → Dashboard (landing page). Template in index.html:
   tpl-client-dashboard · styles: .atl-dash*

   For the client selected in the portal top bar:
   - KPI tiles: crew on board, ashore (dedicated pool), pending approvals,
     crew changes in the next 30 days, overdue sign-offs, documents of the
     crew on board that are expired / expiring (≤ 90 days)
   - Fleet table: one row per vessel with the same figures
   - Lists: requests awaiting approval, changes in the next 30 days,
     documents needing attention
   Every tile / row links to the page with the detail (deep links use
   ?list= / ?vessel= on Crew Lists and ?vessel= on Rotation Plan).
   Status is always shown with an icon + label, never by colour alone.

   Depends on globals: erpStore, allVessels, allClientsData, utils.js, crew.js,
     documents.js, ClientApprovals.js (clientApprovalItems), atlDate
   Exposes global: ClientDashboardView
──────────────────────────────────────────────────────────────── */

const DASH_HORIZON_DAYS = 30;

const ClientDashboardView = {
    template: '#tpl-client-dashboard',

    data() {
        return { store: erpStore, todayStr: isoDate(TODAY), allDocs: false };
    },

    computed: {
        client() { return allClientsData.find(c => c.id === this.store.clientUi.clientId) || null; },
        vessels() { return this.client ? allVessels.filter(v => this.client.vesselIds.includes(v.id)) : []; },
        horizon() { return isoDate(new Date(TODAY.getTime() + DASH_HORIZON_DAYS * 86400000)); },
        todayLong() {
            return TODAY.toLocaleDateString('en-GB', { weekday: 'long' }) + ', ' + atlDate(this.todayStr);
        },

        // Per-vessel figures (also summed for the tiles)
        fleet() {
            return this.vessels.map(v => {
                const crew    = crewOnDate(v, this.todayStr).filter(r => r.kind === 'current');
                const events  = crewEvents(v);
                const next    = events.filter(e => !e.overdue && (e.type === 'signoff' || e.type === 'embark'))[0] || null;
                const docs    = this.crewDocIssues(crew);
                return {
                    vessel:    v,
                    onboard:   crew.length,
                    positions: v.ranks.length,
                    upcoming:  events.filter(e => !e.overdue && e.date <= this.horizon),
                    overdue:   events.filter(e => e.overdue && e.type === 'signoff'),
                    pending:   this.pendingItems.filter(i => i.row.vesselId === v.id).length,
                    expired:   docs.filter(x => x.status === 'expired').length,
                    expiring:  docs.filter(x => x.status === 'expiring').length,
                    docs, next,
                };
            });
        },
        pendingItems() {
            return clientApprovalItems(this.client)
                .filter(i => i.status === 'pending')
                .sort((a, b) => a.due.localeCompare(b.due));
        },
        ashoreCount() { return this.client ? ashoreDedicated(this.client.id).length : 0; },
        sum() {
            const s = (k) => this.fleet.reduce((n, f) => n + (Array.isArray(f[k]) ? f[k].length : f[k]), 0);
            return { onboard: s('onboard'), positions: s('positions'), upcoming: s('upcoming'),
                     overdue: s('overdue'), expired: s('expired'), expiring: s('expiring') };
        },

        tiles() {
            const t = this.sum;
            return [
                { id: 'onboard',  label: 'Crew on board', icon: 'mdi-ferry', value: t.onboard,
                  sub: t.positions + ' positions on ' + this.vessels.length + ' vessels',
                  to: '/client/crew-lists?list=onboard' },
                { id: 'ashore',   label: 'Ashore (your pool)', icon: 'mdi-beach', value: this.ashoreCount,
                  sub: 'Dedicated seafarers on vacation', to: '/client/crew-lists?list=ashore' },
                { id: 'approval', label: 'Pending approvals', icon: 'mdi-account-check-outline', value: this.pendingItems.length,
                  sub: this.pendingItems.length ? 'Next due ' + atlDate(this.pendingItems[0].due) : 'Nothing waiting for you',
                  status: this.pendingItems.length ? { text: 'Action needed', icon: 'mdi-alert-circle-outline', color: 'deep-purple' } : null,
                  to: '/client/approvals' },
                { id: 'changes',  label: 'Crew changes · next 30 days', icon: 'mdi-swap-vertical', value: t.upcoming,
                  sub: 'Sign-ons, sign-offs, extensions, promotions', to: '/client/crew-lists?list=changes' },
                { id: 'overdue',  label: 'Overdue sign-offs', icon: 'mdi-timer-alert-outline', value: t.overdue,
                  sub: t.overdue ? 'Past the planned sign-off date' : 'All sign-offs on schedule',
                  status: t.overdue ? { text: 'Overdue', icon: 'mdi-alert', color: 'error' }
                                    : { text: 'On schedule', icon: 'mdi-check-circle-outline', color: 'success' },
                  to: '/client/rotation' },
                { id: 'docs',     label: 'Documents · crew on board', icon: 'mdi-file-alert-outline', value: t.expired + t.expiring,
                  sub: t.expired + ' expired · ' + t.expiring + ' expiring ≤ 90 days',
                  status: t.expired ? { text: t.expired + ' expired', icon: 'mdi-alert-circle', color: 'error' }
                        : t.expiring ? { text: t.expiring + ' expiring', icon: 'mdi-clock-alert-outline', color: 'warning' }
                        : { text: 'All valid', icon: 'mdi-check-circle-outline', color: 'success' },
                  to: '#docs' },
            ];
        },

        // Lists
        upcomingList() {
            return this.fleet
                .flatMap(f => f.upcoming.map(e => Object.assign({ vesselName: f.vessel.name }, e)))
                .sort((a, b) => a.date.localeCompare(b.date));
        },
        docList() {
            return this.fleet
                .flatMap(f => f.docs.map(x => Object.assign({ vesselName: f.vessel.name }, x)))
                .sort((a, b) => (a.status === b.status ? 0 : a.status === 'expired' ? -1 : 1) || a.doc.expiryDate.localeCompare(b.doc.expiryDate));
        },
    },

    methods: {
        atlDate, fullNameLF,
        // Expired / expiring documents of the crew currently on board
        crewDocIssues(crew) {
            const out = [];
            crew.forEach(r => seafarerDocuments(r.seafarerId).forEach(doc => {
                const st = docStatus(doc);
                if (st === 'expired' || st === 'expiring') out.push({ seafarerId: r.seafarerId, rank: r.rank, doc, status: st });
            }));
            return out;
        },
        person(id) { return seafarerById(id); },
        daysLeft(iso) { return daysB(d(this.todayStr), d(iso)); },
        open(tile) {
            if (tile.to === '#docs') {
                const el = document.getElementById('atl-dash-docs');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
            } else {
                this.$router.push(tile.to);
            }
        },
        openApproval(item) { this.store.clientUi.approvalRef = item.ref; },
        openProfile(id)    { if (id) this.store.clientUi.profileId = id; },
        changeMeta(e) {
            return {
                signoff:   { text: 'Sign-off',  icon: 'mdi-arrow-up-bold',   color: 'red-darken-4' },
                embark:    { text: 'Sign-on',   icon: 'mdi-arrow-down-bold', color: 'light-blue-darken-2' },
                extension: { text: 'Extension', icon: 'mdi-fast-forward',    color: 'amber-darken-3' },
                promotion: { text: 'Promotion', icon: 'mdi-arrow-up-circle', color: 'deep-orange-darken-1' },
            }[e.type];
        },
        // Who the change is about: sign-ons are named only once approved
        changeName(e) {
            if (e.type === 'embark' && !isApprovedStage(e.stage)) return null;
            const s = seafarerById(e.seafarerId);
            return s ? fullNameLF(s) : e.name;
        },
    },
};
