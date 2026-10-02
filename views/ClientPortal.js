/* ── views/ClientPortal.js ────────────────────────────────────
   Client UI shell — mockup of the separate client portal in the Atlantis
   (Vuetify / Material) look. Rendered full screen instead of the internal
   ERP shell for every /client/* route (see isClientUi in index.html).
   On phones (isPhone, global mixin in index.html) the app bar is compact with
   an account menu, and a bottom navigation bar mirrors the drawer menu.
   Templates live in index.html: tpl-client-portal, tpl-client-placeholder

   Depends on globals: erpStore, allClientsData
   Exposes global: ClientPortal
──────────────────────────────────────────────────────────────── */
const ClientPortal = {
    template: '#tpl-client-portal',

    data() {
        return { store: erpStore, drawer: false };
    },

    created() {
        // Approvals and relief stages read the live RFA rows
        ensureRfaRows();
    },

    computed: {
        portalClients() { return allClientsData.filter(c => c.isActive); },
        client() { return allClientsData.find(c => c.id === this.store.clientUi.clientId) || null; },
        pendingCount() { return clientApprovalItems(this.client).filter(i => i.status === 'pending').length; },
        prepCount()    { return clientPreparationItems(this.client).length; },
        menu() {
            return [
                { to: '/client/dashboard',  title: 'Dashboard',         short: 'Dashboard', icon: 'mdi-view-dashboard-outline' },
                { to: '/client/crew-lists', title: 'Crew Lists',        short: 'Crew',      icon: 'mdi-account-group' },
                { to: '/client/rotation',   title: 'Rotation Plan',     short: 'Rotation',  icon: 'mdi-chart-gantt' },
                { to: '/client/approvals',  title: 'Pending Approvals', short: 'Approvals', icon: 'mdi-account-check-outline', badge: this.pendingCount, badgeColor: 'deep-purple' },
                { to: '/client/preparation', title: 'On Preparation',   short: 'Preparation', icon: 'mdi-clipboard-check-outline', badge: this.prepCount, badgeColor: 'info' },
            ];
        },
        toastOpen: {
            get() { return !!this.store.clientUi.toast; },
            set(v) { if (!v) this.store.clientUi.toast = ''; },
        },
        pageTitle() { return this.$route.meta.title || 'Client Portal'; },
        pageIcon()  { return this.$route.meta.icon || 'mdi-domain'; },
    },

    watch: {
        '$route.path'() { this.drawer = false; },
    },

    methods: {
        exit() { this.$router.push('/operations/rotation'); },
    },
};
