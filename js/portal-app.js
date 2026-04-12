import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const PORTAL_STORAGE_KEY = 'architech.portal.selectedProjectId';
const ADMIN_CLIENT_STORAGE_KEY = 'architech.admin.selectedClientId';
const ADMIN_PROJECT_STORAGE_KEY = 'architech.admin.selectedProjectId';
const APP = document.body.dataset.app;
const CONFIG = window.ARCHITECH_PORTAL_CONFIG || {};
const SUPPORT_EMAIL = CONFIG.supportEmail || 'hello@architechdesigns.net';
const STORAGE_BUCKET = CONFIG.storageBucket || 'client-documents';

if (['client-login', 'client-workspace', 'ops'].includes(APP)) {
    initPortalApplication().catch((error) => {
        console.error('[Portal] Initialization failed', error);
        renderGlobalFailure(error);
    });
}

async function initPortalApplication() {
    if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey) {
        renderMissingConfigState();
        return;
    }

    const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: 'architech.portal.auth'
        }
    });

    if (APP === 'client-login') {
        await initClientLoginPage(supabase);
        return;
    }

    const userContext = await requireAuthenticatedProfile(supabase);
    if (!userContext) {
        return;
    }

    if (APP === 'client-workspace') {
        if (userContext.profile.role === 'admin') {
            redirectTo('ops-suite.html');
            return;
        }

        await initClientWorkspacePage(supabase, userContext);
        return;
    }

    if (APP === 'ops') {
        if (userContext.profile.role !== 'admin') {
            renderAdminAccessDenied();
            return;
        }

        await initAdminWorkspacePage(supabase, userContext);
    }
}

