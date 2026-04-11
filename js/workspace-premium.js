const STORAGE_KEYS = {
    data: 'architech.workspace.data',
    session: 'architech.portal.session',
    selectedClientId: 'architech.ops.selectedClientId'
};

const WorkspaceStorage = {
    read(key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch (error) {
            console.warn(`[Workspace] Failed to read ${key}`, error);
            return fallback;
        }
    },
    write(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn(`[Workspace] Failed to write ${key}`, error);
        }
    }
};

const WorkspaceSeed = {
    clients: [
        {
            id: 'client-sterling',
            company: 'Sterling & Associates',
            contactName: 'Jordan Sterling',
            email: 'client@architechdesigns.net',
            accessKey: 'ARCHI-2026',
            service: 'Growth System',
            projectName: 'Sterling & Associates Website + Demo Portal',
            status: 'On track',
            nextReview: 'April 12, 2026',
            launchTarget: 'April 24, 2026',
            currentPhase: 'UI review + content refinement',
            progress: 78,
            owner: 'Design + development',
            summaryTitle: 'Design approved. Development pass in progress.',
            summaryText: 'We are finalizing responsive refinements, portal access flows, and invoice-triggered milestone logic before the next review window opens.',
            nextActions: [
                'Approve refined mobile homepage layout',
                'Review final consultation CTA copy',
                'Confirm invoice release after feedback round'
            ],
            timeline: [
                { id: 'timeline-sterling-1', date: 'April 03', title: 'Discovery and conversion planning completed', body: 'Audience priorities, service architecture, and systems scope locked for production.', state: 'complete' },
                { id: 'timeline-sterling-2', date: 'April 07', title: 'Premium UI direction approved', body: 'Visual hierarchy, premium card system, and mobile art direction signed off.', state: 'complete' },
                { id: 'timeline-sterling-3', date: 'Now', title: 'Development and portal integration pass', body: 'Responsive implementation, portal shell wiring, and client messaging flow in progress.', state: 'current' },
                { id: 'timeline-sterling-4', date: 'Next', title: 'Client review and invoice release', body: 'Deliver milestone review package, open invoice, and queue launch checklist.', state: 'upcoming' }
            ],
            messages: [
                { id: 'msg-sterling-1', sender: 'Architech', role: 'team', time: 'Today - 9:18 AM', body: 'The refined mobile homepage pass is ready for review. We tightened the card rails, elevated the portal preview section, and cleaned up the sticky header behavior.' },
                { id: 'msg-sterling-2', sender: 'Jordan Sterling', role: 'client', time: 'Today - 10:02 AM', body: 'Looks great so far. Please keep the premium feel strong on mobile and preserve the stronger CTA emphasis near the end of the page.' },
                { id: 'msg-sterling-3', sender: 'Architech', role: 'team', time: 'Today - 10:14 AM', body: 'Absolutely. We are finishing the mobile conversion pass now and will release the current invoice when the review package is approved.' }
            ],
            files: [
                { id: 'file-sterling-1', name: 'Homepage Review Deck.pdf', type: 'Review package', meta: 'Shared today', action: 'Shared' },
                { id: 'file-sterling-2', name: 'Portal Access Flow.fig', type: 'UX deliverable', meta: 'Version 3', action: 'Live' },
                { id: 'file-sterling-3', name: 'Invoice 1002.pdf', type: 'Billing', meta: 'Ready after approval', action: 'Prepared' },
                { id: 'file-sterling-4', name: 'Copy Notes.docx', type: 'Content', meta: 'Client editable', action: 'Tracked' }
            ],
            invoices: [
                { id: 'inv-1001', title: 'Discovery + strategy deposit', amount: 1500, status: 'paid', note: 'Paid on April 04, 2026' },
                { id: 'inv-1002', title: 'Design + development milestone', amount: 1250, status: 'open', note: 'Due after current feedback round is approved' },
                { id: 'inv-1003', title: 'Launch + transition handoff', amount: 950, status: 'scheduled', note: 'Queued for release after launch approval' }
            ]
        },
        {
            id: 'client-glow',
            company: 'Glow Medical Aesthetics',
            contactName: 'Maya Brooks',
            email: 'glow@architechclients.com',
            accessKey: 'ARCHI-3421',
            service: 'Signature Website',
            projectName: 'Glow Medical Aesthetics Conversion Website',
            status: 'Launch prep',
            nextReview: 'April 15, 2026',
            launchTarget: 'April 18, 2026',
            currentPhase: 'QA, booking flow testing, and launch sequencing',
            progress: 92,
            owner: 'QA + launch',
            summaryTitle: 'Launch preparation is nearly complete.',
            summaryText: 'Final conversion checks, booking flow validation, and launch-day routing are being finalized inside the project workspace.',
            nextActions: [
                'Approve launch-day contact routing',
                'Confirm team access for lead notifications',
                'Review post-launch optimization retainer'
            ],
            timeline: [
                { id: 'timeline-glow-1', date: 'March 29', title: 'Brand direction approved', body: 'The visual direction, tone, and lead-generation structure were signed off.', state: 'complete' },
                { id: 'timeline-glow-2', date: 'April 05', title: 'Homepage and service pages built', body: 'Core templates and premium mobile interactions were completed.', state: 'complete' },
                { id: 'timeline-glow-3', date: 'Now', title: 'Launch sequencing and QA', body: 'Final testing is underway before domain cutover and handoff.', state: 'current' },
                { id: 'timeline-glow-4', date: 'Next', title: 'Launch support window', body: 'Monitor leads, forms, and traffic after release.', state: 'upcoming' }
            ],
            messages: [
                { id: 'msg-glow-1', sender: 'Architech', role: 'team', time: 'Yesterday - 4:10 PM', body: 'The booking flow passed another QA round. We are preparing the launch checklist and handoff packet.' },
                { id: 'msg-glow-2', sender: 'Maya Brooks', role: 'client', time: 'Yesterday - 5:32 PM', body: 'Perfect. Please keep the patient intake steps feeling as simple as possible on mobile.' }
            ],
            files: [
                { id: 'file-glow-1', name: 'Launch Checklist.pdf', type: 'Launch pack', meta: 'Ready for review', action: 'Shared' },
                { id: 'file-glow-2', name: 'Before-After Gallery.zip', type: 'Asset bundle', meta: 'Latest upload', action: 'Tracked' }
            ],
            invoices: [
                { id: 'inv-2101', title: 'Design + strategy deposit', amount: 2200, status: 'paid', note: 'Paid on April 08, 2026' },
                { id: 'inv-2102', title: 'Launch support retainer', amount: 680, status: 'scheduled', note: 'Scheduled for April 18, 2026' }
            ]
        },
        {
            id: 'client-apex',
            company: 'Apex HVAC',
            contactName: 'Chris Walker',
            email: 'ops@apexhvacdemo.com',
            accessKey: 'ARCHI-5084',
            service: 'Custom Software Build',
            projectName: 'Apex HVAC Quote Routing + Service Logic',
            status: 'Awaiting input',
            nextReview: 'April 16, 2026',
            launchTarget: 'May 06, 2026',
            currentPhase: 'Routing logic and service-area workflow build',
            progress: 64,
            owner: 'Systems layer',
            summaryTitle: 'Core systems are in progress while intake details are being finalized.',
            summaryText: 'The quote-routing layer is under active development. A few service-area and dispatch rules still need confirmation before the final workflow can be locked.',
            nextActions: [
                'Confirm final dispatch zones',
                'Review quote-request branching rules',
                'Approve field label updates for the intake flow'
            ],
            timeline: [
                { id: 'timeline-apex-1', date: 'April 01', title: 'Systems map approved', body: 'Lead routing, dispatch territories, and automation goals were defined.', state: 'complete' },
                { id: 'timeline-apex-2', date: 'April 09', title: 'Quote logic implementation started', body: 'Conditional pathways and service-area rules are being wired into the workflow.', state: 'current' },
                { id: 'timeline-apex-3', date: 'Next', title: 'Client rule review', body: 'Validate edge cases before the internal ops release.', state: 'upcoming' }
            ],
            messages: [
                { id: 'msg-apex-1', sender: 'Architech', role: 'team', time: 'Today - 8:25 AM', body: 'We have the routing model in place. We just need confirmation on the outer service areas before the final test pass.' }
            ],
            files: [
                { id: 'file-apex-1', name: 'Routing Logic Spec.pdf', type: 'Systems spec', meta: 'Shared this morning', action: 'Shared' }
            ],
            invoices: [
                { id: 'inv-3101', title: 'Systems architecture deposit', amount: 1800, status: 'paid', note: 'Paid on April 02, 2026' },
                { id: 'inv-3102', title: 'Workflow implementation milestone', amount: 1400, status: 'open', note: 'Open while dispatch rules are reviewed' }
            ]
        }
    ],
    leads: [
        { id: 'lead-1', name: 'Maya Patel', company: 'Northline Medspa', service: 'Growth System', value: 6200, stage: 'New Inquiry', source: 'Website form', next: 'Qualify service scope' },
        { id: 'lead-2', name: 'James Carter', company: 'Sterling Tax Group', service: 'Signature Website', value: 2800, stage: 'Qualified', source: 'Referral', next: 'Book strategy call' },
        { id: 'lead-3', name: 'Olivia Brooks', company: 'Summit Wellness', service: 'Custom Software Build', value: 9400, stage: 'Proposal Sent', source: 'Discovery call', next: 'Follow up on proposal' },
        { id: 'lead-4', name: 'Avery Chen', company: 'Harbor Legal', service: 'Growth System', value: 3000, stage: 'Won', source: 'Existing client', next: 'Kickoff scheduling' }
    ],
    consults: [
        { id: 'consult-1', name: 'Northline Medspa', date: 'Tomorrow - 11:00 AM', status: 'Confirmed', note: 'Review lead-gen architecture and booking flow.' },
        { id: 'consult-2', name: 'Harbor Legal', date: 'Friday - 2:30 PM', status: 'Awaiting intake', note: 'Waiting on brand assets and target geography.' },
        { id: 'consult-3', name: 'Summit Wellness', date: 'Monday - 9:00 AM', status: 'Proposal review', note: 'Walk through portal and workflow integration roadmap.' }
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    const app = document.body.dataset.app;

    if (app === 'portal') {
        initPortalWorkspace();
    }

    if (app === 'login') {
        initClientLoginWorkspace();
    }

    if (app === 'ops') {
        initOpsWorkspace();
    }
});

