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
    portalMessages: [
        {
            id: 'msg-1',
            sender: 'Architech',
            role: 'team',
            time: 'Today - 9:18 AM',
            body: 'The refined mobile homepage pass is ready for review. We tightened the card rails, elevated the portal preview section, and cleaned up the sticky header behavior.'
        },
        {
            id: 'msg-2',
            sender: 'Client',
            role: 'client',
            time: 'Today - 10:02 AM',
            body: 'Looks great so far. Please keep the premium feel strong on mobile and preserve the stronger CTA emphasis near the end of the page.'
        },
        {
            id: 'msg-3',
            sender: 'Architech',
            role: 'team',
            time: 'Today - 10:14 AM',
            body: 'Absolutely. We are finishing the mobile conversion pass now and will release the current invoice when the review package is approved.'
        }
    ],
    portalFiles: [
        { id: 'file-1', name: 'Homepage Review Deck.pdf', type: 'Review package', meta: 'Shared today', action: 'Download' },
        { id: 'file-2', name: 'Portal Access Flow.fig', type: 'UX deliverable', meta: 'Version 3', action: 'Open' },
        { id: 'file-3', name: 'Invoice 1002.pdf', type: 'Billing', meta: 'Ready after approval', action: 'Preview' },
        { id: 'file-4', name: 'Copy Notes.docx', type: 'Content', meta: 'Client editable', action: 'Open' }
    ],
    portalInvoices: [
        { id: 'inv-1001', title: 'Discovery + strategy deposit', amount: 1500, status: 'paid', note: 'Paid on April 04, 2026' },
        { id: 'inv-1002', title: 'Design + development milestone', amount: 1250, status: 'open', note: 'Due after current feedback round is approved' },
        { id: 'inv-1003', title: 'Launch + transition handoff', amount: 950, status: 'scheduled', note: 'Queued for release after launch approval' }
    ],
    opsLeads: [
        { id: 'lead-1', name: 'Maya Patel', company: 'Northline Medspa', service: 'Growth System', value: 6200, stage: 'New Inquiry', source: 'Website form', next: 'Qualify service scope' },
        { id: 'lead-2', name: 'James Carter', company: 'Sterling Tax Group', service: 'Signature Website', value: 2800, stage: 'Qualified', source: 'Referral', next: 'Book strategy call' },
        { id: 'lead-3', name: 'Olivia Brooks', company: 'Summit Wellness', service: 'Custom Software Build', value: 9400, stage: 'Proposal Sent', source: 'Discovery call', next: 'Follow up on proposal' },
        { id: 'lead-4', name: 'Avery Chen', company: 'Harbor Legal', service: 'Growth System', value: 3000, stage: 'Won', source: 'Existing client', next: 'Kickoff scheduling' }
    ],
    opsConsults: [
        { id: 'consult-1', name: 'Northline Medspa', date: 'Tomorrow - 11:00 AM', status: 'Confirmed', note: 'Review lead-gen architecture and booking flow.' },
        { id: 'consult-2', name: 'Harbor Legal', date: 'Friday - 2:30 PM', status: 'Awaiting intake', note: 'Waiting on brand assets and target geography.' },
        { id: 'consult-3', name: 'Summit Wellness', date: 'Monday - 9:00 AM', status: 'Proposal review', note: 'Walk through portal and workflow integration roadmap.' }
    ],
    opsProjects: [
        { id: 'project-1', client: 'Sterling & Associates', stage: 'UI review', progress: 78, owner: 'Design + development', note: 'Awaiting homepage signoff before invoice release.' },
        { id: 'project-2', client: 'Apex HVAC', stage: 'Build system', progress: 64, owner: 'Systems layer', note: 'Quote routing and service area logic in progress.' },
        { id: 'project-3', client: 'Glow Medical Aesthetics', stage: 'Launch prep', progress: 92, owner: 'QA + launch', note: 'Final booking flow test scheduled for Friday.' }
    ],
    opsFinance: [
        { id: 'fin-1', client: 'Sterling & Associates', amount: 1250, status: 'Open', note: 'Milestone invoice pending approval' },
        { id: 'fin-2', client: 'Glow Medical Aesthetics', amount: 2200, status: 'Paid', note: 'Deposit cleared April 08' },
        { id: 'fin-3', client: 'Apex HVAC', amount: 680, status: 'Scheduled', note: 'Support retainer renews April 18' }
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    const app = document.body.dataset.app;

    if (app === 'portal') {
        initPortalWorkspace();
    }

    if (app === 'ops') {
        initOpsWorkspace();
    }
});

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
    const logoutButton = document.getElementById('portalLogout');
    const messageThread = document.getElementById('portalMessageThread');
    const messageForm = document.getElementById('portalMessageForm');
    const messageInput = document.getElementById('portalMessageInput');
    const fileList = document.getElementById('portalFileList');
    const uploadInput = document.getElementById('portalUploadInput');
    const invoiceGrid = document.getElementById('portalInvoiceGrid');
    const modal = document.getElementById('portalInvoiceModal');
    const modalBody = document.getElementById('portalInvoiceModalBody');
    const modalClose = document.getElementById('portalInvoiceModalClose');
    const modalConfirm = document.getElementById('portalInvoiceConfirm');
    const closeModalButtons = document.querySelectorAll('[data-close-portal-modal]');
    const clientEmailEl = document.getElementById('portalClientEmail');

    const state = {
        session: WorkspaceStorage.read('architech.portal.session', null),
        messages: WorkspaceStorage.read('architech.portal.messages', WorkspaceSeed.portalMessages),
        files: WorkspaceStorage.read('architech.portal.files', WorkspaceSeed.portalFiles),
        invoices: WorkspaceStorage.read('architech.portal.invoices', WorkspaceSeed.portalInvoices),
        pendingInvoiceId: null
    };

    const demoEmail = 'client@architechdesigns.net';
    const demoKey = 'ARCHI-2026';

    initWorkspaceTabs(document);
    renderPortalMessages();
    renderPortalFiles();
    renderPortalInvoices();
    syncPortalView();

    demoFill?.addEventListener('click', () => {
        document.getElementById('portalEmail').value = demoEmail;
        document.getElementById('portalKey').value = demoKey;
    });

    authForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        const email = document.getElementById('portalEmail').value.trim().toLowerCase();
        const key = document.getElementById('portalKey').value.trim();

        if (email === demoEmail && key === demoKey) {
            state.session = { email };
            WorkspaceStorage.write('architech.portal.session', state.session);
            authNote.textContent = 'Access granted. Opening your workspace.';
            authNote.classList.add('success');
            syncPortalView();
            return;
        }

        authNote.textContent = 'Demo credentials are required for this preview: client@architechdesigns.net / ARCHI-2026.';
        authNote.classList.remove('success');
    });

    logoutButton?.addEventListener('click', () => {
        state.session = null;
        localStorage.removeItem('architech.portal.session');
        syncPortalView();
    });

    messageForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        const body = messageInput.value.trim();

        if (!body) {
            return;
        }

        state.messages.push({
            id: `msg-${Date.now()}`,
            sender: 'Client',
            role: 'client',
            time: formatNowLabel(),
            body
        });

        WorkspaceStorage.write('architech.portal.messages', state.messages);
        messageInput.value = '';
        renderPortalMessages();
    });

    uploadInput?.addEventListener('change', () => {
        const uploads = Array.from(uploadInput.files || []).map((file) => ({
            id: `file-${Date.now()}-${file.name}`,
            name: file.name,
            type: 'Uploaded asset',
            meta: `Uploaded ${formatNowLabel()}`,
            action: 'Queued'
        }));

        if (uploads.length === 0) {
            return;
        }

        state.files = [...uploads, ...state.files];
        WorkspaceStorage.write('architech.portal.files', state.files);
        renderPortalFiles();
        uploadInput.value = '';
    });

    invoiceGrid?.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-pay-invoice]');
        if (!trigger) {
            return;
        }

        state.pendingInvoiceId = trigger.dataset.payInvoice;
        const invoice = state.invoices.find((item) => item.id === state.pendingInvoiceId);
        if (!invoice || !modal) {
            return;
        }

        modalBody.textContent = `Confirm payment for ${invoice.title} (${formatCurrency(invoice.amount)}).`;
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
    });

    modalConfirm?.addEventListener('click', () => {
        const invoice = state.invoices.find((item) => item.id === state.pendingInvoiceId);
        if (!invoice) {
            return;
        }

        invoice.status = 'paid';
        invoice.note = `Paid ${formatNowLabel()}`;
        WorkspaceStorage.write('architech.portal.invoices', state.invoices);
        closePortalModal();
        renderPortalInvoices();
    });

    closeModalButtons.forEach((button) => button.addEventListener('click', closePortalModal));
    modalClose?.addEventListener('click', closePortalModal);

    function closePortalModal() {
        modal?.classList.remove('active');
        modal?.setAttribute('aria-hidden', 'true');
        state.pendingInvoiceId = null;
    }

    function syncPortalView() {
        const isSignedIn = Boolean(state.session);
        authShell?.classList.toggle('is-hidden', isSignedIn);
        appShell?.classList.toggle('is-hidden', !isSignedIn);
        clientEmailEl.textContent = state.session?.email || demoEmail;
    }

    function renderPortalMessages() {
        if (!messageThread) {
            return;
        }

        messageThread.innerHTML = state.messages.map((message) => `
            <article class="workspace-message ${message.role}">
                <div class="workspace-message-meta">
                    <strong>${message.sender}</strong>
                    <span>${message.time}</span>
                </div>
                <p>${message.body}</p>
            </article>
        `).join('');
        messageThread.scrollTop = messageThread.scrollHeight;
    }

    function renderPortalFiles() {
        if (!fileList) {
            return;
        }

        fileList.innerHTML = state.files.map((file) => `
            <article class="workspace-file-card">
                <span class="workspace-file-type">${file.type}</span>
                <h3>${file.name}</h3>
                <p>${file.meta}</p>
                <button type="button" class="btn btn-outline btn-sm" disabled>${file.action}</button>
            </article>
        `).join('');
    }

    function renderPortalInvoices() {
        if (!invoiceGrid) {
            return;
        }

        invoiceGrid.innerHTML = state.invoices.map((invoice) => {
            const statusClass = invoice.status === 'paid' ? 'paid' : invoice.status === 'open' ? 'open' : 'upcoming';
            const pillClass = invoice.status === 'paid' ? 'success' : invoice.status === 'open' ? 'warning' : '';
            const pillLabel = invoice.status === 'paid' ? 'Paid' : invoice.status === 'open' ? 'Open' : 'Scheduled';
            const action = invoice.status === 'open'
                ? `<button type="button" class="btn btn-primary btn-sm" data-pay-invoice="${invoice.id}">Pay Invoice</button>`
                : `<button type="button" class="btn btn-outline btn-sm" disabled>${pillLabel}</button>`;

            return `
                <article class="invoice-card ${statusClass}" data-invoice-id="${invoice.id}">
                    <div class="invoice-card-head">
                        <div>
                            <span>${invoice.id.replace('inv-', 'Invoice ')}</span>
                            <strong>${invoice.title}</strong>
                        </div>
                        <span class="workspace-pill ${pillClass}">${pillLabel}</span>
                    </div>
                    <p>${invoice.note}</p>
                    <div class="invoice-card-foot">
                        <strong>${formatCurrency(invoice.amount)}</strong>
                        ${action}
                    </div>
                </article>
            `;
        }).join('');
    }
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

    const state = {
        leads: WorkspaceStorage.read('architech.ops.leads', WorkspaceSeed.opsLeads),
        consults: WorkspaceStorage.read('architech.ops.consults', WorkspaceSeed.opsConsults),
        projects: WorkspaceStorage.read('architech.ops.projects', WorkspaceSeed.opsProjects),
        finance: WorkspaceStorage.read('architech.ops.finance', WorkspaceSeed.opsFinance)
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

        state.leads.unshift({
            id: `lead-${Date.now()}`,
            name,
            company: document.getElementById('opsLeadCompany').value.trim() || 'New prospect',
            service: document.getElementById('opsLeadService').value,
            value: Number(document.getElementById('opsLeadValue').value || 0),
            stage: 'New Inquiry',
            source: 'Manual entry',
            next: 'Send follow-up within 24 hours'
        });

        WorkspaceStorage.write('architech.ops.leads', state.leads);
        leadForm.reset();
        renderAll();
    });

    pipelineBoard?.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-advance-lead]');
        if (!trigger) {
            return;
        }

        const lead = state.leads.find((item) => item.id === trigger.dataset.advanceLead);
        if (!lead) {
            return;
        }

        const currentIndex = stages.indexOf(lead.stage);
        lead.stage = stages[Math.min(currentIndex + 1, stages.length - 1)];
        lead.next = lead.stage === 'Won' ? 'Prepare kickoff plan' : 'Advance to next touchpoint';
        WorkspaceStorage.write('architech.ops.leads', state.leads);
        renderAll();
    });

    function renderAll() {
        renderMetrics();
        renderPipeline();
        renderConsults();
        renderProjects();
        renderFinance();
    }

    function renderMetrics() {
        const newLeads = state.leads.filter((lead) => lead.stage === 'New Inquiry').length;
        const activeProjects = state.projects.length;
        const openRevenue = state.finance
            .filter((item) => item.status === 'Open' || item.status === 'Scheduled')
            .reduce((sum, item) => sum + item.amount, 0);

        metricLeads.textContent = `${newLeads} this week`;
        metricConsults.textContent = `${state.consults.length} scheduled`;
        metricProjects.textContent = `${activeProjects} active builds`;
        metricRevenue.textContent = `${formatCurrency(openRevenue)} outstanding`;
    }

    function renderPipeline() {
        if (!pipelineBoard) {
            return;
        }

        pipelineBoard.innerHTML = stages.map((stage) => {
            const items = state.leads.filter((lead) => lead.stage === stage);

            return `
                <section class="ops-stage-column">
                    <div class="ops-stage-head">
                        <h3>${stage}</h3>
                        <span>${items.length}</span>
                    </div>
                    <div class="ops-stage-stack">
                        ${items.map((lead) => `
                            <article class="ops-lead-card">
                                <span class="ops-lead-service">${lead.service}</span>
                                <h4>${lead.name}</h4>
                                <p>${lead.company}</p>
                                <div class="ops-lead-meta">
                                    <span>${formatCurrency(lead.value)}</span>
                                    <span>${lead.source}</span>
                                </div>
                                <strong>${lead.next}</strong>
                                <button type="button" class="btn btn-outline btn-sm" data-advance-lead="${lead.id}">${stage === 'Won' ? 'Closed' : 'Advance Stage'}</button>
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

        consultList.innerHTML = state.consults.map((consult) => `
            <article class="workspace-data-card">
                <div class="workspace-data-card-head">
                    <div>
                        <span>${consult.status}</span>
                        <h3>${consult.name}</h3>
                    </div>
                    <span class="workspace-pill">${consult.date}</span>
                </div>
                <p>${consult.note}</p>
            </article>
        `).join('');
    }

    function renderProjects() {
        if (!projectList) {
            return;
        }

        projectList.innerHTML = state.projects.map((project) => `
            <article class="workspace-data-card">
                <div class="workspace-data-card-head">
                    <div>
                        <span>${project.stage}</span>
                        <h3>${project.client}</h3>
                    </div>
                    <span class="workspace-pill success">${project.progress}%</span>
                </div>
                <div class="workspace-progress">
                    <div class="workspace-progress-bar">
                        <span style="width: ${project.progress}%"></span>
                    </div>
                </div>
                <p>${project.note}</p>
                <strong>${project.owner}</strong>
            </article>
        `).join('');
    }

    function renderFinance() {
        if (!financeList) {
            return;
        }

        financeList.innerHTML = state.finance.map((item) => `
            <article class="workspace-data-card">
                <div class="workspace-data-card-head">
                    <div>
                        <span>${item.status}</span>
                        <h3>${item.client}</h3>
                    </div>
                    <span class="workspace-pill ${item.status === 'Paid' ? 'success' : item.status === 'Open' ? 'warning' : ''}">${formatCurrency(item.amount)}</span>
                </div>
                <p>${item.note}</p>
            </article>
        `).join('');
    }
}