async function initClientLoginPage(supabase) {
    const loginForm = byId('loginForm');
    const loginStatus = byId('loginStatus');
    const resetTrigger = byId('passwordResetTrigger');
    const submitButton = loginForm?.querySelector('button[type="submit"]');

    const existingSession = await getSession(supabase);
    if (existingSession) {
        const userContext = await getCurrentUserContext(supabase, existingSession.user.id);
        if (userContext?.profile?.role === 'admin') {
            redirectTo('ops-suite.html');
            return;
        }

        if (userContext?.profile?.role === 'client') {
            redirectTo('client-workspace.html');
            return;
        }
    }

    loginForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        setInlineStatus(loginStatus, 'Signing you in...', 'info');
        setButtonBusy(submitButton, true, 'Signing In');

        const email = byId('email')?.value.trim().toLowerCase();
        const password = byId('password')?.value || '';

        if (!email || !password) {
            setInlineStatus(loginStatus, 'Enter both your email and password to continue.', 'error');
            setButtonBusy(submitButton, false, 'Sign In');
            return;
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setInlineStatus(loginStatus, error.message || 'We could not sign you in.', 'error');
            setButtonBusy(submitButton, false, 'Sign In');
            return;
        }

        const session = await getSession(supabase);
        const userContext = session ? await getCurrentUserContext(supabase, session.user.id) : null;
        setInlineStatus(loginStatus, 'Access granted. Redirecting to your workspace.', 'success');

        window.setTimeout(() => {
            if (userContext?.profile?.role === 'admin') {
                redirectTo('ops-suite.html');
                return;
            }

            redirectTo('client-workspace.html');
        }, 180);
    });

    resetTrigger?.addEventListener('click', async (event) => {
        event.preventDefault();
        const email = byId('email')?.value.trim().toLowerCase();

        if (!email) {
            setInlineStatus(loginStatus, 'Enter your email first, then request a reset link.', 'error');
            return;
        }

        setInlineStatus(loginStatus, 'Sending a password reset email...', 'info');
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/client-login.html`
        });

        if (error) {
            setInlineStatus(loginStatus, error.message || 'We could not send a reset email.', 'error');
            return;
        }

        setInlineStatus(loginStatus, 'Password reset email sent. Check your inbox for the secure link.', 'success');
    });
}

async function initClientWorkspacePage(supabase, userContext) {
    const state = {
        profile: userContext.profile,
        client: null,
        projects: [],
        selectedProjectId: localStorage.getItem(PORTAL_STORAGE_KEY) || '',
        projectDetail: null
    };

    const signOutButton = byId('portalSignOut');
    const projectSelect = byId('workspaceProjectSelect');
    const alert = byId('workspaceAlert');
    const messageForm = byId('workspaceMessageForm');
    const profileForm = byId('workspaceProfileForm');
    const documentList = byId('workspaceDocumentList');

    bindWorkspaceTabs(document);
    initWorkspaceChrome();
    setLoadingWorkspaceState();

    signOutButton?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        redirectTo('client-login.html');
    });

    projectSelect?.addEventListener('change', async (event) => {
        state.selectedProjectId = event.target.value;
        localStorage.setItem(PORTAL_STORAGE_KEY, state.selectedProjectId);
        await loadSelectedProject();
    });

    messageForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const input = byId('workspaceMessageInput');
        const body = input?.value.trim();

        if (!body || !state.selectedProjectId) {
            return;
        }

        setAlert(alert, 'Sending your message...', 'info');
        const { error } = await supabase.from('messages').insert({
            project_id: state.selectedProjectId,
            sender_id: state.profile.id,
            body,
            is_internal: false
        });

        if (error) {
            setAlert(alert, error.message || 'We could not send your message.', 'error');
            return;
        }

        input.value = '';
        await loadSelectedProject();
        setAlert(alert, 'Message sent to the project team.', 'success');
    });

    profileForm?.addEventListener('submit', async (event) => {
        event.preventDefault();

        const payload = {
            full_name: byId('workspaceProfileName')?.value.trim() || null,
            phone: byId('workspaceProfilePhone')?.value.trim() || null,
            title: byId('workspaceProfileTitle')?.value.trim() || null
        };

        const { error } = await supabase.from('profiles').update(payload).eq('id', state.profile.id);
        if (error) {
            setInlineStatus(byId('workspaceProfileStatus'), error.message || 'We could not update your profile.', 'error');
            return;
        }

        state.profile = { ...state.profile, ...payload };
        fillProfileForm(state.profile);
        setInlineStatus(byId('workspaceProfileStatus'), 'Profile updated successfully.', 'success');
    });

    documentList?.addEventListener('click', async (event) => {
        const trigger = event.target.closest('[data-download-document]');
        if (!trigger) {
            return;
        }

        const documentId = trigger.dataset.downloadDocument;
        const documentRecord = state.projectDetail?.documents.find((item) => item.id === documentId);
        if (!documentRecord) {
            return;
        }

        setAlert(alert, 'Preparing a secure download...', 'info');
        const { data, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(documentRecord.storage_path, 60);

        if (error || !data?.signedUrl) {
            setAlert(alert, error?.message || 'The file could not be downloaded right now.', 'error');
            return;
        }

        window.open(data.signedUrl, '_blank', 'noopener');
        clearAlert(alert);
    });

    const workspaceData = await fetchClientWorkspaceData(supabase, state.profile.id);
    state.client = workspaceData.client;
    state.projects = workspaceData.projects;

    if (!state.projects.length) {
        renderClientWorkspaceEmptyState(state.profile, state.client);
        return;
    }

    if (!state.projects.some((project) => project.id === state.selectedProjectId)) {
        state.selectedProjectId = state.projects[0].id;
        localStorage.setItem(PORTAL_STORAGE_KEY, state.selectedProjectId);
    }

    await loadSelectedProject();

    async function loadSelectedProject() {
        if (!state.selectedProjectId) {
            return;
        }

        setAlert(alert, 'Refreshing project data...', 'info');
        state.projectDetail = await fetchProjectDetail(supabase, state.selectedProjectId);
        renderClientWorkspace(state);
        clearAlert(alert);
    }
}

async function initAdminWorkspacePage(supabase, userContext) {
    const accessGate = byId('adminAccessGate');
    const appShell = byId('adminAppShell');
    accessGate?.classList.add('is-hidden');
    appShell?.classList.remove('is-hidden');

    const state = {
        profile: userContext.profile,
        profiles: [],
        clients: [],
        projects: [],
        memberships: [],
        milestones: [],
        updates: [],
        documents: [],
        invoices: [],
        payments: [],
        messages: [],
        selectedClientId: localStorage.getItem(ADMIN_CLIENT_STORAGE_KEY) || '',
        selectedProjectId: localStorage.getItem(ADMIN_PROJECT_STORAGE_KEY) || ''
    };

    bindWorkspaceTabs(document);
    initWorkspaceChrome();
    bindAdminEventHandlers();
    await refreshAdminData();

    async function refreshAdminData() {
        setAlert(byId('adminAlert'), 'Refreshing admin data...', 'info');
        state.profiles = await fetchTable(supabase, 'profiles', '*', (query) => query.order('full_name', { ascending: true }));
        state.clients = await fetchTable(supabase, 'clients', '*', (query) => query.order('company_name', { ascending: true }));
        state.projects = await fetchTable(supabase, 'projects', '*', (query) => query.order('updated_at', { ascending: false }));
        state.memberships = await fetchTable(supabase, 'project_memberships', '*', (query) => query.order('created_at', { ascending: true }));
        state.milestones = await fetchTable(supabase, 'milestones', '*', (query) => query.order('sort_order', { ascending: true }).order('due_at', { ascending: true }));
        state.updates = await fetchTable(supabase, 'project_updates', '*', (query) => query.order('published_at', { ascending: false }));
        state.documents = await fetchTable(supabase, 'documents', '*', (query) => query.order('created_at', { ascending: false }));
        state.invoices = await fetchTable(supabase, 'invoices', '*', (query) => query.order('issued_at', { ascending: false }));
        state.payments = await fetchTable(supabase, 'payment_records', '*', (query) => query.order('paid_at', { ascending: false }));
        state.messages = await fetchTable(supabase, 'messages', '*', (query) => query.order('created_at', { ascending: true }));

        if (!state.clients.some((client) => client.id === state.selectedClientId)) {
            state.selectedClientId = state.clients[0]?.id || '';
        }

        const visibleProjects = getProjectsForSelectedClient(state);
        if (!visibleProjects.some((project) => project.id === state.selectedProjectId)) {
            state.selectedProjectId = state.selectedClientId
                ? (visibleProjects[0]?.id || '')
                : (state.projects[0]?.id || '');
        }

        persistAdminSelection(state);
        renderAdminWorkspace(state);
        clearAlert(byId('adminAlert'));
    }

    function bindAdminEventHandlers() {
        byId('portalSignOut')?.addEventListener('click', async () => {
            await supabase.auth.signOut();
            redirectTo('client-login.html');
        });

        byId('adminClientSelect')?.addEventListener('change', (event) => {
            state.selectedClientId = event.target.value;
            const visibleProjects = getProjectsForSelectedClient(state);
            state.selectedProjectId = visibleProjects[0]?.id || '';
            persistAdminSelection(state);
            renderAdminWorkspace(state);
        });

        byId('adminProjectSelect')?.addEventListener('change', (event) => {
            state.selectedProjectId = event.target.value;
            persistAdminSelection(state);
            renderAdminWorkspace(state);
        });

        byId('adminClientRoster')?.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-select-client]');
            if (!trigger) {
                return;
            }

            state.selectedClientId = trigger.dataset.selectClient;
            const visibleProjects = getProjectsForSelectedClient(state);
            state.selectedProjectId = visibleProjects[0]?.id || '';
            persistAdminSelection(state);
            renderAdminWorkspace(state);
        });

        byId('adminProjectList')?.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-select-project]');
            if (!trigger) {
                return;
            }

            state.selectedProjectId = trigger.dataset.selectProject;
            const project = state.projects.find((item) => item.id === state.selectedProjectId);
            if (project?.client_id) {
                state.selectedClientId = project.client_id;
            }
            persistAdminSelection(state);
            renderAdminWorkspace(state);
        });

        byId('adminDocumentList')?.addEventListener('click', async (event) => {
            const trigger = event.target.closest('[data-download-document]');
            if (!trigger) {
                return;
            }

            const documentRecord = state.documents.find((item) => item.id === trigger.dataset.downloadDocument);
            if (!documentRecord) {
                return;
            }

            setAlert(byId('adminAlert'), 'Preparing a secure download...', 'info');
            const { data, error } = await supabase.storage
                .from(STORAGE_BUCKET)
                .createSignedUrl(documentRecord.storage_path, 60);

            if (error || !data?.signedUrl) {
                setAlert(byId('adminAlert'), error?.message || 'The file could not be downloaded.', 'error');
                return;
            }

            window.open(data.signedUrl, '_blank', 'noopener');
            clearAlert(byId('adminAlert'));
        });

        byId('adminAccessList')?.addEventListener('click', async (event) => {
            const removeTrigger = event.target.closest('[data-remove-membership]');
            if (!removeTrigger) {
                return;
            }

            const membershipId = removeTrigger.dataset.removeMembership;
            const { error } = await supabase.from('project_memberships').delete().eq('id', membershipId);
            if (error) {
                setAlert(byId('adminAlert'), error.message || 'We could not remove that project assignment.', 'error');
                return;
            }

            await refreshAdminData();
            setAlert(byId('adminAlert'), 'Project access removed.', 'success');
        });

        byId('adminClientForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const submitButton = form.querySelector('button[type="submit"]');
            setButtonBusy(submitButton, true, 'Sending Invite');
            setAlert(byId('adminAlert'), 'Provisioning the client account and invite...', 'info');

            const payload = {
                fullName: byId('adminClientFullName')?.value.trim(),
                email: byId('adminClientEmail')?.value.trim().toLowerCase(),
                companyName: byId('adminClientCompany')?.value.trim(),
                billingEmail: byId('adminClientBillingEmail')?.value.trim().toLowerCase() || null,
                projectName: byId('adminClientProjectName')?.value.trim(),
                serviceLine: byId('adminClientServiceLine')?.value || 'Client Portal Engagement',
                redirectTo: `${window.location.origin}/client-login.html`
            };

            const { error } = await supabase.functions.invoke('admin-provision-user', {
                body: payload
            });

            if (error) {
                setAlert(byId('adminAlert'), error.message || 'The client account could not be provisioned.', 'error');
                setButtonBusy(submitButton, false, 'Send Invite + Create Client');
                return;
            }

            form.reset();
            await refreshAdminData();
            setAlert(byId('adminAlert'), 'Client account created and invite sent.', 'success');
            setButtonBusy(submitButton, false, 'Send Invite + Create Client');
        });

        byId('adminProjectForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!byId('adminProjectClient')?.value) {
                setAlert(byId('adminAlert'), 'Choose a client before creating a project.', 'error');
                return;
            }

            const payload = {
                client_id: byId('adminProjectClient').value,
                name: byId('adminProjectName')?.value.trim(),
                slug: slugify(byId('adminProjectName')?.value.trim()),
                service_line: byId('adminProjectService')?.value.trim() || null,
                current_phase: byId('adminProjectPhase')?.value.trim() || null,
                target_launch_date: byId('adminProjectLaunch')?.value || null,
                description: byId('adminProjectDescription')?.value.trim() || null,
                created_by: state.profile.id
            };

            const { data, error } = await supabase.from('projects').insert(payload).select().single();
            if (error || !data) {
                setAlert(byId('adminAlert'), error?.message || 'The project could not be created.', 'error');
                return;
            }

            const selectedClient = state.clients.find((client) => client.id === payload.client_id);
            if (selectedClient?.profile_id) {
                await supabase.from('project_memberships').upsert([
                    { project_id: data.id, user_id: state.profile.id, membership_role: 'admin', is_primary: false },
                    { project_id: data.id, user_id: selectedClient.profile_id, membership_role: 'client', is_primary: true }
                ], { onConflict: 'project_id,user_id' });
            }

            event.currentTarget.reset();
            state.selectedClientId = payload.client_id;
            state.selectedProjectId = data.id;
            await refreshAdminData();
            setAlert(byId('adminAlert'), 'Project created and assigned.', 'success');
        });

        byId('adminMilestoneForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!state.selectedProjectId) {
                setAlert(byId('adminAlert'), 'Select a project before adding milestones.', 'error');
                return;
            }

            const payload = {
                project_id: state.selectedProjectId,
                title: byId('adminMilestoneTitle')?.value.trim(),
                description: byId('adminMilestoneDescription')?.value.trim() || null,
                status: byId('adminMilestoneStatus')?.value || 'upcoming',
                due_at: byId('adminMilestoneDue')?.value || null,
                requires_approval: Boolean(byId('adminMilestoneApproval')?.checked),
                sort_order: getProjectMilestones(state).length + 1
            };

            const { error } = await supabase.from('milestones').insert(payload);
            if (error) {
                setAlert(byId('adminAlert'), error.message || 'The milestone could not be created.', 'error');
                return;
            }

            event.currentTarget.reset();
            await refreshAdminData();
            setAlert(byId('adminAlert'), 'Milestone added to the selected project.', 'success');
        });

        byId('adminUpdateForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!state.selectedProjectId) {
                setAlert(byId('adminAlert'), 'Select a project before posting updates.', 'error');
                return;
            }

            const payload = {
                project_id: state.selectedProjectId,
                author_id: state.profile.id,
                title: byId('adminUpdateTitle')?.value.trim(),
                body: byId('adminUpdateBody')?.value.trim(),
                status: byId('adminUpdateStatus')?.value || 'update'
            };

            const { error } = await supabase.from('project_updates').insert(payload);
            if (error) {
                setAlert(byId('adminAlert'), error.message || 'The project update could not be posted.', 'error');
                return;
            }

            event.currentTarget.reset();
            await refreshAdminData();
            setAlert(byId('adminAlert'), 'Project update published.', 'success');
        });

        byId('adminDocumentForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!state.selectedProjectId) {
                setAlert(byId('adminAlert'), 'Select a project before uploading documents.', 'error');
                return;
            }

            const file = byId('adminDocumentFile')?.files?.[0];
            if (!file) {
                setAlert(byId('adminAlert'), 'Choose a file to upload.', 'error');
                return;
            }

            const storagePath = `${state.selectedProjectId}/${Date.now()}-${sanitizeFileName(file.name)}`;
            const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, file, {
                cacheControl: '3600',
                upsert: false
            });

            if (uploadError) {
                setAlert(byId('adminAlert'), uploadError.message || 'The file could not be uploaded.', 'error');
                return;
            }

            const { error: documentError } = await supabase.from('documents').insert({
                project_id: state.selectedProjectId,
                uploaded_by: state.profile.id,
                file_name: file.name,
                storage_path: storagePath,
                mime_type: file.type || 'application/octet-stream',
                file_size: file.size,
                category: byId('adminDocumentCategory')?.value.trim() || 'Project file'
            });

            if (documentError) {
                await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
                setAlert(byId('adminAlert'), documentError.message || 'The file record could not be created.', 'error');
                return;
            }

            event.currentTarget.reset();
            await refreshAdminData();
            setAlert(byId('adminAlert'), 'Document uploaded to the client portal.', 'success');
        });

        byId('adminInvoiceForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!state.selectedProjectId) {
                setAlert(byId('adminAlert'), 'Select a project before creating invoices.', 'error');
                return;
            }

            const project = getSelectedProject(state);
            const payload = {
                project_id: state.selectedProjectId,
                created_by: state.profile.id,
                invoice_number: createInvoiceNumber(project?.name || 'portal'),
                title: byId('adminInvoiceTitle')?.value.trim(),
                description: byId('adminInvoiceDescription')?.value.trim() || null,
                amount: Number(byId('adminInvoiceAmount')?.value || 0),
                currency: 'USD',
                status: byId('adminInvoiceStatus')?.value || 'issued',
                due_at: byId('adminInvoiceDue')?.value || null,
                payment_url: byId('adminInvoicePaymentUrl')?.value.trim() || null
            };

            const { error } = await supabase.from('invoices').insert(payload);
            if (error) {
                setAlert(byId('adminAlert'), error.message || 'The invoice could not be created.', 'error');
                return;
            }

            event.currentTarget.reset();
            await refreshAdminData();
            setAlert(byId('adminAlert'), 'Invoice created successfully.', 'success');
        });

        byId('adminPaymentForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const invoiceId = byId('adminPaymentInvoice')?.value;
            if (!invoiceId) {
                setAlert(byId('adminAlert'), 'Choose an invoice before recording a payment.', 'error');
                return;
            }

            const invoice = state.invoices.find((item) => item.id === invoiceId);
            const amount = Number(byId('adminPaymentAmount')?.value || 0);
            const paidAt = byId('adminPaymentPaidAt')?.value || new Date().toISOString();

            const { error } = await supabase.from('payment_records').insert({
                invoice_id: invoiceId,
                recorded_by: state.profile.id,
                amount,
                method: byId('adminPaymentMethod')?.value.trim() || null,
                reference: byId('adminPaymentReference')?.value.trim() || null,
                paid_at: paidAt
            });

            if (error) {
                setAlert(byId('adminAlert'), error.message || 'The payment record could not be saved.', 'error');
                return;
            }

            if (invoice && amount >= Number(invoice.amount || 0)) {
                await supabase.from('invoices').update({ status: 'paid', paid_at: paidAt }).eq('id', invoiceId);
            }

            event.currentTarget.reset();
            await refreshAdminData();
            setAlert(byId('adminAlert'), 'Payment recorded successfully.', 'success');
        });

        byId('adminMessageForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!state.selectedProjectId) {
                setAlert(byId('adminAlert'), 'Select a project before sending messages.', 'error');
                return;
            }

            const body = byId('adminMessageBody')?.value.trim();
            if (!body) {
                return;
            }

            const payload = {
                project_id: state.selectedProjectId,
                sender_id: state.profile.id,
                body,
                is_internal: Boolean(byId('adminMessageInternal')?.checked)
            };

            const { error } = await supabase.from('messages').insert(payload);
            if (error) {
                setAlert(byId('adminAlert'), error.message || 'The message could not be sent.', 'error');
                return;
            }

            event.currentTarget.reset();
            await refreshAdminData();
            setAlert(byId('adminAlert'), 'Message posted to the project thread.', 'success');
        });

        byId('adminAccessForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const clientId = byId('adminAccessClient')?.value;
            const projectId = byId('adminAccessProject')?.value;
            const client = state.clients.find((item) => item.id === clientId);

            if (!client?.profile_id || !projectId) {
                setAlert(byId('adminAlert'), 'Choose both a client and a project to assign access.', 'error');
                return;
            }

            const { error } = await supabase.from('project_memberships').upsert({
                project_id: projectId,
                user_id: client.profile_id,
                membership_role: 'client',
                is_primary: true
            }, { onConflict: 'project_id,user_id' });

            if (error) {
                setAlert(byId('adminAlert'), error.message || 'The project assignment could not be saved.', 'error');
                return;
            }

            await refreshAdminData();
            setAlert(byId('adminAlert'), 'Portal access updated for that client.', 'success');
        });
    }
}

async function requireAuthenticatedProfile(supabase) {
    const session = await getSession(supabase);
    if (!session) {
        redirectTo('client-login.html');
        return null;
    }

    const userContext = await getCurrentUserContext(supabase, session.user.id);
    if (!userContext?.profile) {
        redirectTo('client-login.html');
        return null;
    }

    return userContext;
}

async function getSession(supabase) {
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
}

async function getCurrentUserContext(supabase, userId) {
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) {
        throw error;
    }

    return { profile };
}

async function fetchClientWorkspaceData(supabase, userId) {
    const [client, memberships] = await Promise.all([
        fetchMaybeSingle(supabase, 'clients', '*', (query) => query.eq('profile_id', userId)),
        fetchTable(supabase, 'project_memberships', '*', (query) => query.eq('user_id', userId).order('is_primary', { ascending: false }))
    ]);

    const projectIds = memberships.map((membership) => membership.project_id);
    const projects = projectIds.length
        ? await fetchTable(supabase, 'projects', '*', (query) => query.in('id', projectIds).order('updated_at', { ascending: false }))
        : [];

    return { client, projects };
}

async function fetchProjectDetail(supabase, projectId) {
    const [milestones, updates, documents, invoices, messages] = await Promise.all([
        fetchTable(supabase, 'milestones', '*', (query) => query.eq('project_id', projectId).order('sort_order', { ascending: true }).order('due_at', { ascending: true })),
        fetchTable(supabase, 'project_updates', '*', (query) => query.eq('project_id', projectId).order('published_at', { ascending: false })),
        fetchTable(supabase, 'documents', '*', (query) => query.eq('project_id', projectId).order('created_at', { ascending: false })),
        fetchTable(supabase, 'invoices', '*', (query) => query.eq('project_id', projectId).order('issued_at', { ascending: false })),
        fetchTable(supabase, 'messages', '*', (query) => query.eq('project_id', projectId).order('created_at', { ascending: true }))
    ]);

    const invoiceIds = invoices.map((invoice) => invoice.id);
    const profileIds = Array.from(new Set([
        ...updates.map((item) => item.author_id).filter(Boolean),
        ...messages.map((item) => item.sender_id).filter(Boolean)
    ]));

    const [payments, profiles] = await Promise.all([
        invoiceIds.length
            ? fetchTable(supabase, 'payment_records', '*', (query) => query.in('invoice_id', invoiceIds).order('paid_at', { ascending: false }))
            : Promise.resolve([]),
        profileIds.length
            ? fetchTable(supabase, 'profiles', '*', (query) => query.in('id', profileIds))
            : Promise.resolve([])
    ]);

    return {
        milestones,
        updates,
        documents,
        invoices,
        payments,
        messages,
        profilesById: indexBy(profiles, 'id')
    };
}

async function fetchTable(supabase, table, columns, mutateQuery = (query) => query) {
    const { data, error } = await mutateQuery(supabase.from(table).select(columns));
    if (error) {
        throw error;
    }

    return data || [];
}

async function fetchMaybeSingle(supabase, table, columns, mutateQuery = (query) => query) {
    const { data, error } = await mutateQuery(supabase.from(table).select(columns)).maybeSingle();
    if (error) {
        throw error;
    }

    return data || null;
}

function renderClientWorkspace(state) {
    const selectedProject = state.projects.find((project) => project.id === state.selectedProjectId) || state.projects[0];
    const detail = state.projectDetail;
    const openInvoices = detail.invoices.filter((invoice) => !['paid', 'void'].includes(invoice.status));
    const paidInvoices = detail.invoices.filter((invoice) => invoice.status === 'paid');
    const completedMilestones = detail.milestones.filter((milestone) => ['approved', 'complete'].includes(milestone.status));
    const nextMilestone = detail.milestones.find((milestone) => !['approved', 'complete'].includes(milestone.status)) || detail.milestones[0];
    const totalCollected = detail.payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    byId('workspaceClientName').textContent = state.client?.company_name || state.profile.full_name || 'Client Portal';
    byId('workspaceClientEmail').textContent = state.profile.email || SUPPORT_EMAIL;
    byId('workspaceClientMeta').textContent = `${state.profile.full_name || 'Project contact'} | ${selectedProject.service_line || 'Portal project'}`;
    byId('workspaceProjectTitle').textContent = selectedProject.name;
    if (byId('workspaceProjectSynopsis')) {
        byId('workspaceProjectSynopsis').textContent = selectedProject.description || 'Review project status, files, billing, and direct communication in one refined private workspace.';
    }
    updateWorkspaceChrome({
        projectLabel: selectedProject.name,
        name: state.profile.full_name || state.client?.company_name || 'Client Portal',
        email: state.profile.email || SUPPORT_EMAIL,
        status: selectedProject.status || 'active'
    });
    byId('workspaceProjectSelect').innerHTML = state.projects.map((project) => `
        <option value="${escapeHtml(project.id)}" ${project.id === selectedProject.id ? 'selected' : ''}>${escapeHtml(project.name)}</option>
    `).join('');

    byId('workspaceOverviewMetrics').innerHTML = `
        <article class="workspace-kpi-card">
            <span>Current phase</span>
            <strong>${escapeHtml(selectedProject.current_phase || 'Project delivery')}</strong>
        </article>
        <article class="workspace-kpi-card">
            <span>Milestones complete</span>
            <strong>${completedMilestones.length} of ${detail.milestones.length || 0}</strong>
        </article>
        <article class="workspace-kpi-card">
            <span>Open invoices</span>
            <strong>${openInvoices.length ? formatCurrency(sumBy(openInvoices, 'amount')) : 'All current'}</strong>
        </article>
        <article class="workspace-kpi-card">
            <span>Collected to date</span>
            <strong>${formatCurrency(totalCollected)}</strong>
        </article>
    `;

    byId('overviewSummaryTitle').textContent = selectedProject.current_phase || selectedProject.name;
    byId('overviewSummaryText').textContent = selectedProject.description || 'Your private workspace keeps delivery, billing, and communication organized in one place.';
    byId('overviewActionsList').innerHTML = [
        nextMilestone ? `Next milestone: ${nextMilestone.title}${nextMilestone.due_at ? ` on ${formatDate(nextMilestone.due_at)}` : ''}` : 'No milestone is currently queued.',
        selectedProject.target_launch_date ? `Launch target: ${formatDate(selectedProject.target_launch_date)}` : 'Launch target will appear here when scheduled.',
        openInvoices.length ? `${openInvoices.length} invoice${openInvoices.length === 1 ? '' : 's'} currently need review.` : 'There are no outstanding invoices right now.'
    ].map((item) => `<li>${escapeHtml(item)}</li>`).join('');

    byId('workspaceMilestoneList').innerHTML = detail.milestones.length
        ? detail.milestones.map((milestone) => `
            <article class="workspace-data-card workspace-timeline-card">
                <div class="workspace-data-card-head">
                    <div>
                        <span>${milestone.requires_approval ? 'Approval checkpoint' : 'Milestone'}</span>
                        <h3>${escapeHtml(milestone.title)}</h3>
                    </div>
                    <span class="workspace-pill ${statusPillClass(milestone.status)}">${escapeHtml(humanizeStatus(milestone.status))}</span>
                </div>
                <p>${escapeHtml(milestone.description || 'No additional milestone detail has been added yet.')}</p>
                <div class="workspace-data-card-foot">
                    <strong>${milestone.due_at ? `Due ${formatDate(milestone.due_at)}` : 'Date to be scheduled'}</strong>
                </div>
            </article>
        `).join('')
        : renderEmptyState('No milestones yet', 'Milestones will appear here as the project schedule is published.');

    byId('workspaceUpdateList').innerHTML = detail.updates.length
        ? detail.updates.map((update) => {
            const author = detail.profilesById[update.author_id];
            return `
                <article class="workspace-data-card workspace-update-card">
                    <div class="workspace-data-card-head">
                        <div>
                            <span>${escapeHtml(humanizeStatus(update.status || 'update'))}</span>
                            <h3>${escapeHtml(update.title)}</h3>
                        </div>
                        <span class="workspace-pill">${formatDateTime(update.published_at)}</span>
                    </div>
                    <p>${escapeHtml(update.body)}</p>
                    <div class="workspace-data-card-foot">
                        <strong>${escapeHtml(author?.full_name || 'Architech')}</strong>
                    </div>
                </article>
            `;
        }).join('')
        : renderEmptyState('No project updates yet', 'Published updates will appear here as the team posts progress notes.');

    byId('workspaceDocumentList').innerHTML = detail.documents.length
        ? detail.documents.map((documentRecord) => `
            <article class="workspace-file-card">
                <span class="workspace-file-type">${escapeHtml(documentRecord.category || 'Document')}</span>
                <h3>${escapeHtml(documentRecord.file_name)}</h3>
                <p>${escapeHtml(formatFileMeta(documentRecord))}</p>
                <button type="button" class="btn btn-outline btn-sm" data-download-document="${escapeHtml(documentRecord.id)}">Download</button>
            </article>
        `).join('')
        : renderEmptyState('No files shared yet', 'Files and deliverables will appear here as they are uploaded.');

    byId('workspaceInvoiceList').innerHTML = detail.invoices.length
        ? detail.invoices.map((invoice) => {
            const invoicePayments = detail.payments.filter((item) => item.invoice_id === invoice.id);
            const summaryText = invoice.description
                ? invoice.description
                : invoice.due_at
                    ? `Due ${formatDate(invoice.due_at)}`
                    : 'Payment details will appear here.';

            return `
                <article class="invoice-card ${invoice.status === 'paid' ? 'paid' : invoice.status === 'overdue' ? 'open' : 'upcoming'}">
                    <div class="invoice-card-head">
                        <div>
                            <span>${escapeHtml(invoice.invoice_number || 'Invoice')}</span>
                            <strong>${escapeHtml(invoice.title)}</strong>
                        </div>
                        <span class="workspace-pill ${statusPillClass(invoice.status)}">${escapeHtml(humanizeStatus(invoice.status))}</span>
                    </div>
                    <p>${escapeHtml(summaryText)}</p>
                    <div class="invoice-card-foot">
                        <strong>${formatCurrency(invoice.amount)}</strong>
                        ${invoice.payment_url ? `<a class="btn btn-primary btn-sm" href="${escapeHtml(invoice.payment_url)}" target="_blank" rel="noopener">Open Payment Link</a>` : '<span class="workspace-inline-note">Payment link will be shared when available.</span>'}
                    </div>
                    ${invoicePayments.length ? `<div class="workspace-inline-records">${invoicePayments.map((payment) => `<span class="workspace-pill success">${escapeHtml(formatCurrency(payment.amount))} received ${escapeHtml(formatDate(payment.paid_at))}</span>`).join('')}</div>` : ''}
                </article>
            `;
        }).join('')
        : renderEmptyState('No invoices yet', 'Invoices and payment history will appear here once they are issued.');

    const messageMarkup = detail.messages.length
        ? detail.messages.map((message) => {
            const sender = detail.profilesById[message.sender_id];
            const ownMessage = message.sender_id === state.profile.id;
            return `
                <article class="workspace-message ${ownMessage ? 'client' : 'team'}">
                    <div class="workspace-message-meta">
                        <strong>${escapeHtml(ownMessage ? 'You' : sender?.full_name || 'Architech')}</strong>
                        <span>${escapeHtml(formatDateTime(message.created_at))}</span>
                    </div>
                    <p>${escapeHtml(message.body)}</p>
                </article>
            `;
        }).join('')
        : renderEmptyState('No messages yet', 'Use the composer to send a question or project note to the team.');
    byId('workspaceMessageThread').innerHTML = messageMarkup;

    fillProfileForm(state.profile);
}

function renderClientWorkspaceEmptyState(profile, client) {
    byId('workspaceClientName').textContent = client?.company_name || profile.full_name || 'Client Portal';
    byId('workspaceClientEmail').textContent = profile.email || SUPPORT_EMAIL;
    byId('workspaceClientMeta').textContent = 'No projects assigned yet';
    byId('workspaceProjectTitle').textContent = 'Portal setup in progress';
    if (byId('workspaceProjectSynopsis')) {
        byId('workspaceProjectSynopsis').textContent = 'Your workspace will populate as soon as your team assigns the first live project.';
    }
    updateWorkspaceChrome({
        projectLabel: 'Portal setup in progress',
        name: profile.full_name || client?.company_name || 'Client Portal',
        email: profile.email || SUPPORT_EMAIL,
        status: 'pending'
    });
    byId('workspaceProjectSelect').innerHTML = '<option value="">No projects assigned</option>';
    byId('workspaceOverviewMetrics').innerHTML = renderEmptyState('No active project yet', 'Your team has not assigned a project to this portal account yet.');
    byId('overviewSummaryTitle').textContent = 'We are preparing your workspace.';
    byId('overviewSummaryText').textContent = 'As soon as your project is assigned, milestones, files, invoices, and project messages will appear here.';
    byId('overviewActionsList').innerHTML = `
        <li>Contact ${escapeHtml(SUPPORT_EMAIL)} if you need urgent access help.</li>
        <li>Your portal will update automatically once the project is assigned.</li>
    `;
    byId('workspaceMilestoneList').innerHTML = renderEmptyState('No milestones yet', 'Milestones will appear after the project is configured.');
    byId('workspaceUpdateList').innerHTML = renderEmptyState('No updates yet', 'Project updates will appear after kickoff.');
    byId('workspaceDocumentList').innerHTML = renderEmptyState('No files yet', 'Shared files will appear here.');
    byId('workspaceInvoiceList').innerHTML = renderEmptyState('No invoices yet', 'Billing records will appear here.');
    byId('workspaceMessageThread').innerHTML = renderEmptyState('No messages yet', 'Project communication will appear here once the workspace is active.');
    fillProfileForm(profile);
}

function renderAdminWorkspace(state) {
    byId('workspaceClientName').textContent = state.profile.full_name || 'Architech Admin';
    byId('workspaceClientEmail').textContent = state.profile.email || SUPPORT_EMAIL;
    byId('workspaceClientMeta').textContent = 'Internal portal administration';

    const selectedProject = getSelectedProject(state);
    const selectedProjectDocuments = getProjectDocuments(state, state.selectedProjectId);
    const selectedProjectInvoices = getProjectInvoices(state, state.selectedProjectId);
    const selectedProjectMessages = getProjectMessages(state, state.selectedProjectId);
    const selectedProjectMilestones = getProjectMilestones(state);
    const selectedProjectUpdates = getProjectUpdates(state);

    byId('workspaceProjectTitle').textContent = selectedProject?.name || 'Select a project';
    if (byId('workspaceProjectSynopsis')) {
        byId('workspaceProjectSynopsis').textContent = selectedProject?.description || 'Manage clients, project delivery, files, billing, and permissions from the internal control layer.';
    }
    updateWorkspaceChrome({
        projectLabel: selectedProject?.name || 'Admin suite overview',
        name: state.profile.full_name || 'Architech Admin',
        email: state.profile.email || SUPPORT_EMAIL,
        status: selectedProject?.status || 'active'
    });
    byId('adminClientSelect').innerHTML = buildOptions(state.clients, state.selectedClientId, 'company_name', 'id', 'Select client');
    byId('adminProjectSelect').innerHTML = buildOptions(getProjectsForSelectedClient(state), state.selectedProjectId, 'name', 'id', 'Select project');

    byId('adminMetricsGrid').innerHTML = `
        <article class="workspace-kpi-card">
            <span>Portal clients</span>
            <strong>${state.clients.length}</strong>
        </article>
        <article class="workspace-kpi-card">
            <span>Active projects</span>
            <strong>${state.projects.length}</strong>
        </article>
        <article class="workspace-kpi-card">
            <span>Outstanding invoices</span>
            <strong>${formatCurrency(sumBy(state.invoices.filter((invoice) => !['paid', 'void'].includes(invoice.status)), 'amount'))}</strong>
        </article>
        <article class="workspace-kpi-card">
            <span>Client-visible files</span>
            <strong>${state.documents.length}</strong>
        </article>
    `;

    byId('adminRecentActivity').innerHTML = buildRecentActivityMarkup(state);
    byId('adminClientRoster').innerHTML = state.clients.length
        ? state.clients.map((client) => {
            const profile = state.profiles.find((item) => item.id === client.profile_id);
            const projectCount = state.projects.filter((project) => project.client_id === client.id).length;
            return `
                <button type="button" class="workspace-select-card ${client.id === state.selectedClientId ? 'active' : ''}" data-select-client="${escapeHtml(client.id)}">
                    <strong>${escapeHtml(client.company_name)}</strong>
                    <span>${escapeHtml(profile?.full_name || client.billing_email || 'Client contact')}</span>
                    <span>${projectCount} project${projectCount === 1 ? '' : 's'}</span>
                </button>
            `;
        }).join('')
        : renderEmptyState('No clients yet', 'Use the invite form to create your first client account.');

    byId('adminProjectList').innerHTML = getProjectsForSelectedClient(state).length
        ? getProjectsForSelectedClient(state).map((project) => `
            <article class="workspace-data-card">
                <div class="workspace-data-card-head">
                    <div>
                        <span>${escapeHtml(project.service_line || 'Portal project')}</span>
                        <h3>${escapeHtml(project.name)}</h3>
                    </div>
                    <button type="button" class="btn btn-outline btn-sm" data-select-project="${escapeHtml(project.id)}">Open</button>
                </div>
                <p>${escapeHtml(project.current_phase || project.description || 'No project summary has been added yet.')}</p>
                <div class="workspace-data-card-foot">
                    <strong>${project.target_launch_date ? `Launch ${formatDate(project.target_launch_date)}` : 'Launch date not set'}</strong>
                </div>
            </article>
        `).join('')
        : renderEmptyState('No projects for this client', 'Create a project and assign it to the selected client.');

    byId('adminMilestoneList').innerHTML = selectedProjectMilestones.length
        ? selectedProjectMilestones.map((milestone) => `
            <article class="workspace-data-card workspace-timeline-card">
                <div class="workspace-data-card-head">
                    <div>
                        <span>Milestone</span>
                        <h3>${escapeHtml(milestone.title)}</h3>
                    </div>
                    <span class="workspace-pill ${statusPillClass(milestone.status)}">${escapeHtml(humanizeStatus(milestone.status))}</span>
                </div>
                <p>${escapeHtml(milestone.description || 'No milestone details added yet.')}</p>
                <div class="workspace-data-card-foot">
                    <strong>${milestone.due_at ? `Due ${formatDate(milestone.due_at)}` : 'No due date set'}</strong>
                </div>
            </article>
        `).join('')
        : renderEmptyState('No milestones yet', 'Add milestones for the selected project to shape the client timeline.');

    byId('adminUpdateList').innerHTML = selectedProjectUpdates.length
        ? selectedProjectUpdates.map((update) => {
            const author = state.profiles.find((profile) => profile.id === update.author_id);
            return `
                <article class="workspace-data-card workspace-update-card">
                    <div class="workspace-data-card-head">
                        <div>
                            <span>${escapeHtml(humanizeStatus(update.status || 'update'))}</span>
                            <h3>${escapeHtml(update.title)}</h3>
                        </div>
                        <span class="workspace-pill">${formatDateTime(update.published_at)}</span>
                    </div>
                    <p>${escapeHtml(update.body)}</p>
                    <div class="workspace-data-card-foot">
                        <strong>${escapeHtml(author?.full_name || 'Architech')}</strong>
                    </div>
                </article>
            `;
        }).join('')
        : renderEmptyState('No updates published', 'Project updates become visible to clients as soon as you post them.');

    byId('adminDocumentList').innerHTML = selectedProjectDocuments.length
        ? selectedProjectDocuments.map((documentRecord) => `
            <article class="workspace-file-card">
                <span class="workspace-file-type">${escapeHtml(documentRecord.category || 'Document')}</span>
                <h3>${escapeHtml(documentRecord.file_name)}</h3>
                <p>${escapeHtml(formatFileMeta(documentRecord))}</p>
                <button type="button" class="btn btn-outline btn-sm" data-download-document="${escapeHtml(documentRecord.id)}">Download</button>
            </article>
        `).join('')
        : renderEmptyState('No deliverables uploaded', 'Upload files to make them immediately available to the client portal.');

    byId('adminInvoiceList').innerHTML = selectedProjectInvoices.length
        ? selectedProjectInvoices.map((invoice) => {
            const invoicePayments = state.payments.filter((payment) => payment.invoice_id === invoice.id);
            return `
                <article class="invoice-card ${invoice.status === 'paid' ? 'paid' : invoice.status === 'overdue' ? 'open' : 'upcoming'}">
                    <div class="invoice-card-head">
                        <div>
                            <span>${escapeHtml(invoice.invoice_number || 'Invoice')}</span>
                            <strong>${escapeHtml(invoice.title)}</strong>
                        </div>
                        <span class="workspace-pill ${statusPillClass(invoice.status)}">${escapeHtml(humanizeStatus(invoice.status))}</span>
                    </div>
                    <p>${escapeHtml(invoice.description || 'No invoice description added yet.')}</p>
                    <div class="invoice-card-foot">
                        <strong>${formatCurrency(invoice.amount)}</strong>
                        <span class="workspace-inline-note">${invoice.due_at ? `Due ${formatDate(invoice.due_at)}` : 'No due date set'}</span>
                    </div>
                    ${invoicePayments.length ? `<div class="workspace-inline-records">${invoicePayments.map((payment) => `<span class="workspace-pill success">${escapeHtml(formatCurrency(payment.amount))} ${escapeHtml(payment.method || 'recorded')}</span>`).join('')}</div>` : ''}
                </article>
            `;
        }).join('')
        : renderEmptyState('No invoices yet', 'Invoices and payment records for the selected project will appear here.');

    byId('adminMessageThread').innerHTML = selectedProjectMessages.length
        ? selectedProjectMessages.map((message) => {
            const sender = state.profiles.find((profile) => profile.id === message.sender_id);
            return `
                <article class="workspace-message ${message.is_internal ? 'team internal' : sender?.role === 'client' ? 'client' : 'team'}">
                    <div class="workspace-message-meta">
                        <strong>${escapeHtml(sender?.full_name || sender?.email || 'Architech')}</strong>
                        <span>${escapeHtml(formatDateTime(message.created_at))}</span>
                    </div>
                    <p>${escapeHtml(message.body)}</p>
                    ${message.is_internal ? '<span class="workspace-pill warning">Internal note</span>' : ''}
                </article>
            `;
        }).join('')
        : renderEmptyState('No messages yet', 'Messages and internal notes for the selected project will appear here.');

    byId('adminAccessList').innerHTML = buildAccessListMarkup(state);
    byId('adminPaymentInvoice').innerHTML = buildOptions(selectedProjectInvoices, '', 'title', 'id', 'Select invoice');
    byId('adminProjectClient').innerHTML = buildOptions(state.clients, state.selectedClientId, 'company_name', 'id', 'Select client');
    byId('adminAccessClient').innerHTML = buildOptions(state.clients, state.selectedClientId, 'company_name', 'id', 'Select client');
    byId('adminAccessProject').innerHTML = buildOptions(state.projects, state.selectedProjectId, 'name', 'id', 'Select project');
}

function buildRecentActivityMarkup(state) {
    const recent = [
        ...state.updates.map((item) => ({ type: 'Update', title: item.title, at: item.published_at })),
        ...state.documents.map((item) => ({ type: 'File', title: item.file_name, at: item.created_at })),
        ...state.invoices.map((item) => ({ type: 'Invoice', title: item.title, at: item.issued_at })),
        ...state.messages.map((item) => ({ type: item.is_internal ? 'Internal note' : 'Message', title: truncate(item.body, 72), at: item.created_at }))
    ]
        .filter((item) => item.at)
        .sort((left, right) => new Date(right.at) - new Date(left.at))
        .slice(0, 6);

    return recent.length
        ? recent.map((item) => `
            <article class="workspace-data-card workspace-activity-card">
                <div class="workspace-data-card-head">
                    <div>
                        <span>${escapeHtml(item.type)}</span>
                        <h3>${escapeHtml(item.title)}</h3>
                    </div>
                    <span class="workspace-pill">${escapeHtml(formatDateTime(item.at))}</span>
                </div>
            </article>
        `).join('')
        : renderEmptyState('No recent activity', 'Recent invoices, updates, files, and message traffic will appear here.');
}

function buildAccessListMarkup(state) {
    const memberships = state.memberships
        .filter((membership) => membership.membership_role === 'client')
        .map((membership) => {
            const project = state.projects.find((item) => item.id === membership.project_id);
            const profile = state.profiles.find((item) => item.id === membership.user_id);
            const client = state.clients.find((item) => item.profile_id === membership.user_id);

            if (!project || !profile || !client) {
                return null;
            }

            return `
                <article class="workspace-data-card">
                    <div class="workspace-data-card-head">
                        <div>
                            <span>${escapeHtml(client.company_name)}</span>
                            <h3>${escapeHtml(project.name)}</h3>
                        </div>
                        <button type="button" class="btn btn-outline btn-sm" data-remove-membership="${escapeHtml(membership.id)}">Remove Access</button>
                    </div>
                    <p>${escapeHtml(profile.full_name || profile.email || 'Client contact')}</p>
                    <div class="workspace-data-card-foot">
                        <strong>${escapeHtml(profile.email || client.billing_email || 'No email on file')}</strong>
                    </div>
                </article>
            `;
        })
        .filter(Boolean);

    return memberships.length
        ? memberships.join('')
        : renderEmptyState('No client assignments yet', 'Use the access form to attach client accounts to projects.');
}

function fillProfileForm(profile) {
    if (byId('workspaceProfileName')) {
        byId('workspaceProfileName').value = profile.full_name || '';
    }
    if (byId('workspaceProfileEmail')) {
        byId('workspaceProfileEmail').value = profile.email || '';
    }
    if (byId('workspaceProfilePhone')) {
        byId('workspaceProfilePhone').value = profile.phone || '';
    }
    if (byId('workspaceProfileTitle')) {
        byId('workspaceProfileTitle').value = profile.title || '';
    }
}

function updateWorkspaceChrome({ projectLabel, name, email, status }) {
    if (byId('workspaceHeaderProject')) {
        byId('workspaceHeaderProject').textContent = projectLabel || 'Architech Workspace';
    }

    if (byId('workspaceHeaderName')) {
        byId('workspaceHeaderName').textContent = name || 'Portal Account';
    }

    if (byId('workspaceHeaderEmail')) {
        byId('workspaceHeaderEmail').textContent = email || SUPPORT_EMAIL;
    }

    if (byId('workspaceAccountInitials')) {
        byId('workspaceAccountInitials').textContent = getInitials(name || email || 'AD');
    }

    const statusPill = byId('workspaceStatusPill');
    if (statusPill) {
        statusPill.textContent = humanizeStatus(status || 'active');
        statusPill.classList.remove('success', 'warning');
        const nextClass = statusPillClass(status);
        if (nextClass) {
            statusPill.classList.add(nextClass);
        }
    }
}

function setLoadingWorkspaceState() {
    updateWorkspaceChrome({
        projectLabel: 'Loading workspace...',
        name: 'Checking access',
        email: SUPPORT_EMAIL,
        status: 'loading'
    });
    byId('workspaceClientName')?.replaceChildren(document.createTextNode('Loading portal...'));
    if (byId('workspaceProjectSynopsis')) {
        byId('workspaceProjectSynopsis').textContent = 'Refreshing the workspace shell and loading live project data.';
    }
    if (byId('workspaceOverviewMetrics')) {
        byId('workspaceOverviewMetrics').innerHTML = renderEmptyState('Loading', 'Fetching your workspace data.');
    }
}

function renderMissingConfigState() {
    updateWorkspaceChrome({
        projectLabel: 'Portal setup required',
        name: 'Configuration needed',
        email: SUPPORT_EMAIL,
        status: 'warning'
    });

    if (byId('workspaceProjectSynopsis')) {
        byId('workspaceProjectSynopsis').textContent = 'Connect the Supabase project, schema, and edge function before the live portal can operate.';
    }

    const targets = ['loginStatus', 'workspaceAlert', 'adminAlert']
        .map((id) => byId(id))
        .filter(Boolean);

    targets.forEach((target) => {
        setInlineStatus(
            target,
            'Supabase is not configured yet. Add your project URL and anon key in js/portal-config.js, apply supabase/schema.sql, and deploy the admin-provision-user Edge Function.',
            'error'
        );
    });

    const gates = ['adminAccessGate', 'workspaceOverviewMetrics']
        .map((id) => byId(id))
        .filter(Boolean);

    gates.forEach((target) => {
        target.innerHTML = renderEmptyState(
            'Portal setup required',
            'This production portal is wired for Supabase, but the project credentials and schema still need to be connected.',
            `<a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" class="btn btn-primary btn-sm">Contact Support</a>`
        );
        target.classList.remove('is-hidden');
    });
}

