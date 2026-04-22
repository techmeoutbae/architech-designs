import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const PORTAL_STORAGE_KEY = 'architech.portal.selectedProjectId';
const ADMIN_CLIENT_STORAGE_KEY = 'architech.admin.selectedClientId';
const ADMIN_PROJECT_STORAGE_KEY = 'architech.admin.selectedProjectId';
const PROFILE_SYNC_DISABLED_STORAGE_KEY = 'architech.portal.profileSyncDisabled';
const OPTIONAL_TABLE_CACHE_KEY = 'architech.portal.optionalTables';
const APP = document.body.dataset.app;
const CONFIG = window.ARCHITECH_PORTAL_CONFIG || {};
const SUPPORT_EMAIL = CONFIG.supportEmail || 'hello@architechdesigns.net';
const SITE_URL = String(CONFIG.siteUrl || 'https://www.architechdesigns.net').replace(/\/$/, '');
const STORAGE_BUCKET = CONFIG.storageBucket || 'client-documents';
const DEFAULT_STRIPE_API_URL = 'https://api.stripe.com/v1';
const STRIPE_PUBLISHABLE_KEY = CONFIG.stripePublishableKey || '';
const STRIPE_PAYMENT_LINK_URL = resolveConfiguredStripePaymentUrl(CONFIG);
const ADMIN_PROVISION_ENDPOINT = resolveAdminProvisionEndpoint(CONFIG);
const PROFILE_SYNC_ENDPOINT = resolvePortalProfileSyncEndpoint(CONFIG);

normalizeCurrentCleanUrl();

// Realtime project feed with polling fallback
let messagePollInterval = null;
let messageRealtimeChannel = null;

function stopMessageFeed(supabase) {
    if (messagePollInterval) {
        window.clearInterval(messagePollInterval);
        messagePollInterval = null;
    }

    if (messageRealtimeChannel) {
        supabase.removeChannel(messageRealtimeChannel);
        messageRealtimeChannel = null;
    }
}

function buildProjectMessageQuery(supabase, projectId, includeInternal = APP !== 'client-workspace') {
    let query = supabase
        .from('messages')
        .select('*')
        .eq('project_id', projectId);

    if (!includeInternal) {
        query = query.eq('is_internal', false);
    }

    return query.order('created_at', { ascending: true });
}