function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    }).format(value);
}

function formatNowLabel() {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    }).format(new Date());
}

function createId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function createAccessKey(company) {
    const seed = String(company || 'ARCHI')
        .replace(/[^A-Za-z]/g, '')
        .toUpperCase()
        .slice(0, 5) || 'ARCHI';
    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    return `${seed}-${suffix}`;
}

function getStatusPillClass(label) {
    const value = String(label || '').toLowerCase();

    if (value.includes('track') || value.includes('launch') || value.includes('approved')) {
        return 'success';
    }

    if (value.includes('review') || value.includes('awaiting') || value.includes('input')) {
        return 'warning';
    }

    return '';
}

function getInvoiceStatusLabel(status) {
    if (status === 'paid') {
        return 'Paid';
    }

    if (status === 'open') {
        return 'Open';
    }

    return 'Scheduled';
}

function getClientById(data, clientId) {
    return data.clients.find((client) => client.id === clientId) || data.clients[0] || null;
}

function getOpenInvoices(client) {
    return client.invoices.filter((invoice) => invoice.status === 'open');
}

function getScheduledInvoices(client) {
    return client.invoices.filter((invoice) => invoice.status === 'scheduled');
}

function getPaidInvoices(client) {
    return client.invoices.filter((invoice) => invoice.status === 'paid');
}

function normalizeClient(client) {
    return {
        ...client,
        nextActions: Array.isArray(client.nextActions) ? client.nextActions : [],
        timeline: Array.isArray(client.timeline) ? client.timeline : [],
        messages: Array.isArray(client.messages) ? client.messages : [],
        files: Array.isArray(client.files) ? client.files : [],
        invoices: Array.isArray(client.invoices) ? client.invoices : []
    };
}