function renderAdminAccessDenied() {
    const accessGate = byId('adminAccessGate');
    const appShell = byId('adminAppShell');

    updateWorkspaceChrome({
        projectLabel: 'Admin access only',
        name: 'Restricted access',
        email: SUPPORT_EMAIL,
        status: 'warning'
    });

    if (byId('workspaceProjectSynopsis')) {
        byId('workspaceProjectSynopsis').textContent = 'Sign in with an internal admin account to manage clients, projects, files, invoices, and permissions.';
    }

    accessGate.classList.remove('is-hidden');
    appShell.classList.add('is-hidden');
    accessGate.innerHTML = renderEmptyState(
        'Admin access only',
        'This workspace is reserved for internal portal administration. Sign in with an admin account to manage clients, projects, files, invoices, and permissions.',
        '<a href="client-login.html" class="btn btn-primary btn-sm">Go To Sign In</a>'
    );
}

function renderGlobalFailure(error) {
    const message = error?.message || 'The portal could not be initialized.';
    const targets = ['loginStatus', 'workspaceAlert', 'adminAlert']
        .map((id) => byId(id))
        .filter(Boolean);

    targets.forEach((target) => setInlineStatus(target, message, 'error'));
}

function initWorkspaceChrome() {
    if (document.body.dataset.workspaceChromeReady === 'true') {
        return;
    }

    document.body.dataset.workspaceChromeReady = 'true';

    const drawerToggle = byId('workspaceDrawerToggle');
    const drawerClose = byId('workspaceDrawerClose');
    const drawerBackdrop = byId('workspaceDrawerBackdrop');
    const accountShell = byId('workspaceAccountShell');
    const accountTrigger = byId('workspaceAccountTrigger');

    const closeDrawer = () => {
        document.body.classList.remove('workspace-drawer-open');
        document.body.style.overflow = '';
        drawerToggle?.setAttribute('aria-expanded', 'false');
    };

    const openDrawer = () => {
        document.body.classList.add('workspace-drawer-open');
        if (window.innerWidth <= 1100) {
            document.body.style.overflow = 'hidden';
        }
        drawerToggle?.setAttribute('aria-expanded', 'true');
    };

    const closeAccountMenu = () => {
        accountShell?.classList.remove('is-open');
        accountTrigger?.setAttribute('aria-expanded', 'false');
    };

    drawerToggle?.addEventListener('click', () => {
        if (document.body.classList.contains('workspace-drawer-open')) {
            closeDrawer();
        } else {
            openDrawer();
        }
    });

    drawerClose?.addEventListener('click', closeDrawer);
    drawerBackdrop?.addEventListener('click', closeDrawer);

    accountTrigger?.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = accountShell?.classList.contains('is-open');
        accountShell?.classList.toggle('is-open', !isOpen);
        accountTrigger.setAttribute('aria-expanded', String(!isOpen));
    });

    document.addEventListener('click', (event) => {
        if (accountShell && !accountShell.contains(event.target)) {
            closeAccountMenu();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeDrawer();
            closeAccountMenu();
        }
    });

    document.querySelectorAll('.workspace-nav-button, [data-open-workspace-tab], #portalSignOut, #workspaceAccountMenu a').forEach((control) => {
        control.addEventListener('click', () => {
            closeAccountMenu();
            if (window.innerWidth <= 1100) {
                closeDrawer();
            }
        });
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 1100) {
            document.body.style.overflow = '';
        }
    });
}