function startMessagePolling(supabase, projectId, onRefresh) {
    stopMessageFeed(supabase);

    if (!projectId) {
        return;
    }

    const refresh = typeof onRefresh === 'function'
        ? onRefresh
        : async () => {
            const { data } = await buildProjectMessageQuery(supabase, projectId);

            renderMessageThread(data || []);
        };

    const startPollingFallback = () => {
        if (messagePollInterval) {
            return;
        }

        messagePollInterval = window.setInterval(async () => {
            try {
                await refresh();
            } catch (error) {
                console.log('[Portal] Message refresh fallback:', error?.message || error);
            }
        }, 10000);
    };

    messageRealtimeChannel = supabase
        .channel(`portal-feed-${APP}-${projectId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `project_id=eq.${projectId}`
        }, async () => {
            await refresh();
        })
        .subscribe((status) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                startPollingFallback();
            }
        });

    startPollingFallback();
}

function renderMessageThread(messages) {
    const thread = document.getElementById('workspaceMessageThread');
    if (!thread) return;
    
    if (!messages || messages.length === 0) {
        thread.innerHTML = renderEmptyState('No messages yet', 'Use the composer to send a question or project note to the team.');
        return;
    }
    
    const currentUserId = window.currentUserId || '';
    
    thread.innerHTML = messages.map(message => {
        const ownMessage = message.sender_id === currentUserId;
        return `
            <article class="workspace-message ${ownMessage ? 'client' : 'team'}">
                <div class="workspace-message-meta">
                    <strong>${ownMessage ? 'You' : 'Architech Team'}</strong>
                    <span>${formatDateTime(message.created_at)}</span>
                </div>
                <p>${escapeHtml(message.body)}</p>
            </article>
        `;
    }).join('');
    
    thread.scrollTop = thread.scrollHeight;
}

// Stripe Payment Handler
async function handleStripePayment(supabase, invoiceId, invoiceNumber, invoiceTitle, paymentUrl) {
    const alert = byId('workspaceAlert');
    const directPaymentUrl = sanitizeExternalUrl(paymentUrl);

    if (directPaymentUrl) {
        const newWindow = window.open(directPaymentUrl, '_blank', 'noopener,noreferrer');
        if (!newWindow) {
            window.location.href = directPaymentUrl;
            return;
        }

        setAlert(alert, `External payment link opened for ${invoiceNumber || invoiceTitle || 'this invoice'}.`, 'info');
        return;
    }

    setAlert(alert, 'Preparing secure Stripe checkout...', 'info');

    const checkout = await createStripeCheckoutSession(supabase, invoiceId);
    if (!checkout.ok || !checkout.url) {
        const fallbackUrl = STRIPE_PAYMENT_LINK_URL;
        if (fallbackUrl) {
            const newWindow = window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
            if (!newWindow) {
                window.location.href = fallbackUrl;
                return;
            }

            setAlert(alert, 'Fallback Stripe payment link opened in a new tab.', 'info');
            return;
        }

        setAlert(alert, checkout.message || 'Stripe checkout could not be started for this invoice.', 'error');
        return;
    }

    window.location.href = checkout.url;
}

function bindPaymentHandlers(supabase) {
    document.querySelectorAll('[data-pay-invoice]').forEach(button => {
        button.addEventListener('click', async (e) => {
            const invoiceId = e.target.dataset.payInvoice;
            const invoiceNumber = e.target.dataset.invoiceNumber;
            const invoiceTitle = e.target.dataset.invoiceTitle;
            const paymentUrl = e.target.dataset.paymentUrl;
            await handleStripePayment(supabase, invoiceId, invoiceNumber, invoiceTitle, paymentUrl);
        });
    });
}

async function createStripeCheckoutSession(supabase, invoiceId) {
    try {
        const returnBaseUrl = new URL(window.location.href);
        returnBaseUrl.searchParams.delete('checkout');
        returnBaseUrl.searchParams.delete('invoice');
        returnBaseUrl.searchParams.delete('session_id');

        const successUrl = new URL(returnBaseUrl.toString());
        successUrl.searchParams.set('checkout', 'success');
        successUrl.searchParams.set('invoice', invoiceId);
        successUrl.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');

        const cancelUrl = new URL(returnBaseUrl.toString());
        cancelUrl.searchParams.set('checkout', 'cancel');
        cancelUrl.searchParams.set('invoice', invoiceId);

        const { data, error } = await supabase.functions.invoke('stripe-create-checkout-session', {
            body: {
                invoiceId,
                successUrl: successUrl.toString(),
                cancelUrl: cancelUrl.toString()
            }
        });

        if (error) {
            return {
                ok: false,
                message: error.message || 'Stripe checkout could not be created.'
            };
        }

        return {
            ok: true,
            url: sanitizeExternalUrl(data?.data?.url || data?.url || ''),
            sessionId: data?.data?.sessionId || data?.sessionId || ''
        };
    } catch (error) {
        return {
            ok: false,
            message: error?.message || 'Stripe checkout could not be created.'
        };
    }
}

function renderCheckoutStatusFromUrl(alert) {
    if (!alert) {
        return;
    }

    let url;
    try {
        url = new URL(window.location.href);
    } catch (error) {
        return;
    }

    const checkoutState = url.searchParams.get('checkout');
    if (!checkoutState) {
        return;
    }

    if (checkoutState === 'success') {
        setAlert(alert, 'Payment submitted successfully. Your invoice status will refresh automatically.', 'success');
    } else if (checkoutState === 'cancel') {
        setAlert(alert, 'Stripe checkout was cancelled. You can retry payment at any time.', 'info');
    }

    url.searchParams.delete('checkout');
    url.searchParams.delete('invoice');
    url.searchParams.delete('session_id');
    window.history.replaceState({}, document.title, url.toString());
}

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
        const userContext = await getCurrentUserContext(supabase, existingSession.user.id, existingSession);
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
        const userContext = session ? await getCurrentUserContext(supabase, session.user.id, session) : null;
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
            redirectTo: `${SITE_URL}/client-login`
        });

        if (error) {
            setInlineStatus(loginStatus, error.message || 'We could not send a reset email.', 'error');
            return;
        }

        setInlineStatus(loginStatus, 'Password reset email sent. Check your inbox for the secure link.', 'success');
    });
}

async function initClientWorkspacePage(supabase, userContext) {
    const accessGate = byId('workspaceAccessGate');
    const appShell = byId('clientWorkspaceShell');
    accessGate?.classList.add('is-hidden');
    appShell?.classList.remove('is-hidden');

    const state = {
        profile: userContext.profile,
        client: null,
        projects: [],
        selectedProjectId: localStorage.getItem(PORTAL_STORAGE_KEY) || '',
        projectDetail: null
    };

    window.currentUserId = state.profile.id;

    const signOutButton = byId('portalSignOut');
    const projectSelect = byId('workspaceProjectSelect');
    const alert = byId('workspaceAlert');
    const messageForm = byId('workspaceMessageForm');
    const profileForm = byId('workspaceProfileForm');
    const documentUploadForm = byId('workspaceDocumentUploadForm');
    const documentList = byId('workspaceDocumentList');

    bindWorkspaceTabs(document);
    initWorkspaceChrome();
    syncWorkspaceTabFromLocation(document);
    setLoadingWorkspaceState();

    signOutButton?.addEventListener('click', async () => {
        stopMessageFeed(supabase);
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

    documentUploadForm?.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!state.selectedProjectId) {
            setAlert(alert, 'Select a project before uploading a document.', 'error');
            return;
        }

        const file = byId('workspaceDocumentFile')?.files?.[0];
        if (!file) {
            setAlert(alert, 'Choose a file to upload.', 'error');
            return;
        }

        const category = byId('workspaceDocumentCategory')?.value.trim() || 'Client upload';
        const storagePath = `${state.selectedProjectId}/${Date.now()}-${sanitizeFileName(file.name)}`;

        setAlert(alert, 'Uploading your document...', 'info');

        const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false
        });

        if (uploadError) {
            setAlert(alert, uploadError.message || 'The file could not be uploaded.', 'error');
            return;
        }

        const { error: documentError } = await supabase.from('documents').insert({
            project_id: state.selectedProjectId,
            uploaded_by: state.profile.id,
            file_name: file.name,
            storage_path: storagePath,
            mime_type: file.type || 'application/octet-stream',
            file_size: file.size,
            category
        });

        if (documentError) {
            await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
            setAlert(alert, documentError.message || 'The document record could not be saved.', 'error');
            return;
        }

        documentUploadForm.reset();
        await loadSelectedProject();
        setAlert(alert, 'Document uploaded successfully.', 'success');
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
        stopMessageFeed(supabase);
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
        renderClientWorkspace(state, supabase);
        startMessagePolling(supabase, state.selectedProjectId, async () => {
            state.projectDetail = await fetchProjectDetail(supabase, state.selectedProjectId);
            renderClientWorkspace(state, supabase);
        });
        clearAlert(alert);
        renderCheckoutStatusFromUrl(alert);
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
        consultations: [],
        consultationSlotOverrides: [],
        availability: {
            consultations: {
                available: true,
                message: ''
            },
            consultationSlotOverrides: {
                available: true,
                message: ''
            }
        },
        selectedClientId: localStorage.getItem(ADMIN_CLIENT_STORAGE_KEY) || '',
        selectedProjectId: localStorage.getItem(ADMIN_PROJECT_STORAGE_KEY) || '',
        selectedConsultationId: '',
        selectedAvailabilityDate: ''
    };

    window.currentUserId = state.profile.id;

    bindWorkspaceTabs(document);
    initWorkspaceChrome();
    syncWorkspaceTabFromLocation(document);
    bindAdminEventHandlers();
    await refreshAdminData();

    function bindAdminRealtimeForSelectedProject() {
        startMessagePolling(supabase, state.selectedProjectId, async () => {
            state.messages = await fetchTable(supabase, 'messages', '*', (query) => query.order('created_at', { ascending: true }));
            renderAdminWorkspace(state);
        });
    }

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
        const consultationsResult = await fetchOptionalTable(supabase, 'consultations', '*', (query) => query.order('preferred_date', { ascending: true }).order('preferred_time', { ascending: true }));
        const slotOverridesResult = await fetchOptionalTable(supabase, 'consultation_slot_overrides', '*', (query) => query.order('slot_date', { ascending: true }).order('slot_time', { ascending: true }));
        state.consultations = consultationsResult.data;
        state.consultationSlotOverrides = slotOverridesResult.data;
        state.availability.consultations = {
            available: consultationsResult.available,
            message: consultationsResult.message
        };
        state.availability.consultationSlotOverrides = {
            available: slotOverridesResult.available,
            message: slotOverridesResult.message
        };

        if (!state.clients.some((client) => client.id === state.selectedClientId)) {
            state.selectedClientId = state.clients[0]?.id || '';
        }

        const visibleProjects = getProjectsForSelectedClient(state);
        if (!visibleProjects.some((project) => project.id === state.selectedProjectId)) {
            state.selectedProjectId = state.selectedClientId
                ? (visibleProjects[0]?.id || '')
                : (state.projects[0]?.id || '');
        }

        if (!state.consultations.some((consultation) => consultation.id === state.selectedConsultationId)) {
            state.selectedConsultationId = state.consultations[0]?.id || '';
        }

        const availabilityDays = buildConsultationAvailabilityDays();
        if (!availabilityDays.includes(state.selectedAvailabilityDate)) {
            state.selectedAvailabilityDate = availabilityDays[0] || '';
        }
        
        persistAdminSelection(state);
        renderAdminWorkspace(state);
        bindAdminRealtimeForSelectedProject();
        clearAlert(byId('adminAlert'));
    }

    function bindAdminEventHandlers() {
        byId('portalSignOut')?.addEventListener('click', async () => {
            stopMessageFeed(supabase);
            await supabase.auth.signOut();
            redirectTo('client-login.html');
        });

        byId('adminDocumentCancel')?.addEventListener('click', () => { resetAdminDocumentForm(); hideWorkspacePanel('adminDocumentPanel'); });
        byId('adminClientCancel')?.addEventListener('click', () => { resetAdminClientForm(); hideWorkspacePanel('adminClientPanel'); });
        byId('adminProjectCancel')?.addEventListener('click', () => { resetAdminProjectForm(); hideWorkspacePanel('adminProjectPanel'); });
        byId('adminMilestoneCancel')?.addEventListener('click', () => { resetAdminMilestoneForm(); hideWorkspacePanel('adminMilestonePanel'); });
        byId('adminUpdateCancel')?.addEventListener('click', () => { resetAdminUpdateForm(); hideWorkspacePanel('adminUpdatePanel'); });
        byId('adminInvoiceCancel')?.addEventListener('click', () => { resetAdminInvoiceForm(); hideWorkspacePanel('adminInvoicePanel'); });
        byId('adminMessageCancel')?.addEventListener('click', () => { resetAdminMessageForm(); hideWorkspacePanel('adminMessagePanel'); });
        byId('adminConsultationDelete')?.addEventListener('click', async () => {
            const consultationId = byId('adminConsultationId')?.value;
            const consultation = state.consultations.find((item) => item.id === consultationId);
            if (!consultation) {
                return;
            }

            const confirmed = await confirmWorkspaceAction({
                kicker: 'Delete consultation',
                title: `Delete ${consultation.company_name}?`,
                body: 'This removes the consultation request from the admin calendar history.',
                confirmLabel: 'Delete Consultation',
                tone: 'danger'
            });

            if (!confirmed) {
                return;
            }

            const { error } = await supabase.from('consultations').delete().eq('id', consultation.id);
            if (error) {
                setAlert(byId('adminAlert'), error.message || 'The consultation could not be deleted.', 'error');
                return;
            }

            state.selectedConsultationId = '';
            await refreshAdminData();
            setAlert(byId('adminAlert'), 'Consultation deleted.', 'success');
        });

        byId('adminAvailabilityDays')?.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-availability-date]');
            if (!trigger) {
                return;
            }

            state.selectedAvailabilityDate = trigger.dataset.availabilityDate;
            renderAdminWorkspace(state);
            showWorkspacePanel('adminAvailabilityPanel');
        });

        byId('adminAvailabilitySlots')?.addEventListener('click', async (event) => {
            const trigger = event.target.closest('[data-availability-slot]');
            if (!trigger) {
                return;
            }

            const slotDate = trigger.dataset.slotDate;
            const slotTime = trigger.dataset.slotTime;
            const slotBooked = trigger.dataset.slotBooked === 'true';
            if (!slotDate || !slotTime || slotBooked) {
                return;
            }

            const existingOverride = state.consultationSlotOverrides.find((item) => item.slot_date === slotDate && item.slot_time === slotTime);
            const nextAvailability = existingOverride ? !Boolean(existingOverride.is_available) : false;
            const payload = {
                slot_date: slotDate,
                slot_time: slotTime,
                is_available: nextAvailability,
                created_by: state.profile.id
            };

            const { error } = existingOverride
                ? await supabase.from('consultation_slot_overrides').update(payload).eq('id', existingOverride.id)
                : await supabase.from('consultation_slot_overrides').insert(payload);

            if (error) {
                setAlert(byId('adminAlert'), error.message || 'The consultation availability could not be updated.', 'error');
                return;
            }

            await refreshAdminData();
            setAlert(byId('adminAlert'), nextAvailability ? 'Consultation slot reopened.' : 'Consultation slot blocked.', 'success');
        });

        byId('adminClientSelect')?.addEventListener('change', (event) => {
            state.selectedClientId = event.target.value;
            const visibleProjects = getProjectsForSelectedClient(state);
            state.selectedProjectId = visibleProjects[0]?.id || '';
            persistAdminSelection(state);
            renderAdminWorkspace(state);
            bindAdminRealtimeForSelectedProject();
        });

        byId('adminProjectSelect')?.addEventListener('change', (event) => {
            state.selectedProjectId = event.target.value;
            persistAdminSelection(state);
            renderAdminWorkspace(state);
            bindAdminRealtimeForSelectedProject();
        });

        byId('adminClientRoster')?.addEventListener('click', async (event) => {
            const trigger = event.target.closest('[data-select-client]');
            if (!trigger) {
                const editTrigger = event.target.closest('[data-edit-client]');
                if (editTrigger) {
                    const client = state.clients.find((item) => item.id === editTrigger.dataset.editClient);
                    const profile = client ? state.profiles.find((item) => item.id === client.profile_id) : null;
                    populateAdminClientForm(client, profile);
                    return;
                }

                const deleteTrigger = event.target.closest('[data-delete-client]');
                if (!deleteTrigger) {
                    return;
                }

                const client = state.clients.find((item) => item.id === deleteTrigger.dataset.deleteClient);
                if (!client) {
                    return;
                }

                const confirmed = await confirmWorkspaceAction({
                    kicker: 'Delete client',
                    title: `Delete ${client.company_name}?`,
                    body: 'This removes the client record and all associated projects from the portal. The auth user will remain unless removed separately.',
                    confirmLabel: 'Delete Client',
                    tone: 'danger'
                });

                if (!confirmed) {
                    return;
                }

                const { error } = await supabase.from('clients').delete().eq('id', client.id);
                if (error) {
                    setAlert(byId('adminAlert'), error.message || 'The client could not be deleted.', 'error');
                    return;
                }

                resetAdminClientForm();
                await refreshAdminData();
                setAlert(byId('adminAlert'), 'Client deleted.', 'success');
                return;
            }

            state.selectedClientId = trigger.dataset.selectClient;
            const visibleProjects = getProjectsForSelectedClient(state);
            state.selectedProjectId = visibleProjects[0]?.id || '';
            persistAdminSelection(state);
            renderAdminWorkspace(state);
            bindAdminRealtimeForSelectedProject();
        });

        byId('adminProjectList')?.addEventListener('click', async (event) => {
            const selectTrigger = event.target.closest('[data-select-project]');
            if (selectTrigger) {
                state.selectedProjectId = selectTrigger.dataset.selectProject;
                const project = state.projects.find((item) => item.id === state.selectedProjectId);
                if (project?.client_id) {
                    state.selectedClientId = project.client_id;
                }
                persistAdminSelection(state);
                renderAdminWorkspace(state);
                bindAdminRealtimeForSelectedProject();
                return;
            }

            const editTrigger = event.target.closest('[data-edit-project]');
            if (editTrigger) {
                const project = state.projects.find((item) => item.id === editTrigger.dataset.editProject);
                populateAdminProjectForm(project);
                return;
            }

            const deleteTrigger = event.target.closest('[data-delete-project]');
            if (!deleteTrigger) {
                return;
            }

            const project = state.projects.find((item) => item.id === deleteTrigger.dataset.deleteProject);
            const confirmed = project && await confirmWorkspaceAction({
                kicker: 'Delete project',
                title: `Delete ${project?.name || 'project'}?`,
                body: 'This removes the project, related milestones, updates, messages, files, and invoices from the live portal.',
                confirmLabel: 'Delete Project',
                tone: 'danger'
            });

            if (!project || !confirmed) {
                return;
            }

            const { error } = await supabase.from('projects').delete().eq('id', project.id);
            if (error) {
                setAlert(byId('adminAlert'), error.message || 'The project could not be deleted.', 'error');
                return;
            }

            resetAdminProjectForm();
            await refreshAdminData();
            setAlert(byId('adminAlert'), 'Project deleted.', 'success');
        });

        byId('adminMilestoneList')?.addEventListener('click', async (event) => {
            const editTrigger = event.target.closest('[data-edit-milestone]');
            if (editTrigger) {
                const milestone = state.milestones.find((item) => item.id === editTrigger.dataset.editMilestone);
                populateAdminMilestoneForm(milestone);
                return;
            }

            const deleteTrigger = event.target.closest('[data-delete-milestone]');
            if (!deleteTrigger) {
                return;
            }

            const milestone = state.milestones.find((item) => item.id === deleteTrigger.dataset.deleteMilestone);
            const confirmed = milestone && await confirmWorkspaceAction({
                kicker: 'Delete milestone',
                title: `Delete ${milestone?.title || 'milestone'}?`,
                body: 'This removes the milestone from the selected client timeline.',
                confirmLabel: 'Delete Milestone',
                tone: 'danger'
            });

            if (!milestone || !confirmed) {
                return;
            }

            const { error } = await supabase.from('milestones').delete().eq('id', milestone.id);
            if (error) {
                setAlert(byId('adminAlert'), error.message || 'The milestone could not be deleted.', 'error');
                return;
            }

            resetAdminMilestoneForm();
            await refreshAdminData();
            setAlert(byId('adminAlert'), 'Milestone deleted.', 'success');
        });

        byId('adminUpdateList')?.addEventListener('click', async (event) => {
            const editTrigger = event.target.closest('[data-edit-update]');
            if (editTrigger) {
                const update = state.updates.find((item) => item.id === editTrigger.dataset.editUpdate);
                populateAdminUpdateForm(update);
                return;
            }

            const deleteTrigger = event.target.closest('[data-delete-update]');
            if (!deleteTrigger) {
                return;
            }

            const update = state.updates.find((item) => item.id === deleteTrigger.dataset.deleteUpdate);
            const confirmed = update && await confirmWorkspaceAction({
                kicker: 'Delete update',
                title: `Delete ${update?.title || 'update'}?`,
                body: 'This removes the published update from the selected project history.',
                confirmLabel: 'Delete Update',
                tone: 'danger'
            });

            if (!update || !confirmed) {
                return;
            }

            const { error } = await supabase.from('project_updates').delete().eq('id', update.id);
            if (error) {
                setAlert(byId('adminAlert'), error.message || 'The update could not be deleted.', 'error');
                return;
            }

            resetAdminUpdateForm();
            await refreshAdminData();
            setAlert(byId('adminAlert'), 'Project update deleted.', 'success');
        });

        byId('adminConsultationList')?.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-select-consultation]');
            if (!trigger) {
                return;
            }

            state.selectedConsultationId = trigger.dataset.selectConsultation;
            renderAdminWorkspace(state);
        });

        byId('adminDocumentList')?.addEventListener('click', async (event) => {
            const downloadTrigger = event.target.closest('[data-download-document]');
            if (downloadTrigger) {
                const documentRecord = state.documents.find((item) => item.id === downloadTrigger.dataset.downloadDocument);
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
                return;
            }

            const editTrigger = event.target.closest('[data-edit-document]');
            if (editTrigger) {
                const documentRecord = state.documents.find((item) => item.id === editTrigger.dataset.editDocument);
                populateAdminDocumentForm(documentRecord);
                return;
            }

            const deleteTrigger = event.target.closest('[data-delete-document]');
            if (!deleteTrigger) {
                return;
            }

            const documentRecord = state.documents.find((item) => item.id === deleteTrigger.dataset.deleteDocument);
            const confirmed = documentRecord && await confirmWorkspaceAction({
                kicker: 'Delete document',
                title: `Delete ${documentRecord?.file_name || 'document'}?`,
                body: 'This removes the file from storage and the live client portal.',
                confirmLabel: 'Delete Document',
                tone: 'danger'
            });

            if (!documentRecord || !confirmed) {
                return;
            }

            setAlert(byId('adminAlert'), 'Deleting document...', 'info');
            const { error: deleteError } = await supabase.from('documents').delete().eq('id', documentRecord.id);
            if (deleteError) {
                setAlert(byId('adminAlert'), deleteError.message || 'The document could not be deleted.', 'error');
                return;
            }

            await supabase.storage.from(STORAGE_BUCKET).remove([documentRecord.storage_path]);
            resetAdminDocumentForm();
            await refreshAdminData();
            setAlert(byId('adminAlert'), 'Document deleted.', 'success');
        });

        byId('adminInvoiceList')?.addEventListener('click', async (event) => {
            const editTrigger = event.target.closest('[data-edit-invoice]');
            if (editTrigger) {
                const invoice = state.invoices.find((item) => item.id === editTrigger.dataset.editInvoice);
                populateAdminInvoiceForm(invoice);
                return;
            }

            const paymentDeleteTrigger = event.target.closest('[data-delete-payment]');
            if (paymentDeleteTrigger) {
                const payment = state.payments.find((item) => item.id === paymentDeleteTrigger.dataset.deletePayment);
                if (!payment) {
                    return;
                }

                const confirmed = await confirmWorkspaceAction({
                    kicker: 'Delete payment',
                    title: 'Delete this payment record?',
                    body: 'This removes the payment record from the selected invoice history.',
                    confirmLabel: 'Delete Payment',
                    tone: 'danger'
                });

                if (!confirmed) {
                    return;
                }

                const { error } = await supabase.from('payment_records').delete().eq('id', payment.id);
                if (error) {
                    setAlert(byId('adminAlert'), error.message || 'The payment record could not be deleted.', 'error');
                    return;
                }

                await refreshAdminData();
                setAlert(byId('adminAlert'), 'Payment record deleted.', 'success');
                return;
            }

            const deleteTrigger = event.target.closest('[data-delete-invoice]');
            if (!deleteTrigger) {
                return;
            }

            const invoice = state.invoices.find((item) => item.id === deleteTrigger.dataset.deleteInvoice);
            const confirmed = invoice && await confirmWorkspaceAction({
                kicker: 'Delete invoice',
                title: `Delete ${invoice?.title || 'invoice'}?`,
                body: 'This removes the invoice and any related payment records tied to it.',
                confirmLabel: 'Delete Invoice',
                tone: 'danger'
            });

            if (!invoice || !confirmed) {
                return;
            }

            const { error } = await supabase.from('invoices').delete().eq('id', invoice.id);
            if (error) {
                setAlert(byId('adminAlert'), error.message || 'The invoice could not be deleted.', 'error');
                return;
            }

            resetAdminInvoiceForm();
            await refreshAdminData();
            setAlert(byId('adminAlert'), 'Invoice deleted.', 'success');
        });

        byId('adminMessageThread')?.addEventListener('click', async (event) => {
            const editTrigger = event.target.closest('[data-edit-message]');
            if (editTrigger) {
                const message = state.messages.find((item) => item.id === editTrigger.dataset.editMessage);
                populateAdminMessageForm(message);
                return;
            }

            const deleteTrigger = event.target.closest('[data-delete-message]');
            if (!deleteTrigger) {
                return;
            }

            const message = state.messages.find((item) => item.id === deleteTrigger.dataset.deleteMessage);
            const confirmed = message && await confirmWorkspaceAction({
                kicker: 'Delete message',
                title: 'Delete this message?',
                body: 'This removes the selected message from the project thread.',
                confirmLabel: 'Delete Message',
                tone: 'danger'
            });

            if (!message || !confirmed) {
                return;
            }

            const { error } = await supabase.from('messages').delete().eq('id', message.id);
            if (error) {
                setAlert(byId('adminAlert'), error.message || 'The message could not be deleted.', 'error');
                return;
            }

            resetAdminMessageForm();
            await refreshAdminData();
            hideWorkspacePanel('adminMessagePanel');
            setAlert(byId('adminAlert'), 'Message deleted.', 'success');
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
            hideWorkspacePanel('adminAccessPanel');
            setAlert(byId('adminAlert'), 'Project access removed.', 'success');
        });

        byId('adminClientForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const submitButton = form.querySelector('button[type="submit"]');
            setButtonBusy(submitButton, true, 'Sending Invite');
            setAlert(byId('adminAlert'), 'Provisioning the client account and invite...', 'info');

            const clientId = byId('adminClientId')?.value;
            const existingClient = clientId ? state.clients.find((item) => item.id === clientId) : null;
            const existingProfile = existingClient ? state.profiles.find((item) => item.id === existingClient.profile_id) : null;
            const payload = {
                fullName: byId('adminClientFullName')?.value.trim(),
                email: byId('adminClientEmail')?.value.trim().toLowerCase(),
                companyName: byId('adminClientCompany')?.value.trim(),
                billingEmail: byId('adminClientBillingEmail')?.value.trim().toLowerCase() || null,
                projectName: byId('adminClientProjectName')?.value.trim(),
                serviceLine: byId('adminClientServiceLine')?.value || 'Client Portal Engagement',
                redirectTo: `${SITE_URL}/client-login`
            };

            if (existingClient) {
                const { error: profileError } = await supabase.from('profiles').update({ full_name: payload.fullName }).eq('id', existingClient.profile_id);
                if (profileError) {
                    setAlert(byId('adminAlert'), profileError.message || 'The client profile could not be updated.', 'error');
                    setButtonBusy(submitButton, false, 'Save Client');
                    return;
                }

                const { error: clientError } = await supabase.from('clients').update({ company_name: payload.companyName, billing_email: payload.billingEmail || existingProfile?.email || null }).eq('id', existingClient.id);
                if (clientError) {
                    setAlert(byId('adminAlert'), clientError.message || 'The client could not be updated.', 'error');
                    setButtonBusy(submitButton, false, 'Save Client');
                    return;
                }

                resetAdminClientForm();
                await refreshAdminData();
                hideWorkspacePanel('adminClientPanel');
                setAlert(byId('adminAlert'), 'Client updated successfully.', 'success');
                setButtonBusy(submitButton, false, 'Send Invite + Create Client');
                return;
            }

            const provisioning = await invokeAdminProvisioning(supabase, payload);
            if (!provisioning.ok) {
                console.error('[Portal] Client provisioning failed', provisioning);
                setAlert(byId('adminAlert'), provisioning.message, 'error');
                setButtonBusy(submitButton, false, 'Send Invite + Create Client');
                return;
            }

            form.reset();
            await refreshAdminData();
            hideWorkspacePanel('adminClientPanel');
            setAlert(byId('adminAlert'), provisioning.message || 'Client account created and invite sent.', 'success');
            setButtonBusy(submitButton, false, 'Send Invite + Create Client');
        });

        byId('adminProjectForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!byId('adminProjectClient')?.value) {
                setAlert(byId('adminAlert'), 'Choose a client before creating a project.', 'error');
                return;
            }

            const projectId = byId('adminProjectId')?.value;
            const existingProject = projectId ? state.projects.find((item) => item.id === projectId) : null;
            const payload = {
                client_id: byId('adminProjectClient').value,
                name: byId('adminProjectName')?.value.trim(),
                slug: existingProject?.slug || buildProjectSlug(byId('adminProjectName')?.value.trim()),
                service_line: byId('adminProjectService')?.value.trim() || null,
                current_phase: byId('adminProjectPhase')?.value.trim() || null,
                target_launch_date: byId('adminProjectLaunch')?.value || null,
                description: byId('adminProjectDescription')?.value.trim() || null,
                created_by: existingProject?.created_by || state.profile.id
            };

            const { data, error } = existingProject
                ? await supabase.from('projects').update(payload).eq('id', existingProject.id).select().single()
                : await supabase.from('projects').insert(payload).select().single();
            if (error || !data) {
                setAlert(byId('adminAlert'), error?.message || 'The project could not be saved.', 'error');
                return;
            }

            const selectedClient = state.clients.find((client) => client.id === payload.client_id);
            if (!existingProject && selectedClient?.profile_id) {
                await supabase.from('project_memberships').upsert([
                    { project_id: data.id, user_id: state.profile.id, membership_role: 'admin', is_primary: false },
                    { project_id: data.id, user_id: selectedClient.profile_id, membership_role: 'client', is_primary: true }
                ], { onConflict: 'project_id,user_id' });
            }

            resetAdminProjectForm();
            state.selectedClientId = payload.client_id;
            state.selectedProjectId = data.id;
            await refreshAdminData();
            hideWorkspacePanel('adminProjectPanel');
            setAlert(byId('adminAlert'), existingProject ? 'Project updated successfully.' : 'Project created and assigned.', 'success');
        });

        byId('adminMilestoneForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!state.selectedProjectId) {
                setAlert(byId('adminAlert'), 'Select a project before adding milestones.', 'error');
                return;
            }

            const milestoneId = byId('adminMilestoneId')?.value;
            const existingMilestone = milestoneId ? state.milestones.find((item) => item.id === milestoneId) : null;
            const payload = {
                project_id: existingMilestone?.project_id || state.selectedProjectId,
                title: byId('adminMilestoneTitle')?.value.trim(),
                description: byId('adminMilestoneDescription')?.value.trim() || null,
                status: byId('adminMilestoneStatus')?.value || 'upcoming',
                due_at: byId('adminMilestoneDue')?.value || null,
                requires_approval: Boolean(byId('adminMilestoneApproval')?.checked),
                sort_order: existingMilestone?.sort_order || (getProjectMilestones(state).length + 1)
            };

            const { error } = existingMilestone
                ? await supabase.from('milestones').update(payload).eq('id', existingMilestone.id)
                : await supabase.from('milestones').insert(payload);
            if (error) {
                setAlert(byId('adminAlert'), error.message || 'The milestone could not be saved.', 'error');
                return;
            }

            resetAdminMilestoneForm();
            await refreshAdminData();
            hideWorkspacePanel('adminMilestonePanel');
            setAlert(byId('adminAlert'), existingMilestone ? 'Milestone updated successfully.' : 'Milestone added to the selected project.', 'success');
        });

        byId('adminUpdateForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!state.selectedProjectId) {
                setAlert(byId('adminAlert'), 'Select a project before posting updates.', 'error');
                return;
            }

            const updateId = byId('adminUpdateId')?.value;
            const existingUpdate = updateId ? state.updates.find((item) => item.id === updateId) : null;
            const payload = {
                project_id: existingUpdate?.project_id || state.selectedProjectId,
                author_id: existingUpdate?.author_id || state.profile.id,
                title: byId('adminUpdateTitle')?.value.trim(),
                body: byId('adminUpdateBody')?.value.trim(),
                status: byId('adminUpdateStatus')?.value || 'update'
            };

            const { error } = existingUpdate
                ? await supabase.from('project_updates').update(payload).eq('id', existingUpdate.id)
                : await supabase.from('project_updates').insert(payload);
            if (error) {
                setAlert(byId('adminAlert'), error.message || 'The project update could not be saved.', 'error');
                return;
            }

            resetAdminUpdateForm();
            await refreshAdminData();
            hideWorkspacePanel('adminUpdatePanel');
            setAlert(byId('adminAlert'), existingUpdate ? 'Project update updated successfully.' : 'Project update published.', 'success');
        });

        byId('adminDocumentForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!state.selectedProjectId) {
                setAlert(byId('adminAlert'), 'Select a project before uploading documents.', 'error');
                return;
            }

            const documentId = byId('adminDocumentId')?.value;
            const existingDocument = documentId ? state.documents.find((item) => item.id === documentId) : null;
            const file = byId('adminDocumentFile')?.files?.[0];
            if (!existingDocument && !file) {
                setAlert(byId('adminAlert'), 'Choose a file to upload.', 'error');
                return;
            }

            let nextStoragePath = existingDocument?.storage_path || '';
            let nextFileName = existingDocument?.file_name || '';
            let nextMimeType = existingDocument?.mime_type || 'application/octet-stream';
            let nextFileSize = existingDocument?.file_size || 0;
            let uploadedReplacementPath = '';

            if (file) {
                uploadedReplacementPath = `${state.selectedProjectId}/${Date.now()}-${sanitizeFileName(file.name)}`;
                const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(uploadedReplacementPath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

                if (uploadError) {
                    setAlert(byId('adminAlert'), uploadError.message || 'The file could not be uploaded.', 'error');
                    return;
                }

                nextStoragePath = uploadedReplacementPath;
                nextFileName = file.name;
                nextMimeType = file.type || 'application/octet-stream';
                nextFileSize = file.size;
            }

            const documentPayload = {
                project_id: existingDocument?.project_id || state.selectedProjectId,
                uploaded_by: existingDocument?.uploaded_by || state.profile.id,
                file_name: nextFileName,
                storage_path: nextStoragePath,
                mime_type: nextMimeType,
                file_size: nextFileSize,
                category: byId('adminDocumentCategory')?.value.trim() || 'Project file'
            };

            const { error: documentError } = existingDocument
                ? await supabase.from('documents').update(documentPayload).eq('id', existingDocument.id)
                : await supabase.from('documents').insert(documentPayload);

            if (documentError) {
                if (uploadedReplacementPath) {
                    await supabase.storage.from(STORAGE_BUCKET).remove([uploadedReplacementPath]);
                }
                setAlert(byId('adminAlert'), documentError.message || 'The file record could not be saved.', 'error');
                return;
            }

            if (existingDocument && uploadedReplacementPath && existingDocument.storage_path && existingDocument.storage_path !== uploadedReplacementPath) {
                await supabase.storage.from(STORAGE_BUCKET).remove([existingDocument.storage_path]);
            }

            resetAdminDocumentForm();
            await refreshAdminData();
            hideWorkspacePanel('adminDocumentPanel');
            setAlert(byId('adminAlert'), existingDocument ? 'Document updated successfully.' : 'Document uploaded to the client portal.', 'success');
        });

        byId('adminInvoiceForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!state.selectedProjectId) {
                setAlert(byId('adminAlert'), 'Select a project before creating invoices.', 'error');
                return;
            }

            const invoiceId = byId('adminInvoiceId')?.value;
            const existingInvoice = invoiceId ? state.invoices.find((item) => item.id === invoiceId) : null;
            const project = getSelectedProject(state);
            const payload = {
                project_id: existingInvoice?.project_id || state.selectedProjectId,
                created_by: existingInvoice?.created_by || state.profile.id,
                title: byId('adminInvoiceTitle')?.value.trim(),
                description: byId('adminInvoiceDescription')?.value.trim() || null,
                amount: Number(byId('adminInvoiceAmount')?.value || 0),
                currency: 'USD',
                status: byId('adminInvoiceStatus')?.value || 'issued',
                due_at: byId('adminInvoiceDue')?.value || null,
                payment_url: byId('adminInvoicePaymentUrl')?.value.trim() || null
            };

            if (!existingInvoice) {
                payload.invoice_number = createInvoiceNumber(project?.name || 'portal');
            }

            const { error } = existingInvoice
                ? await supabase.from('invoices').update(payload).eq('id', existingInvoice.id)
                : await supabase.from('invoices').insert(payload);
            if (error) {
                setAlert(byId('adminAlert'), error.message || 'The invoice could not be saved.', 'error');
                return;
            }

            resetAdminInvoiceForm();
            await refreshAdminData();
            hideWorkspacePanel('adminInvoicePanel');
            setAlert(byId('adminAlert'), existingInvoice ? 'Invoice updated successfully.' : 'Invoice created successfully.', 'success');
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
            hideWorkspacePanel('adminPaymentPanel');
            setAlert(byId('adminAlert'), 'Payment recorded successfully.', 'success');
        });

        byId('adminMessageForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!state.selectedProjectId) {
                setAlert(byId('adminAlert'), 'Select a project before sending messages.', 'error');
                return;
            }

            const messageId = byId('adminMessageId')?.value;
            const existingMessage = messageId ? state.messages.find((item) => item.id === messageId) : null;
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

            const { error } = existingMessage
                ? await supabase.from('messages').update({ body: payload.body, is_internal: payload.is_internal }).eq('id', existingMessage.id)
                : await supabase.from('messages').insert(payload);
            if (error) {
                setAlert(byId('adminAlert'), error.message || 'The message could not be saved.', 'error');
                return;
            }

            resetAdminMessageForm();
            await refreshAdminData();
            setAlert(byId('adminAlert'), existingMessage ? 'Message updated successfully.' : 'Message posted to the project thread.', 'success');
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

        byId('adminConsultationForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (state.availability.consultations?.available === false) {
                setAlert(byId('adminAlert'), state.availability.consultations.message, 'error');
                return;
            }

            const consultationId = byId('adminConsultationId')?.value;
            if (!consultationId) {
                setAlert(byId('adminAlert'), 'Choose a consultation before saving updates.', 'error');
                return;
            }

            const existingConsultation = state.consultations.find((item) => item.id === consultationId) || null;

            const payload = {
                status: byId('adminConsultationStatus')?.value || 'new',
                notes: byId('adminConsultationNotes')?.value.trim() || null,
                assigned_project_id: byId('adminConsultationProject')?.value || null,
                preferred_date: byId('adminConsultationDate')?.value || existingConsultation?.preferred_date || null,
                preferred_time: byId('adminConsultationTime')?.value.trim() || existingConsultation?.preferred_time || null
            };

            const { error } = await supabase.from('consultations').update(payload).eq('id', consultationId);
            if (error) {
                setAlert(byId('adminAlert'), error.message || 'The consultation could not be updated.', 'error');
                return;
            }

            state.selectedConsultationId = consultationId;
            await refreshAdminData();
            hideWorkspacePanel('adminConsultationPanel');
            setAlert(byId('adminAlert'), 'Consultation updated successfully.', 'success');
        });
    }
}

async function requireAuthenticatedProfile(supabase) {
    const session = await getSession(supabase);
    if (!session) {
        renderProtectedRouteRedirectState(APP);
        return null;
    }

    const userContext = await getCurrentUserContext(supabase, session.user.id, session);
    if (!userContext?.profile) {
        renderProtectedRouteRedirectState(APP);
        return null;
    }

    return userContext;
}

async function getSession(supabase) {
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
}

async function getCurrentUserContext(supabase, userId, session = null) {
    const activeSession = session || await getSession(supabase);
    let profile = await fetchProfileRecord(supabase, userId);
    if (!profile) {
        await synchronizePortalProfile(supabase, activeSession);
        profile = await fetchProfileRecord(supabase, userId);
    }

    if (!profile && activeSession?.user) {
        profile = await ensureSelfProfileRecord(supabase, activeSession.user);
    }

    return { profile };
}

async function synchronizePortalProfile(supabase, session = null) {
    const activeSession = session || await getSession(supabase);
    if (!activeSession?.access_token || isProfileSyncDisabled()) {
        return null;
    }

    if (PROFILE_SYNC_ENDPOINT) {
        try {
            const response = await fetch(PROFILE_SYNC_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${activeSession.access_token}`
                },
                body: JSON.stringify({})
            });

            if (response.status === 404 || response.status === 405) {
                setProfileSyncDisabled(true);
            } else {
                const body = await safeParseJson(response);
                if (!response.ok) {
                    console.warn('[Portal] Profile sync skipped', body?.message || response.statusText);
                } else {
                    setProfileSyncDisabled(false);
                    return body?.data || body || null;
                }
            }
        } catch (error) {
            console.warn('[Portal] Same-origin profile sync failed, falling back to Edge Function.', error);
        }
    }

    try {
        const { data, error } = await supabase.functions.invoke('portal-sync-profile', {
            body: {}
        });

        if (error) {
            console.warn('[Portal] Edge profile sync failed', error);
            return null;
        }

        setProfileSyncDisabled(false);
        return data?.data || data || null;
    } catch (error) {
        console.warn('[Portal] Profile sync failed', error);
        return null;
    }
}