function normalizeWorkspaceData(data) {
    const fallback = cloneData(WorkspaceSeed);
    const source = data && typeof data === 'object' ? data : fallback;

    return {
        clients: Array.isArray(source.clients) && source.clients.length
            ? source.clients.map(normalizeClient)
            : fallback.clients.map(normalizeClient),
        leads: Array.isArray(source.leads) ? source.leads : fallback.leads,
        consults: Array.isArray(source.consults) ? source.consults : fallback.consults
    };
}

function buildInitialWorkspaceData() {
    const data = cloneData(WorkspaceSeed);
    const legacyMessages = WorkspaceStorage.read('architech.portal.messages', null);
    const legacyFiles = WorkspaceStorage.read('architech.portal.files', null);
    const legacyInvoices = WorkspaceStorage.read('architech.portal.invoices', null);
    const legacyLeads = WorkspaceStorage.read('architech.ops.leads', null);
    const legacyConsults = WorkspaceStorage.read('architech.ops.consults', null);

    if (Array.isArray(legacyMessages) && legacyMessages.length) {
        data.clients[0].messages = legacyMessages;
    }

    if (Array.isArray(legacyFiles) && legacyFiles.length) {
        data.clients[0].files = legacyFiles;
    }

    if (Array.isArray(legacyInvoices) && legacyInvoices.length) {
        data.clients[0].invoices = legacyInvoices;
    }

    if (Array.isArray(legacyLeads) && legacyLeads.length) {
        data.leads = legacyLeads;
    }

    if (Array.isArray(legacyConsults) && legacyConsults.length) {
        data.consults = legacyConsults;
    }

    return data;
}

function loadWorkspaceData() {
    const data = WorkspaceStorage.read(STORAGE_KEYS.data, null) || buildInitialWorkspaceData();
    return normalizeWorkspaceData(data);
}

function saveWorkspaceData(data) {
    WorkspaceStorage.write(STORAGE_KEYS.data, normalizeWorkspaceData(data));
}

function loadPortalSession() {
    return WorkspaceStorage.read(STORAGE_KEYS.session, null);
}

function setPortalSession(clientId) {
    WorkspaceStorage.write(STORAGE_KEYS.session, { clientId });
}

function clearPortalSession() {
    localStorage.removeItem(STORAGE_KEYS.session);
}

function loadSelectedClientId() {
    return localStorage.getItem(STORAGE_KEYS.selectedClientId);
}

function setSelectedClientId(clientId) {
    localStorage.setItem(STORAGE_KEYS.selectedClientId, clientId);
}

function renderMessageThread(thread, messages) {
    if (!thread) {
        return;
    }

    thread.innerHTML = messages.map((message) => `
        <article class="workspace-message ${escapeHtml(message.role)}">
            <div class="workspace-message-meta">
                <strong>${escapeHtml(message.sender)}</strong>
                <span>${escapeHtml(message.time)}</span>
            </div>
            <p>${escapeHtml(message.body)}</p>
        </article>
    `).join('');

    thread.scrollTop = thread.scrollHeight;
}

function renderFileCards(container, files) {
    if (!container) {
        return;
    }

    container.innerHTML = files.map((file) => `
        <article class="workspace-file-card">
            <span class="workspace-file-type">${escapeHtml(file.type)}</span>
            <h3>${escapeHtml(file.name)}</h3>
            <p>${escapeHtml(file.meta)}</p>
            <span class="workspace-pill">${escapeHtml(file.action || 'Tracked')}</span>
        </article>
    `).join('');
}

function initWorkspaceTabs(root = document) {
    const buttons = root.querySelectorAll('.workspace-nav-button');
    const views = root.querySelectorAll('.workspace-view');

    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.workspaceTab;

            buttons.forEach((item) => item.classList.toggle('active', item === button));
            views.forEach((view) => view.classList.toggle('active', view.id === targetId));
        });
    });
}