function activateWorkspaceTab(root, targetId) {
    if (!targetId) {
        return;
    }

    const buttons = root.querySelectorAll('.workspace-nav-button');
    const views = root.querySelectorAll('.workspace-view');

    buttons.forEach((item) => item.classList.toggle('active', item.dataset.workspaceTab === targetId));
    views.forEach((view) => view.classList.toggle('active', view.id === targetId));
}

function bindWorkspaceTabs(root) {
    root.querySelectorAll('.workspace-nav-button').forEach((button) => {
        if (button.dataset.tabsBound === 'true') {
            return;
        }

        button.dataset.tabsBound = 'true';
        button.addEventListener('click', () => activateWorkspaceTab(root, button.dataset.workspaceTab));
    });

    root.querySelectorAll('[data-open-workspace-tab]').forEach((trigger) => {
        if (trigger.dataset.tabsBound === 'true') {
            return;
        }

        trigger.dataset.tabsBound = 'true';
        trigger.addEventListener('click', () => activateWorkspaceTab(root, trigger.dataset.openWorkspaceTab));
    });
}

function getSelectedProject(state) {
    return state.projects.find((project) => project.id === state.selectedProjectId) || null;
}

function getProjectsForSelectedClient(state) {
    if (!state.selectedClientId) {
        return state.projects;
    }

    return state.projects.filter((project) => project.client_id === state.selectedClientId);
}

