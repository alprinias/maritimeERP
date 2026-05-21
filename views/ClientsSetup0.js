/* ── views/ClientsSetup.js ────────────────────────────────────
   Admin → Clients Setup view for Maritime ERP.
   Template lives in index.html as:
     <script type="text/x-template" id="tpl-clients-setup">
   Depends on globals: allClientsData (clients.js), allVessels (vessels.js)
   Exposes global: ClientsSetupView
──────────────────────────────────────────────────────────────── */

const ClientsSetupView = {
    template: '#tpl-clients-setup',

    data() {
        return {
            // ── Client level
            selectedClientId: '',
            activeTab: 'details',
            editing: false,
            editForm: {},
            editSalary: [],

            // ── Vessel level
            selectedVesselId: '',
            vesselTab: 'vdetails',
            vesselEditing: false,
            vesselEditForm: {},
            vesselRanksEditing: false,
            editVesselRanks: [],

            // ── Documents tab
            addingDocType: false,
            newDocTypeName: '',
            editingDocName: null,   // doc.id being renamed
            editDocNameVal: '',
        };
    },

    computed: {
        clients() { return allClientsData; },

        selectedClient() {
            if (!this.selectedClientId) return null;
            return allClientsData.find(c => c.id === this.selectedClientId) || null;
        },

        clientVessels() {
            if (!this.selectedClient) return [];
            return allVessels.filter(v => this.selectedClient.vesselIds.includes(v.id));
        },

        selectedVessel() {
            if (!this.selectedVesselId) return null;
            return allVessels.find(v => v.id === this.selectedVesselId) || null;
        },

        rankOrder() {
            return ['Captain','Chief Officer','Second Officer','Third Officer',
                    'Chief Engineer','Second Engineer','Third Engineer',
                    'Bosun','AB Deck','Oiler','Ordinary Seaman'];
        },

        vesselRankRows() {
            if (!this.selectedVessel) return [];
            const stored = this.selectedVessel.vesselRanks || [];
            return this.rankOrder.map(rank => {
                const ov = stored.find(r => r.rank === rank) || {};
                return { rank,
                    manning:   ov.manning   || null,
                    salaryMin: ov.salaryMin || null,
                    salaryMax: ov.salaryMax || null,
                    currency:  ov.currency  || '',
                };
            });
        },

        // Document types for the selected client (guaranteed array)
        clientDocTypes() {
            return this.selectedClient ? (this.selectedClient.docTypes || []) : [];
        },

        // Column rank order for the documents matrix
        // Abbreviated for horizontal compactness
        docRankOrder() {
            return ['Captain','Chief Officer','Chief Engineer',
                    'Second Officer','Second Engineer',
                    'Third Officer','Third Engineer',
                    'Bosun','AB Deck','Oiler','Ordinary Seaman'];
        },
    },

    watch: {
        selectedClientId() {
            this.activeTab = 'details';
            this.editing = false;
            this.selectedVesselId = '';
            this.addingDocType = false;
            this.editingDocName = null;
        },
        selectedVesselId() {
            this.vesselTab = 'vdetails';
            this.vesselEditing = false;
            this.vesselRanksEditing = false;
        },
    },

    methods: {
        // ── Client details edit ────────────────────────────
        startEdit() {
            const c = this.selectedClient;
            this.editForm = { name: c.name, alias: c.alias, address: c.address,
                contactEmail: c.contactEmail, contactPhone: c.contactPhone, isActive: c.isActive };
            this.editSalary = c.salaryRanges.map(r => ({ ...r }));
            this.editing = true;
        },
        cancelEdit() { this.editing = false; },
        saveEdit() {
            const c = this.selectedClient;
            Object.assign(c, this.editForm);
            c.salaryRanges = this.editSalary.map(r => ({ ...r }));
            this.editing = false;
        },

        // ── Vessel details edit ────────────────────────────
        startVesselEdit() {
            const v = this.selectedVessel;
            this.vesselEditForm = { imo: v.imo, built: v.built, gt: v.gt, flag: v.flag,
                type: v.type, classificationSociety: v.classificationSociety,
                engineType: v.engineType, enginePower: v.enginePower,
                piClub: v.piClub, hullInsurer: v.hullInsurer, hullValue: v.hullValue };
            this.vesselEditing = true;
        },
        saveVesselEdit() {
            Object.assign(this.selectedVessel, this.vesselEditForm);
            this.vesselEditing = false;
        },

        // ── Vessel ranks & manning edit ────────────────────
        startVesselRanksEdit() {
            this.editVesselRanks = this.vesselRankRows.map(r => ({ ...r }));
            this.vesselRanksEditing = true;
        },
        saveVesselRanks() {
            this.selectedVessel.vesselRanks = this.editVesselRanks
                .filter(r => r.manning || r.salaryMin || r.salaryMax)
                .map(r => ({ ...r }));
            this.vesselRanksEditing = false;
        },

        // ── Client salary fallbacks ────────────────────────
        clientRateFor(rank, minOrMax) {
            if (!this.selectedClient) return '';
            const row = this.selectedClient.salaryRanges.find(r => r.rank === rank);
            return row ? row[minOrMax] : '';
        },
        clientCurrencyFor(rank) {
            if (!this.selectedClient) return 'USD';
            const row = this.selectedClient.salaryRanges.find(r => r.rank === rank);
            return row ? row.currency : 'USD';
        },

        // ── Documents tab ──────────────────────────────────
        addDocType() {
            this.addingDocType = true;
            this.newDocTypeName = '';
            this.$nextTick(() => {
                const el = this.$el.querySelector('[ref="newDocInput"], input[placeholder]');
                if (el) el.focus();
            });
        },
        confirmAddDocType() {
            const name = this.newDocTypeName.trim();
            if (!name) return;
            if (!this.selectedClient.docTypes) this.selectedClient.docTypes = [];
            const id = 'dt_' + Date.now();
            this.selectedClient.docTypes.push({ id, name, required: {} });
            this.newDocTypeName = '';
            this.addingDocType = false;
        },
        removeDocType(docId) {
            const list = this.selectedClient.docTypes;
            const idx = list.findIndex(d => d.id === docId);
            if (idx !== -1) list.splice(idx, 1);
        },

        // Toggle a rank's requirement for a document type
        toggleDocRequirement(doc, rank) {
            // required is a plain object { 'Captain': true, ... }
            // Vue 3 tracks plain object property additions reactively
            if (doc.required[rank]) {
                delete doc.required[rank];
            } else {
                doc.required[rank] = true;
            }
        },

        isRequired(doc, rank) {
            return !!doc.required[rank];
        },

        // Inline rename of a document type
        startEditDocName(doc) {
            this.editingDocName = doc.id;
            this.editDocNameVal = doc.name;
        },
        saveDocName(doc) {
            const val = this.editDocNameVal.trim();
            if (val) doc.name = val;
            this.editingDocName = null;
        },

        // ── Display helpers ────────────────────────────────
        vesselTypeIcon(type) {
            return { 'Oil Tanker':'🛢','Chemical Tanker':'⚗','Bulk Carrier':'⚓',
                     'Container':'📦','RoRo':'🚗','LNG Carrier':'🔵',
                     'General Cargo':'📫','Offshore Supply':'🔧' }[type] || '🚢';
        },
        flagEmoji(flag) {
            return { 'Panama':'🇵🇦','Marshall Islands':'🇲🇭','Liberia':'🇱🇷',
                     'Greece':'🇬🇷','Singapore':'🇸🇬','Cyprus':'🇨🇾',
                     'Japan':'🇯🇵','Malta':'🇲🇹','Bahamas':'🇧🇸' }[flag] || '🏳';
        },
        fmtSalary(n) {
            return n ? Number(n).toLocaleString('en-US') : '—';
        },
    },
};