function initPortalWorkspace() {
    const authShell = document.getElementById('portalAuthShell');
    const appShell = document.getElementById('portalAppShell');
    const authForm = document.getElementById('portalAuthForm');
    const demoFill = document.getElementById('portalDemoFill');
    const authNote = document.getElementById('portalAuthNote');
    const demoAccounts = document.getElementById('portalDemoAccounts');
    const logoutButton = document.getElementById('portalLogout');
    const messageThread = document.getElementById('portalMessageThread');
    const messageForm = document.getElementById('portalMessageForm');
    const messageInput = document.getElementById('portalMessageInput');
    const fileList = document.getElementById('portalFileList');
    const uploadInput = document.getElementById('portalUploadInput');
    const invoiceGrid = document.getElementById('portalInvoiceGrid');
    const invoiceSummary = document.getElementById('portalInvoiceSummary');
    const modal = document.getElementById('portalInvoiceModal');
    const modalBody = document.getElementById('portalInvoiceModalBody');
    const modalClose = document.getElementById('portalInvoiceModalClose');
    const modalConfirm = document.getElementById('portalInvoiceConfirm');

    const previewTitle = document.getElementById('portalPreviewTitle');
    const previewText = document.getElementById('portalPreviewText');
    const previewMetrics = document.getElementById('portalPreviewMetrics');
    const previewList = document.getElementById('portalPreviewList');

    const clientName = document.getElementById('portalClientName');
    const clientEmail = document.getElementById('portalClientEmail');
    const clientMeta = document.getElementById('portalClientMeta');
    const projectTitle = document.getElementById('portalProjectTitle');
    const toolbarMeta = document.getElementById('portalToolbarMeta');
    const overviewMetrics = document.getElementById('portalOverviewMetrics');
    const summaryTitle = document.getElementById('portalSummaryTitle');
    const summaryText = document.getElementById('portalSummaryText');
    const nextActions = document.getElementById('portalNextActions');
    const timelineList = document.getElementById('portalTimelineList');

    const state = {
        data: loadWorkspaceData(),
        session: loadPortalSession(),
        pendingInvoiceId: null,
        previewClientId: loadPortalSession()?.clientId || loadWorkspaceData().clients[0]?.id || null
    };

    initWorkspaceTabs(document);
    setPortalNote();
    renderPortal();

    demoFill?.addEventListener('click', () => {
        const client = getClientById(state.data, state.previewClientId);

        if (!client) {
            return;
        }

        document.getElementById('portalEmail').value = client.email;
        document.getElementById('portalKey').value = client.accessKey;
    });

    authForm?.addEventListener('submit', (event) => {
        event.preventDefault();

        const email = document.getElementById('portalEmail').value.trim().toLowerCase();
        const key = document.getElementById('portalKey').value.trim().toUpperCase();
        const client = state.data.clients.find((item) => item.email.toLowerCase() === email && item.accessKey.toUpperCase() === key);

        if (!client) {
            setPortalNote('Use one of the available client accounts below. Email and access key must match an active workspace.', false);
            return;
        }

        state.session = { clientId: client.id };
        state.previewClientId = client.id;
        setPortalSession(client.id);
        setPortalNote(`Access granted for ${client.company}. Opening your private workspace.`, true);
        renderPortal();
    });

    demoAccounts?.addEventListener('click', (event) => {
        const previewButton = event.target.closest('[data-preview-client]');
        const useButton = event.target.closest('[data-use-client]');
        const clientId = useButton?.dataset.useClient || previewButton?.dataset.previewClient;

        if (!clientId) {
            return;
        }

        const client = getClientById(state.data, clientId);
        state.previewClientId = clientId;

        if (client && useButton) {
            document.getElementById('portalEmail').value = client.email;
            document.getElementById('portalKey').value = client.accessKey;
            setPortalNote(`Previewing ${client.company}. Credentials are ready to use.`, true);
        } else {
            setPortalNote();
        }

        renderPortal();
    });

    logoutButton?.addEventListener('click', () => {
        state.session = null;
        clearPortalSession();
        setPortalNote();
        renderPortal();
        window.location.href = 'client-login.html';
    });

    messageForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        const client = getActivePortalClient();
        const body = messageInput.value.trim();

        if (!client || !body) {
            return;
        }

        client.messages.push({
            id: createId('msg'),
            sender: client.contactName,
            role: 'client',
            time: formatNowLabel(),
            body
        });

        persistPortalData();
        messageInput.value = '';
        renderPortalWorkspace(client);
        renderPortalPreview(client);
    });

    uploadInput?.addEventListener('change', () => {
        const client = getActivePortalClient();
        const uploads = Array.from(uploadInput.files || []).map((file) => ({
            id: createId('file'),
            name: file.name,
            type: 'Uploaded asset',
            meta: `Uploaded ${formatNowLabel()}`,
            action: 'Queued'
        }));

        if (!client || uploads.length === 0) {
            return;
        }

        client.files = [...uploads, ...client.files];
        persistPortalData();
        renderPortalWorkspace(client);
        renderPortalPreview(client);
        uploadInput.value = '';
    });

    invoiceGrid?.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-pay-invoice]');
        const client = getActivePortalClient();

        if (!trigger || !client) {
            return;
        }

        const invoice = client.invoices.find((item) => item.id === trigger.dataset.payInvoice);

        if (!invoice || !modal) {
            return;
        }

        state.pendingInvoiceId = invoice.id;
        modalBody.textContent = `Confirm payment for ${invoice.title} (${formatCurrency(invoice.amount)}).`;
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
    });

    modalConfirm?.addEventListener('click', () => {
        const client = getActivePortalClient();
        const invoice = client?.invoices.find((item) => item.id === state.pendingInvoiceId);

        if (!client || !invoice) {
            return;
        }

        invoice.status = 'paid';
        invoice.note = `Paid ${formatNowLabel()}`;
        persistPortalData();
        closePortalModal();
        renderPortalWorkspace(client);
        renderPortalPreview(client);
    });

    document.querySelectorAll('[data-close-portal-modal]').forEach((button) => {
        button.addEventListener('click', closePortalModal);
    });
    modalClose?.addEventListener('click', closePortalModal);

    window.addEventListener('storage', (event) => {
        if (![STORAGE_KEYS.data, STORAGE_KEYS.session].includes(event.key)) {
            return;
        }

        state.data = loadWorkspaceData();
        state.session = loadPortalSession();
        state.previewClientId = getClientById(state.data, state.previewClientId)?.id || state.data.clients[0]?.id || null;
        renderPortal();
    });

    function getActivePortalClient() {
        return getClientById(state.data, state.session?.clientId);
    }

    function persistPortalData() {
        saveWorkspaceData(state.data);
    }

    function closePortalModal() {
        modal?.classList.remove('active');
        modal?.setAttribute('aria-hidden', 'true');
        state.pendingInvoiceId = null;
    }

    function setPortalNote(message, success = false) {
        if (!authNote) {
            return;
        }

        const previewClient = getClientById(state.data, state.previewClientId);

        if (message) {
            authNote.textContent = message;
            authNote.classList.toggle('success', success);
            return;
        }

        if (!previewClient) {
            authNote.textContent = 'Client access is unavailable.';
            authNote.classList.remove('success');
            return;
        }

        authNote.innerHTML = `Demo access: <code>${escapeHtml(previewClient.email)}</code> with key <code>${escapeHtml(previewClient.accessKey)}</code>.`;
        authNote.classList.remove('success');
    }

    function renderPortal() {
        const activeClient = getActivePortalClient();
        const previewClient = getClientById(state.data, activeClient?.id || state.previewClientId);

        document.body.classList.toggle('portal-authenticated', Boolean(activeClient));
        authShell?.classList.toggle('is-hidden', Boolean(activeClient));
        appShell?.classList.toggle('is-hidden', !activeClient);

        renderDemoAccounts(activeClient?.id || null);
        renderPortalPreview(previewClient);

        if (activeClient) {
            renderPortalWorkspace(activeClient);
        }
    }

    function renderDemoAccounts(activeClientId) {
        if (!demoAccounts) {
            return;
        }

        demoAccounts.innerHTML = state.data.clients.map((client) => `
            <article class="portal-access-account ${client.id === state.previewClientId ? 'active' : ''}">
                <button type="button" class="portal-access-account-hit" data-preview-client="${escapeHtml(client.id)}" aria-label="Preview ${escapeHtml(client.company)}"></button>
                <div class="portal-access-account-top">
                    <div>
                        <strong>${escapeHtml(client.company)}</strong>
                        <p>${escapeHtml(client.contactName)} | ${escapeHtml(client.service)}</p>
                    </div>
                    <span class="workspace-pill ${getStatusPillClass(client.status)}">${escapeHtml(client.status)}</span>
                </div>
                <div class="portal-access-account-credentials">
                    <span><strong>Email</strong>${escapeHtml(client.email)}</span>
                    <span><strong>Key</strong>${escapeHtml(client.accessKey)}</span>
                </div>
                <button type="button" class="btn ${client.id === activeClientId ? 'btn-primary' : 'btn-outline'} btn-sm" data-use-client="${escapeHtml(client.id)}">${client.id === activeClientId ? 'Opened' : 'Use Account'}</button>
            </article>
        `).join('');
    }

    function renderPortalPreview(client) {
        if (!client) {
            return;
        }

        const openInvoices = getOpenInvoices(client).length;
        const scheduledInvoices = getScheduledInvoices(client).length;

        previewTitle.textContent = `${client.company} Demo Portal preview`;
        previewText.textContent = `A premium workspace for ${client.service.toLowerCase()} delivery, invoice visibility, shared files, and direct communication with ${client.contactName}.`;
        previewMetrics.innerHTML = `
            <article>
                <span>Milestone</span>
                <strong>${escapeHtml(client.currentPhase)}</strong>
            </article>
            <article>
                <span>Outstanding</span>
                <strong>${openInvoices} open / ${scheduledInvoices} scheduled</strong>
            </article>
            <article>
                <span>Files</span>
                <strong>${client.files.length} shared items</strong>
            </article>
        `;
        previewList.innerHTML = [
            `${client.progress}% progress visibility inside the workspace`,
            `${client.messages.length} saved conversation updates`,
            `${client.files.length} organized files and reference items`,
            openInvoices ? `${openInvoices} invoice${openInvoices === 1 ? '' : 's'} ready for payment review` : 'No open invoices at the moment'
        ].map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    }

    function renderPortalWorkspace(client) {
        const openInvoices = getOpenInvoices(client);
        const scheduledInvoices = getScheduledInvoices(client);
        const paidInvoices = getPaidInvoices(client);
        const nextInvoice = openInvoices[0] || scheduledInvoices[0];

        clientName.textContent = client.company;
        clientEmail.textContent = client.email;
        clientMeta.textContent = `${client.contactName} | ${client.service}`;
        projectTitle.textContent = client.projectName;
        toolbarMeta.innerHTML = `
            <span class="workspace-pill ${getStatusPillClass(client.status)}">${escapeHtml(client.status)}</span>
            <span class="workspace-pill">Next review ${escapeHtml(client.nextReview)}</span>
        `;
        overviewMetrics.innerHTML = `
            <article class="workspace-kpi-card">
                <span>Current phase</span>
                <strong>${escapeHtml(client.currentPhase)}</strong>
            </article>
            <article class="workspace-kpi-card">
                <span>Next invoice</span>
                <strong>${nextInvoice ? `${formatCurrency(nextInvoice.amount)} ${getInvoiceStatusLabel(nextInvoice.status).toLowerCase()}` : 'All invoices current'}</strong>
            </article>
            <article class="workspace-kpi-card">
                <span>Open items</span>
                <strong>${client.nextActions.length} tracked client actions</strong>
            </article>
            <article class="workspace-kpi-card">
                <span>Launch target</span>
                <strong>${escapeHtml(client.launchTarget)}</strong>
            </article>
        `;
        summaryTitle.textContent = client.summaryTitle;
        summaryText.textContent = client.summaryText;
        nextActions.innerHTML = client.nextActions.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
        timelineList.innerHTML = client.timeline.map((item) => `
            <article class="workspace-timeline-item ${escapeHtml(item.state || '')}">
                <span class="workspace-timeline-date">${escapeHtml(item.date)}</span>
                <div>
                    <h3>${escapeHtml(item.title)}</h3>
                    <p>${escapeHtml(item.body)}</p>
                </div>
            </article>
        `).join('');
        invoiceSummary.textContent = `${paidInvoices.length} paid / ${openInvoices.length} open / ${scheduledInvoices.length} scheduled`;
        invoiceGrid.innerHTML = client.invoices.map((invoice) => {
            const statusClass = invoice.status === 'paid' ? 'paid' : invoice.status === 'open' ? 'open' : 'upcoming';
            const pillClass = invoice.status === 'paid' ? 'success' : invoice.status === 'open' ? 'warning' : '';
            const label = getInvoiceStatusLabel(invoice.status);
            const action = invoice.status === 'open'
                ? `<button type="button" class="btn btn-primary btn-sm" data-pay-invoice="${escapeHtml(invoice.id)}">Pay Invoice</button>`
                : `<button type="button" class="btn btn-outline btn-sm" disabled>${escapeHtml(label)}</button>`;

            return `
                <article class="invoice-card ${statusClass}" data-invoice-id="${escapeHtml(invoice.id)}">
                    <div class="invoice-card-head">
                        <div>
                            <span>${escapeHtml(invoice.id.replace('inv-', 'Invoice '))}</span>
                            <strong>${escapeHtml(invoice.title)}</strong>
                        </div>
                        <span class="workspace-pill ${pillClass}">${escapeHtml(label)}</span>
                    </div>
                    <p>${escapeHtml(invoice.note)}</p>
                    <div class="invoice-card-foot">
                        <strong>${formatCurrency(invoice.amount)}</strong>
                        ${action}
                    </div>
                </article>
            `;
        }).join('');
        renderMessageThread(messageThread, client.messages);
        renderFileCards(fileList, client.files);
    }
}