function getProjectMilestones(state) {
    return state.milestones.filter((milestone) => milestone.project_id === state.selectedProjectId);
}

function getProjectUpdates(state) {
    return state.updates.filter((update) => update.project_id === state.selectedProjectId);
}

function getProjectDocuments(state, projectId) {
    return state.documents.filter((documentRecord) => documentRecord.project_id === projectId);
}

function getProjectInvoices(state, projectId) {
    return state.invoices.filter((invoice) => invoice.project_id === projectId);
}

function getProjectMessages(state, projectId) {
    return state.messages.filter((message) => message.project_id === projectId);
}

function persistAdminSelection(state) {
    if (state.selectedClientId) {
        localStorage.setItem(ADMIN_CLIENT_STORAGE_KEY, state.selectedClientId);
    }
    if (state.selectedProjectId) {
        localStorage.setItem(ADMIN_PROJECT_STORAGE_KEY, state.selectedProjectId);
    }
}

function renderEmptyState(title, body, actionMarkup = '') {
    return `
        <div class="workspace-empty-state">
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(body)}</p>
            ${actionMarkup ? `<div class="workspace-empty-actions">${actionMarkup}</div>` : ''}
        </div>
    `;
}

function setInlineStatus(element, message, kind = 'info') {
    if (!element) {
        return;
    }

    element.textContent = message;
    element.classList.remove('success', 'error', 'warning');
    if (kind === 'success') {
        element.classList.add('success');
    }
    if (kind === 'error') {
        element.classList.add('error');
    }
    if (kind === 'warning') {
        element.classList.add('warning');
    }
}

