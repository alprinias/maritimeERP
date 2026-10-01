/* ── views/ClientPortal.js ────────────────────────────────────
   Client UI shell — mockup of the separate client portal in the Atlantis
   (Vuetify / Material) look. Rendered full screen instead of the internal
   ERP shell for every /client/* route (see isClientUi in index.html).
   Templates live in index.html: tpl-client-portal, tpl-client-placeholder

   Depends on globals: erpStore, allClientsData
   Exposes globals: ClientPortal, ClientPlaceholderView
──────────────────────────────────────────────────────────────── */
const ClientPortal = {
    template: '#tpl-client-portal',

    data() {
        return { store: erpStore, drawer: false };
    },

    computed: {
        portalClients() { return allClientsData.filter(c => c.isActive); },
        client() { return allClientsData.find(c => c.id === this.store.clientUi.clientId) || null; },
        menu() {
            return [
                { to: '/client/dashboard',  title: 'Dashboard',         icon: 'mdi-view-dashboard-outline' },
                { to: '/client/crew-lists', title: 'Crew Lists',        icon: 'mdi-account-group' },
                { to: '/client/rotation',   title: 'Rotation Plan',     icon: 'mdi-chart-gantt' },
                { to: '/client/approvals',  title: 'Pending Approvals', icon: 'mdi-account-check-outline' },
            ];
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

// Placeholder for Client UI pages not built yet (title / icon / phase from route meta)
const ClientPlaceholderView = {
    template: '#tpl-client-placeholder',
};