function initClientLoginWorkspace() {
    const loginForm = document.getElementById('loginForm');
    const loginStatus = document.getElementById('loginStatus');
    const demoFillButton = document.getElementById('loginDemoFill');
    const rememberCheckbox = document.getElementById('remember');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const data = loadWorkspaceData();
    const session = loadPortalSession();
    const activeClient = getClientById(data, session?.clientId);

    function setStatus(message, success = false) {
        if (!loginStatus) {
            return;
        }

        loginStatus.textContent = message;
        loginStatus.classList.toggle('success', success);
    }

    function fillClient(client) {
        if (!client || !emailInput || !passwordInput) {
            return;
        }

        emailInput.value = client.email;
        passwordInput.value = client.accessKey;
    }

    const fallbackClient = getClientById(data, loadSelectedClientId()) || data.clients[0];

    if (activeClient) {
        setSelectedClientId(activeClient.id);
        fillClient(activeClient);
        setStatus(`You're already signed in for ${activeClient.company}. Use the form below to re-enter the Demo Portal or switch accounts.`, true);
    }

    demoFillButton?.addEventListener('click', () => {
        fillClient(fallbackClient);
        setStatus(`Demo credentials loaded for ${fallbackClient.company}.`, true);
    });

    loginForm?.addEventListener('submit', (event) => {
        event.preventDefault();

        const email = emailInput?.value.trim().toLowerCase();
        const accessKey = passwordInput?.value.trim().toUpperCase();
        const client = data.clients.find((item) => item.email.toLowerCase() === email && item.accessKey.toUpperCase() === accessKey);

        if (!client) {
            setStatus('The email and access key do not match an active workspace. Use valid client credentials to continue.', false);
            return;
        }

        if (rememberCheckbox?.checked) {
            setSelectedClientId(client.id);
        }

        setPortalSession(client.id);
        setSelectedClientId(client.id);
        setStatus(`Access granted for ${client.company}. Redirecting to the Demo Portal.`, true);
        window.setTimeout(() => {
            window.location.href = 'client-portal.html';
        }, 220);
    });
}