function setAlert(element, message, kind = 'info') {
    if (!element) {
        return;
    }

    element.classList.remove('is-hidden', 'success', 'error', 'warning');
    element.textContent = message;
    if (kind === 'success') {
        element.classList.add('success');
    }
    if (kind === 'error') {
        element.classList.add('error');
    }
    if (kind === 'warning') {
        element.classList.add('warning');
    }
}

function clearAlert(element) {
    if (!element) {
        return;
    }

    element.textContent = '';
    element.classList.add('is-hidden');
    element.classList.remove('success', 'error', 'warning');
}

function setButtonBusy(button, isBusy, label) {
    if (!button) {
        return;
    }

    if (!button.dataset.defaultLabel) {
        button.dataset.defaultLabel = button.textContent.trim();
    }

    button.disabled = isBusy;
    button.textContent = isBusy ? label : button.dataset.defaultLabel;
}

function buildOptions(items, selectedValue, labelKey, valueKey, placeholder) {
    const placeholderOption = `<option value="">${escapeHtml(placeholder)}</option>`;
    return placeholderOption + items.map((item) => `
        <option value="${escapeHtml(item[valueKey])}" ${String(item[valueKey]) === String(selectedValue) ? 'selected' : ''}>${escapeHtml(item[labelKey])}</option>
    `).join('');
}