async function fetchProfileRecord(supabase, userId) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) {
        throw error;
    }

    return data || null;
}

async function ensureSelfProfileRecord(supabase, user) {
    const payload = {
        id: user.id,
        email: user.email || '',
        full_name: resolveUserDisplayName(user)
    };

    const { data, error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' })
        .select('*')
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data || null;
}

function resolveUserDisplayName(user) {
    return user?.user_metadata?.full_name
        || user?.user_metadata?.fullName
        || user?.email?.split('@')[0]
        || '';
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
        fetchTable(supabase, 'messages', '*', () => buildProjectMessageQuery(supabase, projectId, APP !== 'client-workspace'))
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

async function fetchOptionalTable(supabase, table, columns, mutateQuery = (query) => query) {
    if (isOptionalTableCachedUnavailable(table)) {
        return {
            available: false,
            message: getOptionalTableUnavailableMessage(table),
            data: []
        };
    }

    try {
        const data = await fetchTable(supabase, table, columns, mutateQuery);
        clearOptionalTableUnavailable(table);
        return {
            available: true,
            message: '',
            data
        };
    } catch (error) {
        if (!isMissingTableError(error, table)) {
            throw error;
        }

        cacheOptionalTableUnavailable(table);
        console.warn(`[Portal] Optional table unavailable: ${table}`, error);
        return {
            available: false,
            message: getOptionalTableUnavailableMessage(table),
            data: []
        };
    }
}

async function fetchMaybeSingle(supabase, table, columns, mutateQuery = (query) => query) {
    const { data, error } = await mutateQuery(supabase.from(table).select(columns)).maybeSingle();
    if (error) {
        throw error;
    }

    return data || null;
}

function getWorkspaceHashTarget(root) {
    const targetId = window.location.hash.replace('#', '').trim();
    if (!targetId) {
        return '';
    }

    return root.querySelector(`.workspace-view[id="${targetId}"]`) ? targetId : '';
}

function syncWorkspaceTabFromLocation(root) {
    const targetId = getWorkspaceHashTarget(root);
    if (targetId) {
        activateWorkspaceTab(root, targetId, { updateHash: false });
    }
}

function renderClientWorkspace(state, supabase) {
    const selectedProject = state.projects.find((project) => project.id === state.selectedProjectId) || state.projects[0];
    const detail = state.projectDetail;
    const openInvoices = detail.invoices.filter((invoice) => !['paid', 'void'].includes(invoice.status));
    const paidInvoices = detail.invoices.filter((invoice) => invoice.status === 'paid');
    const completedMilestones = detail.milestones.filter((milestone) => ['approved', 'complete'].includes(milestone.status));
    const nextMilestone = detail.milestones.find((milestone) => !['approved', 'complete'].includes(milestone.status)) || detail.milestones[0];
    const totalCollected = detail.payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    byId('workspaceClientName')?.replaceChildren(document.createTextNode(state.client?.company_name || state.profile.full_name || 'Client Portal'));
    byId('workspaceClientEmail')?.replaceChildren(document.createTextNode(state.profile.email || SUPPORT_EMAIL));
    byId('workspaceClientMeta')?.replaceChildren(document.createTextNode(`${state.profile.full_name || 'Project contact'} | ${selectedProject.service_line || 'Portal project'}`));
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
    byId('workspaceQuickActions')?.replaceChildren();

    byId('workspaceOverviewMetrics').innerHTML = `
        <button type="button" class="workspace-kpi-card workspace-kpi-card-action" data-open-workspace-tab="workspace-overview">
            <span>Current phase</span>
            <strong>${escapeHtml(selectedProject.current_phase || 'Project delivery')}</strong>
            <em>${escapeHtml(humanizeStatus(selectedProject.status || 'active'))}</em>
        </button>
        <button type="button" class="workspace-kpi-card workspace-kpi-card-action" data-open-workspace-tab="workspace-milestones">
            <span>Milestones complete</span>
            <strong>${completedMilestones.length} of ${detail.milestones.length || 0}</strong>
            <em>${escapeHtml(nextMilestone?.title || 'No next milestone')}</em>
        </button>
        <button type="button" class="workspace-kpi-card workspace-kpi-card-action" data-open-workspace-tab="workspace-billing">
            <span>Open invoices</span>
            <strong>${openInvoices.length ? formatCurrency(sumBy(openInvoices, 'amount')) : 'All current'}</strong>
            <em>${openInvoices.length ? `${openInvoices.length} pending` : 'No balance due'}</em>
        </button>
        <button type="button" class="workspace-kpi-card workspace-kpi-card-action" data-open-workspace-tab="workspace-updates">
            <span>Collected to date</span>
            <strong>${formatCurrency(totalCollected)}</strong>
            <em>${paidInvoices.length} invoice${paidInvoices.length === 1 ? '' : 's'} closed</em>
        </button>
    `;

    byId('workspaceProjectSummaryPanel').innerHTML = buildClientSummaryPanelMarkup(selectedProject, nextMilestone, detail.documents.length, detail.messages.length);
    byId('workspaceBillingSnapshot').innerHTML = buildClientBillingSnapshotMarkup(openInvoices, totalCollected);
    byId('workspaceRecentUpdatePanel').innerHTML = buildClientRecentUpdatePanelMarkup(detail.updates, detail.profilesById);
    byId('workspaceCoordinationPanel').innerHTML = buildClientCoordinationPanelMarkup(selectedProject, nextMilestone, openInvoices.length);
    bindWorkspaceDashboardPanel('workspaceProjectSummaryPanel', 'workspace-milestones');
    bindWorkspaceDashboardPanel('workspaceBillingSnapshot', 'workspace-billing');
    bindWorkspaceDashboardPanel('workspaceRecentUpdatePanel', 'workspace-updates');
    bindWorkspaceDashboardPanel('workspaceCoordinationPanel', 'workspace-messages');

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
            const invoicePaymentUrl = getInvoicePaymentUrl(invoice);
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
                        ${invoice.status === 'paid'
                            ? '<span class="workspace-inline-note">Paid</span>'
                            : `<button type="button" class="btn btn-primary btn-sm" data-pay-invoice="${escapeHtml(invoice.id)}" data-payment-url="${escapeHtml(invoicePaymentUrl)}" data-invoice-number="${escapeHtml(invoice.invoice_number || 'Invoice')}" data-invoice-title="${escapeHtml(invoice.title)}">Pay Securely</button>`}
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
    bindWorkspaceTabs(document);
    bindPaymentHandlers(supabase);
}

function renderClientWorkspaceEmptyState(profile, client) {
    byId('workspaceClientName')?.replaceChildren(document.createTextNode(client?.company_name || profile.full_name || 'Client Portal'));
    byId('workspaceClientEmail')?.replaceChildren(document.createTextNode(profile.email || SUPPORT_EMAIL));
    byId('workspaceClientMeta')?.replaceChildren(document.createTextNode('No projects assigned yet'));
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
    byId('workspaceQuickActions')?.replaceChildren();
    byId('workspaceOverviewMetrics').innerHTML = renderEmptyState('No active project yet', 'Your team has not assigned a project to this portal account yet.');
    byId('workspaceProjectSummaryPanel').innerHTML = renderEmptyState('We are preparing your workspace', 'As soon as your project is assigned, your summary, milestones, files, invoices, and project updates will appear here.');
    byId('workspaceBillingSnapshot').innerHTML = renderEmptyState('Billing will appear here', 'Invoice status and payment records populate automatically once the project is active.');
    byId('workspaceRecentUpdatePanel').innerHTML = renderEmptyState('No updates yet', 'Published project updates will appear here first so you can scan progress quickly.');
    byId('workspaceCoordinationPanel').innerHTML = renderEmptyState('Coordination panel offline', `Contact ${escapeHtml(SUPPORT_EMAIL)} if you need urgent access support.`);
    bindWorkspaceDashboardPanel('workspaceProjectSummaryPanel', 'workspace-milestones');
    bindWorkspaceDashboardPanel('workspaceBillingSnapshot', 'workspace-billing');
    bindWorkspaceDashboardPanel('workspaceRecentUpdatePanel', 'workspace-updates');
    bindWorkspaceDashboardPanel('workspaceCoordinationPanel', 'workspace-account');
    byId('workspaceMilestoneList').innerHTML = renderEmptyState('No milestones yet', 'Milestones will appear after the project is configured.');
    byId('workspaceUpdateList').innerHTML = renderEmptyState('No updates yet', 'Project updates will appear after kickoff.');
    byId('workspaceDocumentList').innerHTML = renderEmptyState('No files yet', 'Shared files will appear here.');
    byId('workspaceInvoiceList').innerHTML = renderEmptyState('No invoices yet', 'Billing records will appear here.');
    byId('workspaceMessageThread').innerHTML = renderEmptyState('No messages yet', 'Project communication will appear here once the workspace is active.');
    fillProfileForm(profile);
    bindWorkspaceTabs(document);
}

function buildClientQuickActionsMarkup(hasOpenInvoices) {
    return `
        <button type="button" class="workspace-quick-action workspace-quick-action-primary" data-open-workspace-tab="workspace-messages" data-focus-target="workspaceMessageInput">
            <span>Message Team</span>
            <strong>Send a project note instantly</strong>
        </button>
        <button type="button" class="workspace-quick-action" data-open-workspace-tab="workspace-documents" data-focus-target="workspaceDocumentCategory">
            <span>Upload File</span>
            <strong>Share approvals or reference assets</strong>
        </button>
        <button type="button" class="workspace-quick-action" data-open-workspace-tab="workspace-billing">
            <span>${hasOpenInvoices ? 'Review Invoice' : 'Billing'}</span>
            <strong>${hasOpenInvoices ? 'Open the current payment view' : 'See billing history'}</strong>
        </button>
        <button type="button" class="workspace-quick-action" data-open-workspace-tab="workspace-account" data-focus-target="workspaceProfileName">
            <span>Account</span>
            <strong>Keep contact details current</strong>
        </button>
    `;
}

function buildClientSummaryPanelMarkup(project, nextMilestone, documentCount, messageCount) {
    return `
        <div class="workspace-panel-head">
            <div>
                <span class="workspace-panel-kicker">Project Summary</span>
                <h3>${escapeHtml(project.current_phase || project.name)}</h3>
            </div>
            <span class="workspace-pill ${statusPillClass(project.status || 'active')}">${escapeHtml(humanizeStatus(project.status || 'active'))}</span>
        </div>
        <p>${escapeHtml(project.description || 'Your private workspace keeps delivery, billing, and communication organized in one place.')}</p>
        <div class="ops-context-grid client-context-grid">
            <article class="ops-context-stat">
                <span>Launch target</span>
                <strong>${escapeHtml(project.target_launch_date ? formatDate(project.target_launch_date) : 'Not scheduled')}</strong>
            </article>
            <article class="ops-context-stat">
                <span>Files shared</span>
                <strong>${documentCount}</strong>
            </article>
            <article class="ops-context-stat">
                <span>Messages</span>
                <strong>${messageCount}</strong>
            </article>
        </div>
        <div class="ops-context-list">
            <div>
                <span>Next milestone</span>
                <strong>${escapeHtml(nextMilestone?.title || 'No milestone is currently queued')}</strong>
            </div>
            <div>
                <span>Service line</span>
                <strong>${escapeHtml(project.service_line || 'Premium website system')}</strong>
            </div>
        </div>
    `;
}

function buildClientBillingSnapshotMarkup(openInvoices, totalCollected) {
    const nextInvoice = openInvoices[0] || null;
    return `
        <div class="workspace-panel-head">
            <div>
                <span class="workspace-panel-kicker">Billing Snapshot</span>
                <h3>${openInvoices.length ? 'Payment attention needed' : 'Billing is current'}</h3>
            </div>
        </div>
        <div class="ops-dashboard-list">
            <article class="ops-dashboard-list-item">
                <strong>${openInvoices.length ? formatCurrency(sumBy(openInvoices, 'amount')) : 'No balance due'}</strong>
                <span>Outstanding total</span>
            </article>
            <article class="ops-dashboard-list-item">
                <strong>${formatCurrency(totalCollected)}</strong>
                <span>Collected to date</span>
            </article>
            <article class="ops-dashboard-list-item">
                <strong>${escapeHtml(nextInvoice?.title || 'No active invoice')}</strong>
                <span>${escapeHtml(nextInvoice?.due_at ? `Due ${formatDate(nextInvoice.due_at)}` : 'Everything is current')}</span>
            </article>
        </div>
    `;
}

function buildClientRecentUpdatePanelMarkup(updates, profilesById) {
    const recentUpdates = updates.slice(0, 3);
    return `
        <div class="workspace-panel-head">
            <div>
                <span class="workspace-panel-kicker">Recent Updates</span>
                <h3>${recentUpdates.length ? 'Latest project notes' : 'No updates yet'}</h3>
            </div>
        </div>
        ${recentUpdates.length
            ? `<div class="ops-dashboard-list">${recentUpdates.map((update) => {
                const author = profilesById[update.author_id];
                return `
                    <article class="ops-dashboard-list-item">
                        <strong>${escapeHtml(update.title)}</strong>
                        <span>${escapeHtml(author?.full_name || 'Architech')} • ${escapeHtml(formatDateTime(update.published_at))}</span>
                        <em>${escapeHtml(truncate(update.body, 110))}</em>
                    </article>
                `;
            }).join('')}</div>`
            : renderEmptyState('No updates published', 'Structured project updates from the team will appear here first so you can scan progress quickly.')}
    `;
}

function buildClientCoordinationPanelMarkup(project, nextMilestone, openInvoiceCount) {
    return `
        <div class="workspace-panel-head">
            <div>
                <span class="workspace-panel-kicker">Next Actions</span>
                <h3>Keep the project moving</h3>
            </div>
        </div>
        <ul class="workspace-list">
            <li>${escapeHtml(nextMilestone ? `Review ${nextMilestone.title}${nextMilestone.due_at ? ` by ${formatDate(nextMilestone.due_at)}` : ''}.` : 'No milestone action is required right now.')}</li>
            <li>${escapeHtml(project.target_launch_date ? `Launch target is ${formatDate(project.target_launch_date)}.` : 'Launch target will appear here when scheduled.')}</li>
            <li>${escapeHtml(openInvoiceCount ? `${openInvoiceCount} invoice${openInvoiceCount === 1 ? '' : 's'} currently need attention.` : 'Billing is current for this project.')}</li>
        </ul>
    `;
}

function renderAdminWorkspace(state) {
    byId('workspaceClientName')?.replaceChildren(document.createTextNode(state.profile.full_name || 'Architech Admin'));
    byId('workspaceClientEmail')?.replaceChildren(document.createTextNode(state.profile.email || SUPPORT_EMAIL));
    byId('workspaceClientMeta')?.replaceChildren(document.createTextNode('Internal portal administration'));

    const selectedProject = getSelectedProject(state);
    const selectedConsultation = getSelectedConsultation(state);
    const selectedProjectDocuments = getProjectDocuments(state, state.selectedProjectId);
    const selectedProjectInvoices = getProjectInvoices(state, state.selectedProjectId);
    const selectedProjectMessages = getProjectMessages(state, state.selectedProjectId);
    const selectedProjectMilestones = getProjectMilestones(state);
    const selectedProjectUpdates = getProjectUpdates(state);
    const upcomingConsultations = getUpcomingConsultations(state);
    const consultationFeedAvailable = state.availability?.consultations?.available !== false;
    const consultationFeedMessage = state.availability?.consultations?.message
        || 'The consultation calendar is unavailable right now, so the admin suite loaded without that feed.';

    if (byId('adminDocumentId')?.value && !selectedProjectDocuments.some((item) => item.id === byId('adminDocumentId').value)) {
        resetAdminDocumentForm();
    }
    if (byId('adminProjectId')?.value && !state.projects.some((item) => item.id === byId('adminProjectId').value)) {
        resetAdminProjectForm();
    }
    if (byId('adminMilestoneId')?.value && !selectedProjectMilestones.some((item) => item.id === byId('adminMilestoneId').value)) {
        resetAdminMilestoneForm();
    }
    if (byId('adminUpdateId')?.value && !selectedProjectUpdates.some((item) => item.id === byId('adminUpdateId').value)) {
        resetAdminUpdateForm();
    }
    if (byId('adminInvoiceId')?.value && !selectedProjectInvoices.some((item) => item.id === byId('adminInvoiceId').value)) {
        resetAdminInvoiceForm();
    }
    if (byId('adminMessageId')?.value && !selectedProjectMessages.some((item) => item.id === byId('adminMessageId').value)) {
        resetAdminMessageForm();
    }

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
    byId('adminQuickActions')?.replaceChildren();

    byId('adminMetricsGrid').innerHTML = `
        <button type="button" class="workspace-kpi-card workspace-kpi-card-action" data-open-workspace-tab="ops-clients">
            <span>Portal clients</span>
            <strong>${state.clients.length}</strong>
            <em>${state.clients.length ? 'Live client accounts' : 'Ready to onboard'}</em>
        </button>
        <button type="button" class="workspace-kpi-card workspace-kpi-card-action" data-open-workspace-tab="ops-projects">
            <span>Active projects</span>
            <strong>${state.projects.length}</strong>
            <em>${selectedProject ? escapeHtml(selectedProject.name) : 'Select a project'}</em>
        </button>
        <button type="button" class="workspace-kpi-card workspace-kpi-card-action" data-open-workspace-tab="ops-finance">
            <span>Outstanding invoices</span>
            <strong>${formatCurrency(sumBy(state.invoices.filter((invoice) => !['paid', 'void'].includes(invoice.status)), 'amount'))}</strong>
            <em>${state.invoices.filter((invoice) => !['paid', 'void'].includes(invoice.status)).length} open records</em>
        </button>
        <button type="button" class="workspace-kpi-card workspace-kpi-card-action" data-open-workspace-tab="ops-deliverables">
            <span>Client-visible files</span>
            <strong>${state.documents.length}</strong>
            <em>${selectedProjectDocuments.length} in selected project</em>
        </button>
        <button type="button" class="workspace-kpi-card workspace-kpi-card-action" data-open-workspace-tab="ops-consultations">
            <span>${consultationFeedAvailable ? 'Upcoming consultations' : 'Consultation calendar'}</span>
            <strong>${consultationFeedAvailable ? upcomingConsultations.length : 'Offline'}</strong>
            <em>${consultationFeedAvailable ? 'Priority queue' : 'Reconnect feed'}</em>
        </button>
    `;

    byId('adminSelectedProjectPanel').innerHTML = buildAdminContextMarkup(state, selectedProject, selectedProjectMilestones, selectedProjectInvoices, selectedProjectDocuments, selectedProjectMessages);
    byId('adminUpcomingConsultationsPanel').innerHTML = buildAdminConsultationSnapshotMarkup(upcomingConsultations, consultationFeedAvailable, consultationFeedMessage);
    byId('adminRecentActivity').innerHTML = buildRecentActivityMarkup(state);
    byId('adminSystemOverview').innerHTML = buildAdminSystemOverviewMarkup(state, selectedProject, selectedProjectUpdates);
    bindWorkspaceDashboardPanel('adminSelectedProjectPanel', 'ops-projects');
    bindWorkspaceDashboardPanel('adminUpcomingConsultationsPanel', 'ops-consultations');
    bindWorkspaceDashboardPanel('adminRecentActivity', 'ops-messages');
    bindWorkspaceDashboardPanel('adminSystemOverview', 'ops-finance');
    byId('adminConsultationList').innerHTML = consultationFeedAvailable
        ? (state.consultations.length
            ? state.consultations.map((consultation) => `
            <button type="button" class="workspace-select-card workspace-select-card-rich ${consultation.id === state.selectedConsultationId ? 'active' : ''}" data-select-consultation="${escapeHtml(consultation.id)}">
                <div class="workspace-select-card-head">
                    <strong>${escapeHtml(consultation.company_name)}</strong>
                    <span class="workspace-pill ${statusPillClass(consultation.status || 'new')}">${escapeHtml(humanizeStatus(consultation.status || 'new'))}</span>
                </div>
                <span>${escapeHtml(consultation.full_name)} • ${escapeHtml(consultation.preferred_time || 'Pending time')}</span>
                <span>${escapeHtml(formatConsultationDate(consultation.preferred_date))} • ${escapeHtml(consultation.requested_service || 'Consultation brief')}</span>
            </button>
        `).join('')
            : renderEmptyState('No consultations yet', 'New consultation requests from the contact page will appear here.'))
        : renderEmptyState('Consultation calendar unavailable', consultationFeedMessage);
    byId('adminClientRoster').innerHTML = state.clients.length
        ? state.clients.map((client) => {
            const profile = state.profiles.find((item) => item.id === client.profile_id);
            const projectCount = state.projects.filter((project) => project.client_id === client.id).length;
            return `
                <article class="workspace-select-card workspace-select-card-rich ${client.id === state.selectedClientId ? 'active' : ''}">
                    <button type="button" class="workspace-select-card-hit" data-select-client="${escapeHtml(client.id)}" aria-label="Open ${escapeHtml(client.company_name)}"></button>
                    <div class="workspace-select-card-head">
                        <strong>${escapeHtml(client.company_name)}</strong>
                        <span class="workspace-pill ${statusPillClass(client.status || 'active')}">${escapeHtml(humanizeStatus(client.status || 'active'))}</span>
                    </div>
                    <span>${escapeHtml(profile?.full_name || client.billing_email || 'Client contact')}</span>
                    <span>${projectCount} project${projectCount === 1 ? '' : 's'} • ${escapeHtml(client.billing_email || profile?.email || 'No billing email')}</span>
                    <div class="workspace-card-actions">
                        <button type="button" class="btn btn-outline btn-sm" data-edit-client="${escapeHtml(client.id)}">Edit</button>
                        <button type="button" class="btn btn-outline btn-sm workspace-action-danger" data-delete-client="${escapeHtml(client.id)}">Delete</button>
                    </div>
                </article>
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
                <div class="workspace-card-actions">
                    <button type="button" class="btn btn-outline btn-sm" data-edit-project="${escapeHtml(project.id)}">Edit</button>
                    <button type="button" class="btn btn-outline btn-sm workspace-action-danger" data-delete-project="${escapeHtml(project.id)}">Delete</button>
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
                <div class="workspace-card-actions">
                    <button type="button" class="btn btn-outline btn-sm" data-edit-milestone="${escapeHtml(milestone.id)}">Edit</button>
                    <button type="button" class="btn btn-outline btn-sm workspace-action-danger" data-delete-milestone="${escapeHtml(milestone.id)}">Delete</button>
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
                    <div class="workspace-card-actions">
                        <button type="button" class="btn btn-outline btn-sm" data-edit-update="${escapeHtml(update.id)}">Edit</button>
                        <button type="button" class="btn btn-outline btn-sm workspace-action-danger" data-delete-update="${escapeHtml(update.id)}">Delete</button>
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
                <div class="workspace-card-actions">
                    <button type="button" class="btn btn-outline btn-sm" data-download-document="${escapeHtml(documentRecord.id)}">Download</button>
                    <button type="button" class="btn btn-outline btn-sm" data-edit-document="${escapeHtml(documentRecord.id)}">Edit</button>
                    <button type="button" class="btn btn-outline btn-sm workspace-action-danger" data-delete-document="${escapeHtml(documentRecord.id)}">Delete</button>
                </div>
            </article>
        `).join('')
        : renderEmptyState('No deliverables uploaded', 'Upload files to make them immediately available to the client portal.');

    byId('adminInvoiceList').innerHTML = selectedProjectInvoices.length
        ? selectedProjectInvoices.map((invoice) => {
            const invoicePayments = state.payments.filter((payment) => payment.invoice_id === invoice.id);
            const invoicePaymentUrl = getInvoicePaymentUrl(invoice);
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
                        <span class="workspace-inline-note">${invoicePaymentUrl ? 'External payment link attached' : 'Portal checkout will generate at payment time'}</span>
                    </div>
                    <div class="workspace-card-actions">
                        <button type="button" class="btn btn-outline btn-sm" data-edit-invoice="${escapeHtml(invoice.id)}">Edit</button>
                        <button type="button" class="btn btn-outline btn-sm workspace-action-danger" data-delete-invoice="${escapeHtml(invoice.id)}">Delete</button>
                    </div>
                    ${invoicePaymentUrl ? `<div class="workspace-inline-records"><a class="workspace-pill" href="${escapeHtml(invoicePaymentUrl)}" target="_blank" rel="noopener noreferrer">Open payment link</a></div>` : ''}
                    ${invoicePayments.length ? `<div class="workspace-inline-records">${invoicePayments.map((payment) => `<button type="button" class="workspace-pill success workspace-pill-action" data-delete-payment="${escapeHtml(payment.id)}">${escapeHtml(formatCurrency(payment.amount))} ${escapeHtml(payment.method || 'recorded')} ×</button>`).join('')}</div>` : ''}
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
                        <div class="workspace-message-meta-actions">
                            <span>${escapeHtml(formatDateTime(message.created_at))}</span>
                            <button type="button" class="workspace-message-action" data-edit-message="${escapeHtml(message.id)}">Edit</button>
                            <button type="button" class="workspace-message-action workspace-action-danger" data-delete-message="${escapeHtml(message.id)}">Delete</button>
                        </div>
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
    byId('adminConsultationProject').innerHTML = consultationFeedAvailable
        ? buildOptions(state.projects, selectedConsultation?.assigned_project_id || '', 'name', 'id', 'No linked project')
        : '<option value="">Calendar unavailable</option>';
    byId('adminConsultationId').value = selectedConsultation?.id || '';
    byId('adminConsultationStatus').value = selectedConsultation?.status || 'new';
    byId('adminConsultationDate').value = selectedConsultation?.preferred_date || '';
    byId('adminConsultationTime').value = selectedConsultation?.preferred_time || '';
    byId('adminConsultationNotes').value = selectedConsultation?.notes || '';
    byId('adminConsultationDelete')?.classList.toggle('is-hidden', !selectedConsultation);
    byId('adminAvailabilityDays').innerHTML = buildAdminAvailabilityDaysMarkup(state);
    byId('adminAvailabilitySlots').innerHTML = buildAdminAvailabilitySlotsMarkup(state);
    byId('adminAvailabilityCard')?.classList.toggle('is-disabled', state.availability.consultationSlotOverrides?.available === false);
    toggleFormDisabled(byId('adminConsultationForm'), !consultationFeedAvailable);
    byId('adminConsultationDetail').innerHTML = !consultationFeedAvailable
        ? renderEmptyState('Consultation calendar unavailable', consultationFeedMessage)
        : selectedConsultation
        ? `
            <div class="workspace-data-card-head">
                <div>
                    <span>${escapeHtml(humanizeStatus(selectedConsultation.status || 'new'))}</span>
                    <h3>${escapeHtml(selectedConsultation.full_name)}</h3>
                </div>
                <span class="workspace-pill ${statusPillClass(selectedConsultation.status || 'new')}">${escapeHtml(formatConsultationDate(selectedConsultation.preferred_date))}</span>
            </div>
            <p>${escapeHtml(selectedConsultation.project_details || 'No project brief was added.')}</p>
            <div class="workspace-inline-records">
                <span class="workspace-pill">${escapeHtml(selectedConsultation.company_name)}</span>
                <span class="workspace-pill">${escapeHtml(selectedConsultation.email)}</span>
                ${selectedConsultation.phone ? `<span class="workspace-pill">${escapeHtml(selectedConsultation.phone)}</span>` : ''}
                ${selectedConsultation.requested_service ? `<span class="workspace-pill">${escapeHtml(selectedConsultation.requested_service)}</span>` : ''}
            </div>
            <div class="workspace-data-card-foot">
                <strong>${escapeHtml(selectedConsultation.preferred_time || 'Preferred time pending')}</strong>
            </div>
        `
        : renderEmptyState('No consultation selected', 'Choose a consultation request to review the brief, contact details, and preferred time.');
    bindWorkspaceTabs(document);
}

function buildConsultationAvailabilityDays() {
    const days = [];
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    while (days.length < 8) {
        cursor.setDate(cursor.getDate() + 1);
        const weekday = cursor.getDay();
        if (weekday === 0 || weekday === 6) {
            continue;
        }
        days.push(formatDateValue(cursor));
    }

    return days;
}

function buildConsultationSlotLabels() {
    return ['9:30 AM', '10:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:30 PM', '2:00 PM', '3:00 PM', '4:30 PM', '5:00 PM'];
}

function buildAdminAvailabilityDaysMarkup(state) {
    const days = buildConsultationAvailabilityDays();
    return days.map((date) => `
        <button type="button" class="consultation-admin-day${date === state.selectedAvailabilityDate ? ' active' : ''}" data-availability-date="${escapeHtml(date)}">
            <strong>${escapeHtml(formatDate(date))}</strong>
            <span>${escapeHtml(new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(date)))} </span>
        </button>
    `).join('');
}

function buildAdminAvailabilitySlotsMarkup(state) {
    if (state.availability.consultationSlotOverrides?.available === false) {
        return renderEmptyState('Availability manager unavailable', state.availability.consultationSlotOverrides.message || 'Run the updated consultation slot override schema before managing calendar availability here.');
    }

    if (!state.selectedAvailabilityDate) {
        return renderEmptyState('No date selected', 'Choose a date to manage consultation slot availability.');
    }

    const slotLabels = buildConsultationSlotLabels();
    const bookedSlots = state.consultations
        .filter((consultation) => ['new', 'confirmed'].includes(String(consultation.status || '').toLowerCase()) && consultation.preferred_date === state.selectedAvailabilityDate)
        .map((consultation) => consultation.preferred_time);

    const overrides = state.consultationSlotOverrides.filter((item) => item.slot_date === state.selectedAvailabilityDate);

    return slotLabels.map((slotTime) => {
        const override = overrides.find((item) => item.slot_time === slotTime);
        const isBooked = bookedSlots.includes(slotTime);
        const isAvailable = override ? Boolean(override.is_available) : true;
        const className = isBooked ? 'booked' : isAvailable ? 'available' : 'blocked';
        const statusLabel = isBooked ? 'Booked' : isAvailable ? 'Available' : 'Blocked';
        return `
            <button type="button" class="consultation-admin-slot ${className}" data-availability-slot="true" data-slot-date="${escapeHtml(state.selectedAvailabilityDate)}" data-slot-time="${escapeHtml(slotTime)}" data-slot-booked="${isBooked ? 'true' : 'false'}">
                <strong>${escapeHtml(slotTime)}</strong>
                <span>${escapeHtml(statusLabel)}</span>
            </button>
        `;
    }).join('');
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

    return `
        <div class="workspace-panel-head">
            <div>
                <span class="workspace-panel-kicker">Recent Activity</span>
                <h3>Latest operational movement</h3>
            </div>
        </div>
        ${recent.length
            ? `<div class="ops-activity-timeline">${recent.map((item) => `
                <article class="ops-activity-item">
                    <div class="ops-activity-dot"></div>
                    <div class="ops-activity-copy">
                        <span>${escapeHtml(item.type)}</span>
                        <strong>${escapeHtml(item.title)}</strong>
                        <em>${escapeHtml(formatDateTime(item.at))}</em>
                    </div>
                </article>
            `).join('')}</div>`
            : renderEmptyState('No recent activity', 'Recent invoices, updates, files, and message traffic will appear here.')}
    `;
}

function buildAdminQuickActionsMarkup(selectedProject, consultationFeedAvailable) {
    return `
        <button type="button" class="workspace-quick-action workspace-quick-action-primary" data-open-workspace-tab="ops-clients" data-focus-target="adminClientFullName">
            <span>Invite Client</span>
            <strong>Create account + first project</strong>
        </button>
        <button type="button" class="workspace-quick-action" data-open-workspace-tab="ops-projects" data-focus-target="adminProjectName">
            <span>Create Project</span>
            <strong>${escapeHtml(selectedProject?.name || 'Add a new delivery stream')}</strong>
        </button>
        <button type="button" class="workspace-quick-action" data-open-workspace-tab="ops-projects" data-focus-target="adminMilestoneTitle">
            <span>Add Milestone</span>
            <strong>Publish the next checkpoint</strong>
        </button>
        <button type="button" class="workspace-quick-action" data-open-workspace-tab="ops-deliverables" data-focus-target="adminDocumentCategory">
            <span>Upload Document</span>
            <strong>Share secure client files</strong>
        </button>
        <button type="button" class="workspace-quick-action" data-open-workspace-tab="ops-finance" data-focus-target="adminInvoiceTitle">
            <span>Create Invoice</span>
            <strong>Billing tied to the active project</strong>
        </button>
        <button type="button" class="workspace-quick-action" data-open-workspace-tab="ops-consultations">
            <span>${consultationFeedAvailable ? 'Review Consultations' : 'Consultation Feed'}</span>
            <strong>${consultationFeedAvailable ? 'Triage new requests quickly' : 'Reconnect intake pipeline'}</strong>
        </button>
    `;
}

function buildAdminContextMarkup(state, selectedProject, milestones, invoices, documents, messages) {
    if (!selectedProject) {
        return renderEmptyState('No project selected', 'Choose a client or project to load delivery context, billing, files, and live activity.');
    }

    const client = state.clients.find((item) => item.id === selectedProject.client_id);
    const nextMilestone = milestones.find((item) => !['approved', 'complete'].includes(String(item.status || '').toLowerCase())) || milestones[0];
    const openInvoices = invoices.filter((item) => !['paid', 'void'].includes(String(item.status || '').toLowerCase()));

    return `
        <div class="workspace-panel-head">
            <div>
                <span class="workspace-panel-kicker">Selected Project</span>
                <h3>${escapeHtml(selectedProject.name)}</h3>
            </div>
            <span class="workspace-pill ${statusPillClass(selectedProject.status || 'active')}">${escapeHtml(humanizeStatus(selectedProject.status || 'active'))}</span>
        </div>
        <p>${escapeHtml(selectedProject.description || 'No project summary has been added yet.')}</p>
        <div class="ops-context-grid">
            <article class="ops-context-stat">
                <span>Client</span>
                <strong>${escapeHtml(client?.company_name || 'No client selected')}</strong>
            </article>
            <article class="ops-context-stat">
                <span>Phase</span>
                <strong>${escapeHtml(selectedProject.current_phase || 'To be defined')}</strong>
            </article>
            <article class="ops-context-stat">
                <span>Launch</span>
                <strong>${escapeHtml(selectedProject.target_launch_date ? formatDate(selectedProject.target_launch_date) : 'Not scheduled')}</strong>
            </article>
        </div>
        <div class="ops-context-list">
            <div>
                <span>Next milestone</span>
                <strong>${escapeHtml(nextMilestone ? nextMilestone.title : 'No milestone queued')}</strong>
            </div>
            <div>
                <span>Open invoices</span>
                <strong>${openInvoices.length ? `${openInvoices.length} record${openInvoices.length === 1 ? '' : 's'}` : 'All clear'}</strong>
            </div>
            <div>
                <span>Messages</span>
                <strong>${messages.length} thread item${messages.length === 1 ? '' : 's'}</strong>
            </div>
            <div>
                <span>Files</span>
                <strong>${documents.length} asset${documents.length === 1 ? '' : 's'} shared</strong>
            </div>
        </div>
    `;
}

function buildAdminConsultationSnapshotMarkup(upcomingConsultations, available, unavailableMessage) {
    if (!available) {
        return renderEmptyState('Consultation feed unavailable', unavailableMessage || 'The consultation calendar feed is unavailable right now.');
    }

    const queued = upcomingConsultations.slice(0, 4);
    return `
        <div class="workspace-panel-head">
            <div>
                <span class="workspace-panel-kicker">Upcoming Consultations</span>
                <h3>${queued.length ? `${queued.length} scheduled request${queued.length === 1 ? '' : 's'}` : 'No consultations queued'}</h3>
            </div>
        </div>
        ${queued.length
            ? `<div class="ops-dashboard-list">${queued.map((consultation) => `
                <article class="ops-dashboard-list-item">
                    <strong>${escapeHtml(consultation.company_name)}</strong>
                    <span>${escapeHtml(consultation.full_name)} • ${escapeHtml(formatConsultationDate(consultation.preferred_date))}</span>
                    <em>${escapeHtml(consultation.preferred_time || 'Pending time')}</em>
                </article>
            `).join('')}</div>`
            : renderEmptyState('No consultations yet', 'New requests from the consultation form will appear here automatically.')}
    `;
}

function buildAdminSystemOverviewMarkup(state, selectedProject, selectedProjectUpdates) {
    const internalNotes = state.messages.filter((message) => message.is_internal).length;
    const openInvoices = state.invoices.filter((invoice) => !['paid', 'void'].includes(String(invoice.status || '').toLowerCase())).length;

    return `
        <div class="workspace-panel-head">
            <div>
                <span class="workspace-panel-kicker">Operational Snapshot</span>
                <h3>${escapeHtml(selectedProject?.name || 'Admin suite overview')}</h3>
            </div>
        </div>
        <div class="ops-dashboard-list ops-dashboard-list-tight">
            <article class="ops-dashboard-list-item">
                <strong>${state.clients.length} client account${state.clients.length === 1 ? '' : 's'}</strong>
                <span>Currently provisioned in the live portal</span>
            </article>
            <article class="ops-dashboard-list-item">
                <strong>${selectedProjectUpdates.length} project update${selectedProjectUpdates.length === 1 ? '' : 's'}</strong>
                <span>Published for the selected project</span>
            </article>
            <article class="ops-dashboard-list-item">
                <strong>${internalNotes} internal note${internalNotes === 1 ? '' : 's'}</strong>
                <span>Stored privately in the admin message layer</span>
            </article>
            <article class="ops-dashboard-list-item">
                <strong>${openInvoices} billing item${openInvoices === 1 ? '' : 's'}</strong>
                <span>Still awaiting payment or manual closeout</span>
            </article>
        </div>
    `;
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

    showProtectedRouteGate(
        'workspaceAccessGate',
        'Portal setup required',
        'This production portal is wired for Supabase, but the project credentials and schema still need to be connected.',
        `<a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" class="btn btn-primary btn-sm">Contact Support</a>`
    );
    showProtectedRouteGate(
        'adminAccessGate',
        'Portal setup required',
        'This production portal is wired for Supabase, but the project credentials and schema still need to be connected.',
        `<a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" class="btn btn-primary btn-sm">Contact Support</a>`
    );
    byId('clientWorkspaceShell')?.classList.add('is-hidden');
    byId('adminAppShell')?.classList.add('is-hidden');
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
        `<a href="${cleanInternalPath('client-login.html')}" class="btn btn-primary btn-sm">Go To Sign In</a>`
    );
}

function renderGlobalFailure(error) {
    const message = error?.message || 'The portal could not be initialized.';
    const targets = ['loginStatus', 'workspaceAlert', 'adminAlert']
        .map((id) => byId(id))
        .filter(Boolean);

    targets.forEach((target) => setInlineStatus(target, message, 'error'));

    if (APP === 'client-workspace') {
        showProtectedRouteGate(
            'workspaceAccessGate',
            'We could not open the client portal',
            'The live workspace could not be initialized right now. Try signing in again or contact support if the problem continues.',
            `<a href="${cleanInternalPath('client-login.html')}" class="btn btn-primary btn-sm">Return To Sign In</a>`
        );
        byId('clientWorkspaceShell')?.classList.add('is-hidden');
    }

    if (APP === 'ops') {
        showProtectedRouteGate(
            'adminAccessGate',
            'We could not open the admin suite',
            'The admin workspace could not be initialized right now. Sign in again or contact support if the problem continues.',
            `<a href="${cleanInternalPath('client-login.html')}" class="btn btn-primary btn-sm">Return To Sign In</a>`
        );
        byId('adminAppShell')?.classList.add('is-hidden');
    }
}

function renderProtectedRouteRedirectState(app) {
    if (app === 'client-workspace') {
        showProtectedRouteGate(
            'workspaceAccessGate',
            'Sign in required',
            'Your session is required before the live client workspace can open.',
            `<a href="${cleanInternalPath('client-login.html')}" class="btn btn-primary btn-sm">Go To Sign In</a>`
        );
        byId('clientWorkspaceShell')?.classList.add('is-hidden');
    }

    if (app === 'ops') {
        showProtectedRouteGate(
            'adminAccessGate',
            'Sign in required',
            'Admin authentication is required before the live operations suite can open.',
            `<a href="${cleanInternalPath('client-login.html')}" class="btn btn-primary btn-sm">Go To Sign In</a>`
        );
        byId('adminAppShell')?.classList.add('is-hidden');
    }
}

function showProtectedRouteGate(gateId, title, body, actionMarkup = '') {
    const gate = byId(gateId);
    if (!gate) {
        return;
    }

    gate.innerHTML = renderEmptyState(title, body, actionMarkup);
    gate.classList.remove('is-hidden');
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

    document.addEventListener('click', (event) => {
        const closeTrigger = event.target.closest('.workspace-nav-button, [data-open-workspace-tab], #portalSignOut, #workspaceAccountMenu a, #workspaceAccountMenu button');
        if (!closeTrigger) {
            return;
        }

        closeAccountMenu();
        if (window.innerWidth <= 1100) {
            closeDrawer();
        }
    });

    document.addEventListener('click', (event) => {
        const toggleTrigger = event.target.closest('[data-toggle-panel]');
        if (!toggleTrigger) {
            return;
        }

        const panelName = toggleTrigger.dataset.togglePanel;
        const panel = document.querySelector(`[data-workspace-panel="${panelName}"]`);
        if (!panel) {
            return;
        }

        const nextOpen = panel.classList.contains('is-hidden');
        setWorkspacePanelState(panelName, nextOpen);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeDrawer();
            closeAccountMenu();
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 1100) {
            document.body.style.overflow = '';
        }
    });
}

function activateWorkspaceTab(root, targetId, options = {}) {
    if (!targetId) {
        return;
    }

    const { updateHash = true } = options;

    const buttons = root.querySelectorAll('.workspace-nav-button');
    const mobileTabs = root.querySelectorAll('.workspace-mobile-tab');
    const views = root.querySelectorAll('.workspace-view');

    buttons.forEach((item) => item.classList.toggle('active', item.dataset.workspaceTab === targetId));
    mobileTabs.forEach((item) => item.classList.toggle('active', item.dataset.openWorkspaceTab === targetId));
    views.forEach((view) => view.classList.toggle('active', view.id === targetId));

    if (updateHash) {
        const nextUrl = new URL(window.location.href);
        nextUrl.hash = targetId;
        window.history.replaceState({}, document.title, nextUrl.toString());
    }
}

function bindWorkspaceTabs(root) {
    const stateHost = root instanceof HTMLElement ? root : document.body;
    const handleTabTrigger = (targetId, focusTarget = '') => {
        activateWorkspaceTab(root, targetId);

        if (focusTarget) {
            window.requestAnimationFrame(() => byId(focusTarget)?.focus());
        }

        if (window.innerWidth <= 1100) {
            byId('workspaceDrawerClose')?.click();
        }
    };

    root.querySelectorAll('.workspace-nav-button').forEach((button) => {
        if (button.dataset.tabsBound === 'true') {
            return;
        }

        button.dataset.tabsBound = 'true';
        button.addEventListener('click', () => handleTabTrigger(button.dataset.workspaceTab, button.dataset.focusTarget || ''));
    });

    root.querySelectorAll('[data-open-workspace-tab]').forEach((trigger) => {
        if (trigger.dataset.tabsBound === 'true') {
            return;
        }

        trigger.dataset.tabsBound = 'true';
        trigger.addEventListener('click', () => handleTabTrigger(trigger.dataset.openWorkspaceTab, trigger.dataset.focusTarget || ''));
    });

    if (stateHost.dataset.workspaceHashBound !== 'true') {
        stateHost.dataset.workspaceHashBound = 'true';
        window.addEventListener('hashchange', () => syncWorkspaceTabFromLocation(root));
    }
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

function resetAdminDocumentForm() {
    byId('adminDocumentForm')?.reset();
    byId('adminDocumentId').value = '';
    byId('adminDocumentFormTitle').textContent = 'Upload Document';
    byId('adminDocumentSubmit').textContent = 'Upload Document';
    byId('adminDocumentCancel').classList.add('is-hidden');
}

function resetAdminClientForm() {
    byId('adminClientForm')?.reset();
    byId('adminClientId').value = '';
    byId('adminClientFormTitle').textContent = 'Provision a premium client portal account';
    byId('adminClientSubmit').textContent = 'Send Invite + Create Client';
    byId('adminClientSubmit').dataset.defaultLabel = 'Send Invite + Create Client';
    byId('adminClientCancel').classList.add('is-hidden');
    toggleFormDisabled(byId('adminClientForm'), false);
    byId('adminClientEmail')?.removeAttribute('disabled');
    byId('adminClientProjectName')?.removeAttribute('disabled');
    byId('adminClientServiceLine')?.removeAttribute('disabled');
}

function populateAdminClientForm(client, profile) {
    if (!client) {
        return;
    }

    resetAdminClientForm();
    byId('adminClientId').value = client.id;
    byId('adminClientFullName').value = profile?.full_name || '';
    byId('adminClientEmail').value = profile?.email || client.billing_email || '';
    byId('adminClientCompany').value = client.company_name || '';
    byId('adminClientBillingEmail').value = client.billing_email || '';
    byId('adminClientProjectName').value = '';
    byId('adminClientServiceLine').value = '';
    byId('adminClientEmail').setAttribute('disabled', 'disabled');
    byId('adminClientProjectName').setAttribute('disabled', 'disabled');
    byId('adminClientServiceLine').setAttribute('disabled', 'disabled');
    byId('adminClientFormTitle').textContent = 'Edit Client';
    byId('adminClientSubmit').textContent = 'Save Client';
    byId('adminClientSubmit').dataset.defaultLabel = 'Save Client';
    byId('adminClientCancel').classList.remove('is-hidden');
    showWorkspacePanel('adminClientPanel');
    byId('adminClientForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetAdminProjectForm() {
    byId('adminProjectForm')?.reset();
    byId('adminProjectId').value = '';
    byId('adminProjectFormTitle').textContent = 'Create Project';
    byId('adminProjectSubmit').textContent = 'Create Project';
    byId('adminProjectCancel').classList.add('is-hidden');
}

function populateAdminProjectForm(project) {
    if (!project) {
        return;
    }

    resetAdminProjectForm();
    byId('adminProjectId').value = project.id;
    byId('adminProjectClient').value = project.client_id || '';
    byId('adminProjectName').value = project.name || '';
    byId('adminProjectService').value = project.service_line || '';
    byId('adminProjectPhase').value = project.current_phase || '';
    byId('adminProjectLaunch').value = project.target_launch_date ? String(project.target_launch_date).slice(0, 10) : '';
    byId('adminProjectDescription').value = project.description || '';
    byId('adminProjectFormTitle').textContent = 'Edit Project';
    byId('adminProjectSubmit').textContent = 'Save Project';
    byId('adminProjectCancel').classList.remove('is-hidden');
    showWorkspacePanel('adminProjectPanel');
    byId('adminProjectForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetAdminMilestoneForm() {
    byId('adminMilestoneForm')?.reset();
    byId('adminMilestoneId').value = '';
    byId('adminMilestoneFormTitle').textContent = 'Add Milestone';
    byId('adminMilestoneSubmit').textContent = 'Add Milestone';
    byId('adminMilestoneCancel').classList.add('is-hidden');
}

function populateAdminMilestoneForm(milestone) {
    if (!milestone) {
        return;
    }

    resetAdminMilestoneForm();
    byId('adminMilestoneId').value = milestone.id;
    byId('adminMilestoneTitle').value = milestone.title || '';
    byId('adminMilestoneDue').value = milestone.due_at ? String(milestone.due_at).slice(0, 10) : '';
    byId('adminMilestoneStatus').value = milestone.status || 'upcoming';
    byId('adminMilestoneDescription').value = milestone.description || '';
    byId('adminMilestoneApproval').checked = Boolean(milestone.requires_approval);
    byId('adminMilestoneFormTitle').textContent = 'Edit Milestone';
    byId('adminMilestoneSubmit').textContent = 'Save Milestone';
    byId('adminMilestoneCancel').classList.remove('is-hidden');
    showWorkspacePanel('adminMilestonePanel');
    byId('adminMilestoneForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetAdminUpdateForm() {
    byId('adminUpdateForm')?.reset();
    byId('adminUpdateId').value = '';
    byId('adminUpdateFormTitle').textContent = 'Publish Project Update';
    byId('adminUpdateSubmit').textContent = 'Publish Update';
    byId('adminUpdateCancel').classList.add('is-hidden');
}

function populateAdminUpdateForm(update) {
    if (!update) {
        return;
    }

    resetAdminUpdateForm();
    byId('adminUpdateId').value = update.id;
    byId('adminUpdateTitle').value = update.title || '';
    byId('adminUpdateStatus').value = update.status || 'update';
    byId('adminUpdateBody').value = update.body || '';
    byId('adminUpdateFormTitle').textContent = 'Edit Project Update';
    byId('adminUpdateSubmit').textContent = 'Save Update';
    byId('adminUpdateCancel').classList.remove('is-hidden');
    showWorkspacePanel('adminUpdatePanel');
    byId('adminUpdateForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function populateAdminDocumentForm(documentRecord) {
    if (!documentRecord) {
        return;
    }

    resetAdminDocumentForm();
    byId('adminDocumentId').value = documentRecord.id;
    byId('adminDocumentCategory').value = documentRecord.category || '';
    byId('adminDocumentFormTitle').textContent = 'Edit Document';
    byId('adminDocumentSubmit').textContent = 'Save Document';
    byId('adminDocumentCancel').classList.remove('is-hidden');
    showWorkspacePanel('adminDocumentPanel');
    byId('adminDocumentForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetAdminInvoiceForm() {
    byId('adminInvoiceForm')?.reset();
    byId('adminInvoiceId').value = '';
    byId('adminInvoiceFormTitle').textContent = 'Create Invoice';
    byId('adminInvoiceSubmit').textContent = 'Create Invoice';
    byId('adminInvoiceCancel').classList.add('is-hidden');
}

function populateAdminInvoiceForm(invoice) {
    if (!invoice) {
        return;
    }

    resetAdminInvoiceForm();
    byId('adminInvoiceId').value = invoice.id;
    byId('adminInvoiceTitle').value = invoice.title || '';
    byId('adminInvoiceAmount').value = Number(invoice.amount || 0) || '';
    byId('adminInvoiceStatus').value = invoice.status || 'issued';
    byId('adminInvoiceDue').value = invoice.due_at ? String(invoice.due_at).slice(0, 10) : '';
    byId('adminInvoicePaymentUrl').value = invoice.payment_url || '';
    byId('adminInvoiceDescription').value = invoice.description || '';
    byId('adminInvoiceFormTitle').textContent = 'Edit Invoice';
    byId('adminInvoiceSubmit').textContent = 'Save Invoice';
    byId('adminInvoiceCancel').classList.remove('is-hidden');
    showWorkspacePanel('adminInvoicePanel');
    byId('adminInvoiceForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetAdminMessageForm() {
    byId('adminMessageForm')?.reset();
    byId('adminMessageId').value = '';
    byId('adminMessageSubmit').textContent = 'Post Message';
    byId('adminMessageCancel').classList.add('is-hidden');
}

function populateAdminMessageForm(message) {
    if (!message) {
        return;
    }

    resetAdminMessageForm();
    byId('adminMessageId').value = message.id;
    byId('adminMessageBody').value = message.body || '';
    byId('adminMessageInternal').checked = Boolean(message.is_internal);
    byId('adminMessageSubmit').textContent = 'Save Message';
    byId('adminMessageCancel').classList.remove('is-hidden');
    showWorkspacePanel('adminMessagePanel');
    byId('adminMessageForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getSelectedConsultation(state) {
    return state.consultations.find((consultation) => consultation.id === state.selectedConsultationId)
        || state.consultations[0]
        || null;
}

function getUpcomingConsultations(state) {
    return [...state.consultations]
        .filter((consultation) => !['completed', 'archived'].includes(String(consultation.status || '').toLowerCase()))
        .sort((left, right) => {
            const leftAt = new Date(left.preferred_iso || left.preferred_date || left.created_at || 0).getTime();
            const rightAt = new Date(right.preferred_iso || right.preferred_date || right.created_at || 0).getTime();
            return leftAt - rightAt;
        });
}

function persistAdminSelection(state) {
    if (state.selectedClientId) {
        localStorage.setItem(ADMIN_CLIENT_STORAGE_KEY, state.selectedClientId);
    } else {
        localStorage.removeItem(ADMIN_CLIENT_STORAGE_KEY);
    }
    if (state.selectedProjectId) {
        localStorage.setItem(ADMIN_PROJECT_STORAGE_KEY, state.selectedProjectId);
    } else {
        localStorage.removeItem(ADMIN_PROJECT_STORAGE_KEY);
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

function bindWorkspaceDashboardPanel(id, targetTab) {
    const panel = byId(id);
    if (!panel || !targetTab) {
        return;
    }

    panel.classList.add('workspace-panel-action');
    panel.dataset.openWorkspaceTab = targetTab;
}

function setWorkspacePanelState(panelName, isOpen) {
    const panel = document.querySelector(`[data-workspace-panel="${panelName}"]`);
    if (!panel) {
        return;
    }

    panel.classList.toggle('is-hidden', !isOpen);
    document.querySelectorAll(`[data-toggle-panel="${panelName}"]`).forEach((trigger) => {
        trigger.classList.toggle('active', isOpen);
        trigger.setAttribute('aria-expanded', String(isOpen));
    });
}

function showWorkspacePanel(panelName) {
    setWorkspacePanelState(panelName, true);
}

function hideWorkspacePanel(panelName) {
    setWorkspacePanelState(panelName, false);
}

function resolveConfiguredStripePaymentUrl(config) {
    const configuredApiUrl = String(config.stripeApiUrl || '').trim();
    const legacyStripeUrl = configuredApiUrl && configuredApiUrl !== DEFAULT_STRIPE_API_URL
        ? configuredApiUrl
        : '';

    return [
        config.stripePaymentLinkUrl,
        config.stripeCheckoutUrl,
        config.stripeUrl,
        legacyStripeUrl
    ].map((value) => sanitizeExternalUrl(value))
        .find(Boolean) || '';
}

function sanitizeExternalUrl(value) {
    if (!value) {
        return '';
    }

    try {
        const url = new URL(String(value).trim(), window.location.origin);
        return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
    } catch (error) {
        return '';
    }
}

function getInvoicePaymentUrl(invoice) {
    return sanitizeExternalUrl(invoice?.payment_url);
}

async function invokeAdminProvisioning(supabase, payload) {
    const session = await getSession(supabase);
    if (!session?.access_token) {
        return {
            ok: false,
            code: 'AUTH_REQUIRED',
            message: 'Your admin session expired. Sign in again before creating a client.'
        };
    }

    const edgeProvisioning = await invokeSupabaseFunctionViaHttp('admin-provision-user', session.access_token, payload);
    if (edgeProvisioning.ok || !ADMIN_PROVISION_ENDPOINT || !['SERVICE_UNAVAILABLE', 'CONFIG_MISSING'].includes(edgeProvisioning.code)) {
        return edgeProvisioning;
    }

    if (ADMIN_PROVISION_ENDPOINT) {
        try {
            const response = await fetch(ADMIN_PROVISION_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`
                },
                body: JSON.stringify(payload)
            });
            const body = await safeParseJson(response);

            if (response.ok && body?.ok !== false) {
                return {
                    ok: true,
                    message: body?.message || 'Client account created and invite sent.',
                    data: body?.data || body
                };
            }

            const shouldFallbackToEdgeFunction = [404, 405, 500, 502, 503, 504].includes(response.status)
                || body?.code === 'CONFIG_MISSING';

            if (!shouldFallbackToEdgeFunction) {
                return {
                    ok: false,
                    code: body?.code || 'PROVISIONING_FAILED',
                    message: mapProvisioningMessage(body?.code, body?.message),
                    details: body?.details || null
                };
            }

            console.warn('[Portal] Same-origin provisioning endpoint unavailable, falling back to Supabase Edge Function.', {
                status: response.status,
                code: body?.code || null
            });
        } catch (error) {
            console.warn('[Portal] Same-origin provisioning endpoint failed, falling back to Supabase Edge Function.', error);
        }
    }

    return edgeProvisioning;
}

async function invokeSupabaseFunctionViaHttp(functionName, accessToken, payload) {
    const functionUrl = CONFIG.supabaseUrl
        ? `${String(CONFIG.supabaseUrl).replace(/\/$/, '')}/functions/v1/${functionName}`
        : '';

    if (!functionUrl || !CONFIG.supabaseAnonKey) {
        return {
            ok: false,
            code: 'SERVICE_UNAVAILABLE',
            message: 'The secure provisioning service is not configured correctly.'
        };
    }

    try {
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                apikey: CONFIG.supabaseAnonKey
            },
            body: JSON.stringify(payload)
        });
        const body = await safeParseJson(response);

        if (response.ok && body?.ok !== false) {
            return {
                ok: true,
                message: body?.message || 'Client account created and invite sent.',
                data: body?.data || body
            };
        }

        const code = body?.code || inferProvisioningCode({ message: body?.message || response.statusText });
        return {
            ok: false,
            code,
            message: mapProvisioningMessage(code, body?.message || response.statusText),
            details: body?.details || body || null
        };
    } catch (error) {
        const code = inferProvisioningCode(error);
        return {
            ok: false,
            code,
            message: mapProvisioningMessage(code, error?.message),
            details: error
        };
    }
}

function resolveAdminProvisionEndpoint(config) {
    const configured = sanitizeExternalUrl(config.adminProvisionEndpoint || '');
    if (configured) {
        return configured;
    }

    if (!window?.location?.origin || window.location.protocol === 'file:') {
        return '';
    }

    return `${window.location.origin}/api/admin-provision-user`;
}

function resolvePortalProfileSyncEndpoint(config) {
    const configured = sanitizeExternalUrl(config.portalProfileSyncEndpoint || '');
    if (configured) {
        return configured;
    }

    if (!window?.location?.origin || window.location.protocol === 'file:') {
        return '';
    }

    return `${window.location.origin}/api/portal-sync-profile`;
}

async function safeParseJson(response) {
    try {
        return await response.json();
    } catch (error) {
        return null;
    }
}

function isProfileSyncDisabled() {
    try {
        return window?.sessionStorage?.getItem(PROFILE_SYNC_DISABLED_STORAGE_KEY) === '1';
    } catch (error) {
        return false;
    }
}

function setProfileSyncDisabled(disabled) {
    try {
        if (!window?.sessionStorage) {
            return;
        }

        if (disabled) {
            window.sessionStorage.setItem(PROFILE_SYNC_DISABLED_STORAGE_KEY, '1');
        } else {
            window.sessionStorage.removeItem(PROFILE_SYNC_DISABLED_STORAGE_KEY);
        }
    } catch (error) {
        // Ignore sessionStorage access failures.
    }
}

function readOptionalTableCache() {
    try {
        const raw = window?.sessionStorage?.getItem(OPTIONAL_TABLE_CACHE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        return {};
    }
}

function writeOptionalTableCache(cache) {
    try {
        if (!window?.sessionStorage) {
            return;
        }

        window.sessionStorage.setItem(OPTIONAL_TABLE_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
        // Ignore sessionStorage access failures.
    }
}

function isOptionalTableCachedUnavailable(table) {
    return Boolean(readOptionalTableCache()[table]);
}

function cacheOptionalTableUnavailable(table) {
    const cache = readOptionalTableCache();
    cache[table] = true;
    writeOptionalTableCache(cache);
}

function clearOptionalTableUnavailable(table) {
    const cache = readOptionalTableCache();
    if (!cache[table]) {
        return;
    }

    delete cache[table];
    writeOptionalTableCache(cache);
}

function isMissingTableError(error, table) {
    const status = Number(error?.status || error?.statusCode || 0);
    const code = String(error?.code || '').toUpperCase();
    const message = [
        error?.message,
        error?.details,
        error?.hint
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    if (status === 404) {
        return true;
    }

    if (code === 'PGRST205') {
        return true;
    }

    return (
        (message.includes(`public.${table}`) && (message.includes('schema cache') || message.includes('does not exist') || message.includes('not found')))
        || message.includes(`relation "${table}" does not exist`)
        || message.includes(`relation "public.${table}" does not exist`)
    );
}

function getOptionalTableUnavailableMessage(table) {
    switch (table) {
        case 'consultations':
            return 'The consultations table is missing in the current Supabase project. The admin suite is still available, but the consultation calendar is temporarily offline until that schema is applied.';
        default:
            return `The ${table} table is unavailable in the current Supabase project.`;
    }
}

function toggleFormDisabled(form, disabled) {
    if (!form) {
        return;
    }

    form.querySelectorAll('input, select, textarea, button').forEach((field) => {
        field.disabled = disabled;
    });
}

function inferProvisioningCode(error) {
    const message = String(error?.message || '').trim().toLowerCase();

    if (!message) {
        return 'PROVISIONING_FAILED';
    }
    if (message.includes('not found')) {
        return 'SERVICE_UNAVAILABLE';
    }
    if (message.includes('failed to send a request to the edge function')) {
        return 'SERVICE_UNAVAILABLE';
    }
    if (message.includes('authorization') || message.includes('jwt')) {
        return 'AUTH_REQUIRED';
    }
    if (message.includes('already exists') || message.includes('duplicate')) {
        return 'DUPLICATE_CLIENT';
    }

    return 'PROVISIONING_FAILED';
}

function mapProvisioningMessage(code, fallbackMessage = '') {
    switch (code) {
        case 'AUTH_REQUIRED':
            return 'Your admin session expired. Sign in again before creating a client.';
        case 'FORBIDDEN':
            return 'Only internal admin accounts can provision live client access.';
        case 'VALIDATION_ERROR':
            return fallbackMessage || 'Review the client details and complete every required field before sending the invite.';
        case 'DUPLICATE_CLIENT':
            return 'That portal email is already tied to a client record. Open the existing client or use a different email.';
        case 'CONFIG_MISSING':
            return 'The secure provisioning service is missing its server-side Supabase configuration. Add the required keys and redeploy the endpoint.';
        case 'SERVICE_UNAVAILABLE':
            return 'The secure provisioning service is currently unavailable. Redeploy the admin provisioning endpoint and confirm the server-side Supabase keys are configured.';
        default:
            return fallbackMessage || 'The client account could not be provisioned right now. Try again in a moment.';
    }
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

    if ((kind === 'success' || kind === 'error') && ['adminAlert', 'workspaceAlert'].includes(element.id)) {
        showWorkspaceToast(message, kind);
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

function showWorkspaceToast(message, kind = 'info') {
    const stack = byId('workspaceToastStack');
    if (!stack || !message) {
        return;
    }

    const toast = document.createElement('article');
    toast.className = `workspace-toast workspace-toast-${kind}`;
    toast.innerHTML = `
        <div class="workspace-toast-copy">
            <strong>${escapeHtml(kind === 'success' ? 'Saved' : kind === 'error' ? 'Attention' : 'Update')}</strong>
            <span>${escapeHtml(message)}</span>
        </div>
        <button type="button" class="workspace-toast-close" aria-label="Dismiss notification">×</button>
    `;

    const dismiss = () => {
        toast.classList.add('is-leaving');
        window.setTimeout(() => toast.remove(), 220);
    };

    toast.querySelector('.workspace-toast-close')?.addEventListener('click', dismiss);
    stack.appendChild(toast);
    window.setTimeout(() => toast.classList.add('is-visible'), 16);
    window.setTimeout(dismiss, 4200);
}

let confirmWorkspaceResolver = null;
let confirmWorkspaceCleanup = null;

function confirmWorkspaceAction({
    kicker = 'Confirm action',
    title = 'Please confirm',
    body = 'This action cannot be undone.',
    confirmLabel = 'Confirm',
    tone = 'danger'
} = {}) {
    const modal = byId('workspaceConfirmModal');
    const confirmButton = byId('workspaceConfirmSubmit');
    const cancelButton = byId('workspaceConfirmCancel');
    const closeButton = byId('workspaceConfirmClose');
    const backdrop = byId('workspaceConfirmBackdrop');

    if (!modal || !confirmButton || !cancelButton || !closeButton || !backdrop) {
        return Promise.resolve(window.confirm(body));
    }

    byId('workspaceConfirmKicker').textContent = kicker;
    byId('workspaceConfirmTitle').textContent = title;
    byId('workspaceConfirmBody').textContent = body;
    confirmButton.textContent = confirmLabel;
    confirmButton.classList.toggle('btn-danger', tone === 'danger');
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');

    const teardown = (value) => {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        confirmButton.classList.remove('btn-danger');
        if (confirmWorkspaceCleanup) {
            confirmWorkspaceCleanup();
            confirmWorkspaceCleanup = null;
        }
        if (confirmWorkspaceResolver) {
            confirmWorkspaceResolver(value);
            confirmWorkspaceResolver = null;
        }
    };

    return new Promise((resolve) => {
        confirmWorkspaceResolver = resolve;

        const handleConfirm = () => teardown(true);
        const handleCancel = () => teardown(false);
        const handleKeydown = (event) => {
            if (event.key === 'Escape') {
                handleCancel();
            }
        };

        confirmButton.addEventListener('click', handleConfirm, { once: true });
        cancelButton.addEventListener('click', handleCancel, { once: true });
        closeButton.addEventListener('click', handleCancel, { once: true });
        backdrop.addEventListener('click', handleCancel, { once: true });
        document.addEventListener('keydown', handleKeydown);

        confirmWorkspaceCleanup = () => {
            document.removeEventListener('keydown', handleKeydown);
        };
    });
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

function formatDateValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatConsultationDate(value) {
    return formatDate(value);
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

function buildProjectSlug(seed) {
    const base = slugify(seed);
    return base ? `${base}-${Date.now().toString().slice(-6)}` : '';
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
    window.location.href = cleanInternalPath(path);
}

function cleanInternalPath(path) {
    const rawPath = String(path || '').trim();

    if (!rawPath || /^([a-z]+:|#)/i.test(rawPath) || rawPath.startsWith('//')) {
        return rawPath;
    }

    const [pathWithQuery, hashValue] = rawPath.split('#');
    const [pathOnly, queryValue] = pathWithQuery.split('?');
    const hash = hashValue ? `#${hashValue}` : '';
    const query = queryValue ? `?${queryValue}` : '';

    let normalizedPath = pathOnly;
    if (/index\.html$/i.test(normalizedPath)) {
        normalizedPath = normalizedPath.replace(/index\.html$/i, '');
    } else {
        normalizedPath = normalizedPath.replace(/\.html$/i, '');
    }

    return `${normalizedPath || '/'}${query}${hash}`;
}

function normalizeCurrentCleanUrl() {
    if (!/^https?:$/i.test(window.location.protocol)) {
        return;
    }

    const url = new URL(window.location.href);
    let nextPath = url.pathname;

    if (/\/index\.html$/i.test(nextPath)) {
        nextPath = nextPath.replace(/\/index\.html$/i, '/');
    } else if (/\.html$/i.test(nextPath)) {
        nextPath = nextPath.replace(/\.html$/i, '');
    }

    if (nextPath !== url.pathname) {
        url.pathname = nextPath;
        window.history.replaceState({}, document.title, url.toString());
    }
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