function initOpsWorkspace() {
    const leadForm = document.getElementById('opsLeadForm');
    const pipelineBoard = document.getElementById('opsPipelineBoard');
    const consultList = document.getElementById('opsConsultList');
    const projectList = document.getElementById('opsProjectList');
    const financeList = document.getElementById('opsFinanceList');

    const metricLeads = document.getElementById('opsMetricNewLeads');
    const metricConsults = document.getElementById('opsMetricConsults');
    const metricProjects = document.getElementById('opsMetricProjects');
    const metricRevenue = document.getElementById('opsMetricRevenue');

    const clientList = document.getElementById('opsClientList');
    const clientSummary = document.getElementById('opsClientSummary');
    const clientThread = document.getElementById('opsClientThread');
    const clientMessageForm = document.getElementById('opsClientMessageForm');
    const clientMessageInput = document.getElementById('opsClientMessageInput');
    const clientFileForm = document.getElementById('opsClientFileForm');
    const clientFileName = document.getElementById('opsClientFileName');
    const clientFileType = document.getElementById('opsClientFileType');
    const clientInvoiceForm = document.getElementById('opsClientInvoiceForm');
    const clientInvoiceTitle = document.getElementById('opsClientInvoiceTitle');
    const clientInvoiceAmount = document.getElementById('opsClientInvoiceAmount');
    const clientInvoiceStatus = document.getElementById('opsClientInvoiceStatus');
    const clientForm = document.getElementById('opsClientForm');
    const clientFormNote = document.getElementById('opsClientFormNote');

    const state = {
        data: loadWorkspaceData(),
        selectedClientId: loadSelectedClientId() || loadWorkspaceData().clients[0]?.id || null
    };

    const stages = ['New Inquiry', 'Qualified', 'Proposal Sent', 'Won'];

    initWorkspaceTabs(document);
    renderAll();

    leadForm?.addEventListener('submit', (event) => {
        event.preventDefault();

        const name = document.getElementById('opsLeadName').value.trim();

        if (!name) {
            return;
        }

        state.data.leads.unshift({
            id: createId('lead'),
            name,
            company: document.getElementById('opsLeadCompany').value.trim() || 'New prospect',
            service: document.getElementById('opsLeadService').value,
            value: Number(document.getElementById('opsLeadValue').value || 0),
            stage: 'New Inquiry',
            source: 'Manual entry',
            next: 'Send follow-up within 24 hours'
        });

        persistOpsData();
        leadForm.reset();
        renderAll();
    });

    pipelineBoard?.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-advance-lead]');

        if (!trigger) {
            return;
        }

        const lead = state.data.leads.find((item) => item.id === trigger.dataset.advanceLead);

        if (!lead) {
            return;
        }

        const currentIndex = stages.indexOf(lead.stage);
        lead.stage = stages[Math.min(currentIndex + 1, stages.length - 1)];
        lead.next = lead.stage === 'Won' ? 'Prepare kickoff plan' : 'Advance to next touchpoint';
        persistOpsData();
        renderAll();
    });

    clientList?.addEventListener('click', (event) => {
        const selectTrigger = event.target.closest('[data-select-client]');
        const openTrigger = event.target.closest('[data-open-portal-as]');
        const clientId = selectTrigger?.dataset.selectClient || openTrigger?.dataset.openPortalAs;

        if (!clientId) {
            return;
        }

        if (openTrigger) {
            openPortalAsClient(clientId);
            return;
        }

        state.selectedClientId = clientId;
        setSelectedClientId(clientId);
        renderClientDesk();
    });

    clientSummary?.addEventListener('click', (event) => {
        const openTrigger = event.target.closest('[data-open-portal-as]');

        if (!openTrigger) {
            return;
        }

        openPortalAsClient(openTrigger.dataset.openPortalAs);
    });

    clientMessageForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        const client = getActiveOpsClient();
        const body = clientMessageInput.value.trim();

        if (!client || !body) {
            return;
        }

        client.messages.push({
            id: createId('msg'),
            sender: 'Architech',
            role: 'team',
            time: formatNowLabel(),
            body
        });

        persistOpsData();
        clientMessageInput.value = '';
        renderClientDesk();
    });

    clientFileForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        const client = getActiveOpsClient();
        const name = clientFileName.value.trim();

        if (!client || !name) {
            return;
        }

        client.files.unshift({
            id: createId('file'),
            name,
            type: clientFileType.value.trim() || 'Shared file',
            meta: `Shared ${formatNowLabel()}`,
            action: 'Shared'
        });

        persistOpsData();
        clientFileForm.reset();
        renderClientDesk();
    });

    clientInvoiceForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        const client = getActiveOpsClient();
        const title = clientInvoiceTitle.value.trim();
        const amount = Number(clientInvoiceAmount.value || 0);
        const status = clientInvoiceStatus.value;

        if (!client || !title || !amount) {
            return;
        }

        client.invoices.unshift({
            id: createId('inv'),
            title,
            amount,
            status,
            note: status === 'open' ? 'Ready for payment review' : `Scheduled ${formatNowLabel()}`
        });

        persistOpsData();
        clientInvoiceForm.reset();
        renderAll();
    });

    clientForm?.addEventListener('submit', (event) => {
        event.preventDefault();

        const company = document.getElementById('opsClientCompany').value.trim();
        const contactName = document.getElementById('opsClientContact').value.trim();
        const email = document.getElementById('opsClientEmail').value.trim().toLowerCase();
        const service = document.getElementById('opsClientService').value;
        const projectName = document.getElementById('opsClientProject').value.trim();

        if (!company || !contactName || !email || !projectName) {
            return;
        }

        const accessKey = createAccessKey(company);
        const clientId = createId('client');

        state.data.clients.unshift({
            id: clientId,
            company,
            contactName,
            email,
            accessKey,
            service,
            projectName,
            status: 'On track',
            nextReview: 'To be scheduled',
            launchTarget: 'Set after kickoff',
            currentPhase: 'Kickoff preparation and workspace setup',
            progress: 12,
            owner: 'Strategy + onboarding',
            summaryTitle: 'Client workspace created and ready for onboarding.',
            summaryText: 'This account is now active in the portal. Messages, files, invoices, and milestone updates can be managed from the client desk immediately.',
            nextActions: [
                'Send kickoff agenda',
                'Collect brand and content inputs',
                'Confirm next review date'
            ],
            timeline: [
                { id: createId('timeline'), date: 'Today', title: 'Portal access created', body: 'Client credentials were generated and the private workspace is ready.', state: 'complete' },
                { id: createId('timeline'), date: 'Next', title: 'Kickoff and discovery review', body: 'Align scope, priorities, and timeline for the engagement.', state: 'current' }
            ],
            messages: [
                { id: createId('msg'), sender: 'Architech', role: 'team', time: formatNowLabel(), body: `Welcome to your Architech workspace, ${contactName}. We will use this portal for status updates, files, invoices, and next steps.` }
            ],
            files: [],
            invoices: []
        });

        state.selectedClientId = clientId;
        setSelectedClientId(clientId);
        persistOpsData();
        clientForm.reset();

        if (clientFormNote) {
            clientFormNote.innerHTML = `Access created for <strong>${escapeHtml(company)}</strong>. Email: <code>${escapeHtml(email)}</code> Key: <code>${escapeHtml(accessKey)}</code>.`;
        }

        renderAll();
    });

    window.addEventListener('storage', (event) => {
        if (![STORAGE_KEYS.data, STORAGE_KEYS.selectedClientId].includes(event.key)) {
            return;
        }

        state.data = loadWorkspaceData();
        state.selectedClientId = getClientById(state.data, loadSelectedClientId())?.id || state.data.clients[0]?.id || null;
        renderAll();
    });

    function getActiveOpsClient() {
        return getClientById(state.data, state.selectedClientId);
    }

    function persistOpsData() {
        saveWorkspaceData(state.data);
    }

    function getProjects() {
        return state.data.clients.map((client) => ({
            id: client.id,
            client: client.company,
            stage: client.currentPhase,
            progress: client.progress,
            owner: client.owner,
            note: client.summaryText
        }));
    }

    function getFinanceItems() {
        return state.data.clients.flatMap((client) => client.invoices.map((invoice) => ({
            id: invoice.id,
            client: client.company,
            amount: invoice.amount,
            status: getInvoiceStatusLabel(invoice.status),
            note: invoice.note
        })));
    }

    function openPortalAsClient(clientId) {
        setPortalSession(clientId);
        window.location.href = 'client-portal.html';
    }

    function renderAll() {
        renderMetrics();
        renderPipeline();
        renderConsults();
        renderProjects();
        renderFinance();
        renderClientDesk();
    }

    function renderMetrics() {
        const openRevenue = state.data.clients
            .flatMap((client) => client.invoices)
            .filter((invoice) => invoice.status === 'open' || invoice.status === 'scheduled')
            .reduce((sum, invoice) => sum + invoice.amount, 0);

        metricLeads.textContent = `${state.data.leads.filter((lead) => lead.stage === 'New Inquiry').length} this week`;
        metricConsults.textContent = `${state.data.consults.length} scheduled`;
        metricProjects.textContent = `${state.data.clients.length} active builds`;
        metricRevenue.textContent = `${formatCurrency(openRevenue)} outstanding`;
    }

    function renderPipeline() {
        if (!pipelineBoard) {
            return;
        }

        pipelineBoard.innerHTML = stages.map((stage) => {
            const items = state.data.leads.filter((lead) => lead.stage === stage);

            return `
                <section class="ops-stage-column">
                    <div class="ops-stage-head">
                        <h3>${escapeHtml(stage)}</h3>
                        <span>${items.length}</span>
                    </div>
                    <div class="ops-stage-stack">
                        ${items.map((lead) => `
                            <article class="ops-lead-card">
                                <span class="ops-lead-service">${escapeHtml(lead.service)}</span>
                                <h4>${escapeHtml(lead.name)}</h4>
                                <p>${escapeHtml(lead.company)}</p>
                                <div class="ops-lead-meta">
                                    <span>${formatCurrency(lead.value)}</span>
                                    <span>${escapeHtml(lead.source)}</span>
                                </div>
                                <strong>${escapeHtml(lead.next)}</strong>
                                <button type="button" class="btn btn-outline btn-sm" data-advance-lead="${escapeHtml(lead.id)}">${stage === 'Won' ? 'Closed' : 'Advance Stage'}</button>
                            </article>
                        `).join('')}
                    </div>
                </section>
            `;
        }).join('');
    }

    function renderConsults() {
        if (!consultList) {
            return;
        }

        consultList.innerHTML = state.data.consults.map((consult) => `
            <article class="workspace-data-card">
                <div class="workspace-data-card-head">
                    <div>
                        <span>${escapeHtml(consult.status)}</span>
                        <h3>${escapeHtml(consult.name)}</h3>
                    </div>
                    <span class="workspace-pill">${escapeHtml(consult.date)}</span>
                </div>
                <p>${escapeHtml(consult.note)}</p>
            </article>
        `).join('');
    }

    function renderProjects() {
        if (!projectList) {
            return;
        }

        projectList.innerHTML = getProjects().map((project) => `
            <article class="workspace-data-card">
                <div class="workspace-data-card-head">
                    <div>
                        <span>${escapeHtml(project.stage)}</span>
                        <h3>${escapeHtml(project.client)}</h3>
                    </div>
                    <span class="workspace-pill success">${escapeHtml(project.progress)}%</span>
                </div>
                <div class="workspace-progress">
                    <div class="workspace-progress-bar">
                        <span style="width: ${project.progress}%"></span>
                    </div>
                </div>
                <p>${escapeHtml(project.note)}</p>
                <strong>${escapeHtml(project.owner)}</strong>
            </article>
        `).join('');
    }

    function renderFinance() {
        if (!financeList) {
            return;
        }

        financeList.innerHTML = getFinanceItems().map((item) => `
            <article class="workspace-data-card">
                <div class="workspace-data-card-head">
                    <div>
                        <span>${escapeHtml(item.status)}</span>
                        <h3>${escapeHtml(item.client)}</h3>
                    </div>
                    <span class="workspace-pill ${item.status === 'Paid' ? 'success' : item.status === 'Open' ? 'warning' : ''}">${formatCurrency(item.amount)}</span>
                </div>
                <p>${escapeHtml(item.note)}</p>
            </article>
        `).join('');
    }

    function renderClientDesk() {
        const client = getActiveOpsClient();

        if (!client) {
            return;
        }

        clientList.innerHTML = state.data.clients.map((item) => `
            <article class="client-roster-item ${item.id === client.id ? 'active' : ''}">
                <button type="button" class="client-roster-hit" data-select-client="${escapeHtml(item.id)}" aria-label="Select ${escapeHtml(item.company)}"></button>
                <div class="client-roster-head">
                    <div>
                        <strong>${escapeHtml(item.company)}</strong>
                        <p>${escapeHtml(item.contactName)} | ${escapeHtml(item.service)}</p>
                    </div>
                    <span class="workspace-pill ${getStatusPillClass(item.status)}">${escapeHtml(item.status)}</span>
                </div>
                <div class="client-roster-meta">
                    <span>${escapeHtml(item.projectName)}</span>
                    <span>${item.progress}% progress</span>
                </div>
                <button type="button" class="btn btn-outline btn-sm" data-open-portal-as="${escapeHtml(item.id)}">Open Demo Portal</button>
            </article>
        `).join('');

        clientSummary.innerHTML = `
            <div class="client-summary-head">
                <div>
                    <span class="workspace-panel-kicker">Selected Client</span>
                    <h3>${escapeHtml(client.company)}</h3>
                    <p>${escapeHtml(client.contactName)} | ${escapeHtml(client.service)} | ${escapeHtml(client.projectName)}</p>
                </div>
                <button type="button" class="btn btn-primary btn-sm" data-open-portal-as="${escapeHtml(client.id)}">Open Demo Portal</button>
            </div>
            <div class="client-credential-pills">
                <span class="client-credential-pill"><strong>Email</strong>${escapeHtml(client.email)}</span>
                <span class="client-credential-pill"><strong>Access key</strong>${escapeHtml(client.accessKey)}</span>
                <span class="client-credential-pill"><strong>Next review</strong>${escapeHtml(client.nextReview)}</span>
            </div>
            <div class="client-desk-summary-grid">
                <article class="client-desk-stat">
                    <span>Progress</span>
                    <strong>${client.progress}%</strong>
                    <p>${escapeHtml(client.currentPhase)}</p>
                </article>
                <article class="client-desk-stat">
                    <span>Files</span>
                    <strong>${client.files.length}</strong>
                    <p>Shared workspace items</p>
                </article>
                <article class="client-desk-stat">
                    <span>Invoices</span>
                    <strong>${client.invoices.length}</strong>
                    <p>${getOpenInvoices(client).length} open / ${getPaidInvoices(client).length} paid</p>
                </article>
                <article class="client-desk-stat">
                    <span>Messages</span>
                    <strong>${client.messages.length}</strong>
                    <p>Saved thread updates</p>
                </article>
            </div>
            <div class="client-summary-foot">
                <div>
                    <span class="workspace-panel-kicker">Next Actions</span>
                    <ul class="workspace-list">
                        ${client.nextActions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                    </ul>
                </div>
                <div>
                    <span class="workspace-panel-kicker">Recent Assets</span>
                    <div class="client-asset-list">
                        ${(client.files.slice(0, 3).length ? client.files.slice(0, 3) : [{ name: 'No files shared yet', type: 'Ready', meta: 'Use the form to share the first deliverable.' }]).map((file) => `
                            <article class="client-asset-item">
                                <strong>${escapeHtml(file.name)}</strong>
                                <span>${escapeHtml(file.type)}</span>
                                <p>${escapeHtml(file.meta)}</p>
                            </article>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        renderMessageThread(clientThread, client.messages);
    }
}