function humanizeStatus(value) {
    return String(value || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusPillClass(status) {
    const normalized = String(status || '').toLowerCase();
    if (['paid', 'approved', 'complete', 'completed', 'active', 'on track', 'on_track', 'live'].includes(normalized)) {
        return 'success';
    }
    if (['issued', 'upcoming', 'review', 'overdue', 'warning', 'pending', 'in review', 'in_review'].includes(normalized)) {
        return 'warning';
    }
    return '';
}

function getInitials(value) {
    const parts = String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length) {
        return 'AD';
    }

    return parts
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('');
}

function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    }).format(Number(value || 0));
}

function formatDate(value) {
    if (!value) {
        return 'Date not set';
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }).format(new Date(value));
}

function formatDateTime(value) {
    if (!value) {
        return 'Pending';
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    }).format(new Date(value));
}

function formatFileMeta(documentRecord) {
    const size = Number(documentRecord.file_size || 0);
    const sizeLabel = size >= 1048576
        ? `${(size / 1048576).toFixed(1)} MB`
        : size >= 1024
            ? `${Math.round(size / 1024)} KB`
            : `${size} B`;

    return `${sizeLabel} • ${formatDate(documentRecord.created_at)}`;
}

function createInvoiceNumber(seed) {
    return `${slugify(seed).slice(0, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);
}

function sanitizeFileName(value) {
    return String(value || '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/-+/g, '-');
}

function truncate(value, maxLength) {
    const text = String(value || '');
    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength - 1)}…`;
}

function sumBy(items, key) {
    return items.reduce((sum, item) => sum + Number(item[key] || 0), 0);
}

function indexBy(items, key) {
    return items.reduce((accumulator, item) => {
        accumulator[item[key]] = item;
        return accumulator;
    }, {});
}

function redirectTo(path) {
    window.location.href = path;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function byId(id) {
    return document.getElementById(id);
}
