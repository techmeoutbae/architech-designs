const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eaiwhqqwirahmppfjsva.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhaXdocXF3aXJhaG1wcGZqc3ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4OTk1MzQsImV4cCI6MjA5MTQ3NTUzNH0.WRLIyYQDuLn5k8XKuiv4SfUdh1qkFwSimT1fvP06VGU';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store'
};

function shouldRetryInviteWithoutRedirect(message) {
    const normalized = String(message || '').toLowerCase();
    return normalized.includes('redirect')
        || normalized.includes('site url')
        || normalized.includes('allowed')
        || normalized.includes('not permitted');
}

function normalizeRedirectTo(value) {
    const fallback = (process.env.ARCHITECH_SITE_URL || 'https://www.architechdesigns.net').replace(/\/$/, '');
    const rawValue = String(value || '').trim();

    if (!rawValue) {
        return `${fallback}/client-login`;
    }

    try {
        const parsed = new URL(rawValue);
        if (['localhost', '127.0.0.1'].includes(parsed.hostname)) {
            return `${fallback}/client-login`;
        }

        return parsed.toString();
    } catch {
        return `${fallback}/client-login`;
    }
}

module.exports = async function handler(req, res) {
    applyCors(res);

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method !== 'POST') {
        sendJson(res, 405, {
            ok: false,
            code: 'METHOD_NOT_ALLOWED',
            message: 'Use POST when provisioning a client account.'
        });
        return;
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
        sendJson(res, 503, {
            ok: false,
            code: 'CONFIG_MISSING',
            message: 'The secure provisioning service is missing its server-side Supabase configuration.'
        });
        return;
    }

    const authHeader = req.headers.authorization || req.headers.Authorization || '';
    if (!String(authHeader).startsWith('Bearer ')) {
        sendJson(res, 401, {
            ok: false,
            code: 'AUTH_REQUIRED',
            message: 'Sign in again before creating a client account.'
        });
        return;
    }

    let payload;
    try {
        payload = await readJsonBody(req);
    } catch (error) {
        sendJson(res, 400, {
            ok: false,
            code: 'VALIDATION_ERROR',
            message: 'The client payload could not be read.'
        });
        return;
    }

    const fullName = String(payload?.fullName || '').trim();
    const email = String(payload?.email || '').trim().toLowerCase();
    const companyName = String(payload?.companyName || '').trim();
    const billingEmail = String(payload?.billingEmail || '').trim().toLowerCase() || email;
    const projectName = String(payload?.projectName || '').trim();
    const serviceLine = String(payload?.serviceLine || '').trim() || null;
    const redirectTo = normalizeRedirectTo(payload?.redirectTo || '');

    if (!fullName || !email || !companyName || !projectName) {
        sendJson(res, 400, {
            ok: false,
            code: 'VALIDATION_ERROR',
            message: 'Primary contact, portal email, company name, and initial project are required.'
        });
        return;
    }

    const provisionState = {
        invitedUserId: '',
        clientId: '',
        projectId: ''
    };

    try {
        const caller = await getAuthenticatedUser(authHeader);
        const callerProfile = await getProfile(caller.id);

        if (callerProfile?.role !== 'admin') {
            sendJson(res, 403, {
                ok: false,
                code: 'FORBIDDEN',
                message: 'Only internal admin accounts can provision live client access.'
            });
            return;
        }

        const existingProfile = await getProfileByEmail(email);
        if (existingProfile) {
            sendJson(res, 409, {
                ok: false,
                code: 'DUPLICATE_CLIENT',
                message: 'That portal email is already tied to an existing account.'
            });
            return;
        }

        const timestamp = Date.now().toString().slice(-6);
        let inviteResult;
        try {
            inviteResult = await adminAuthRequest('/auth/v1/invite', {
                method: 'POST',
                body: {
                    email,
                    data: { full_name: fullName },
                    redirect_to: redirectTo || undefined
                }
            });
        } catch (error) {
            if (!redirectTo || !shouldRetryInviteWithoutRedirect(error?.message)) {
                throw error;
            }

            inviteResult = await adminAuthRequest('/auth/v1/invite', {
                method: 'POST',
                body: {
                    email,
                    data: { full_name: fullName }
                }
            });
        }

        const invitedUserId = inviteResult?.user?.id || inviteResult?.id;
        if (!invitedUserId) {
            throw createProvisioningError('PROVISIONING_FAILED', 'The invite could not be created.');
        }
        provisionState.invitedUserId = invitedUserId;

        await restRequest('/rest/v1/profiles?on_conflict=id', {
            method: 'POST',
            body: [{
                id: invitedUserId,
                email,
                full_name: fullName,
                role: 'client'
            }],
            prefer: 'resolution=merge-duplicates,return=representation'
        });

        const clientRecord = await restRequest('/rest/v1/clients', {
            method: 'POST',
            body: [{
                profile_id: invitedUserId,
                company_name: companyName,
                slug: `${slugify(companyName)}-${timestamp}`,
                billing_email: billingEmail,
                created_by: caller.id
            }],
            prefer: 'return=representation'
        });
        provisionState.clientId = clientRecord[0]?.id || '';

        const projectRecord = await restRequest('/rest/v1/projects', {
            method: 'POST',
            body: [{
                client_id: provisionState.clientId,
                name: projectName,
                slug: `${slugify(projectName)}-${timestamp}`,
                service_line: serviceLine,
                status: 'active',
                current_phase: 'Onboarding and workspace setup',
                description: 'Initial project created during client portal provisioning.',
                created_by: caller.id
            }],
            prefer: 'return=representation'
        });
        provisionState.projectId = projectRecord[0]?.id || '';

        await restRequest('/rest/v1/project_memberships?on_conflict=project_id,user_id', {
            method: 'POST',
            body: [
                {
                    project_id: provisionState.projectId,
                    user_id: caller.id,
                    membership_role: 'admin',
                    is_primary: false
                },
                {
                    project_id: provisionState.projectId,
                    user_id: invitedUserId,
                    membership_role: 'client',
                    is_primary: true
                }
            ],
            prefer: 'resolution=merge-duplicates,return=representation'
        });

        sendJson(res, 201, {
            ok: true,
            code: 'CLIENT_PROVISIONED',
            message: 'Client account created and invite sent.',
            data: {
                clientId: provisionState.clientId,
                projectId: provisionState.projectId,
                invitedUserId
            }
        });
    } catch (error) {
        console.error('[admin-provision-user] provisioning failed', {
            code: error?.code,
            message: error?.message,
            stack: error?.stack
        });

        await cleanupPartialProvision(provisionState);
        const code = error?.code || 'PROVISIONING_FAILED';
        const status = code === 'DUPLICATE_CLIENT' ? 409 : code === 'VALIDATION_ERROR' ? 400 : code === 'AUTH_REQUIRED' ? 401 : code === 'FORBIDDEN' ? 403 : 500;

        sendJson(res, status, {
            ok: false,
            code,
            message: error?.message || 'The client account could not be provisioned.',
            details: error?.details || null
        });
    }
};

function applyCors(res) {
    Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
}

function sendJson(res, status, body) {
    res.status(status).json(body);
}

async function readJsonBody(req) {
    if (req.body && typeof req.body === 'object') {
        return req.body;
    }

    if (typeof req.body === 'string' && req.body.trim()) {
        return JSON.parse(req.body);
    }

    const chunks = [];
    for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
    }

    const text = Buffer.concat(chunks).toString('utf8').trim();
    return text ? JSON.parse(text) : {};
}

async function getAuthenticatedUser(authHeader) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: authHeader
        }
    });

    const body = await safeJson(response);
    if (!response.ok || !body?.id) {
        throw createProvisioningError('AUTH_REQUIRED', 'Sign in again before creating a client account.');
    }

    return body;
}

async function getProfile(userId) {
    const records = await restRequest(`/rest/v1/profiles?select=id,role,email,full_name&id=eq.${encodeURIComponent(userId)}&limit=1`);
    return records[0] || null;
}

async function getProfileByEmail(email) {
    const records = await restRequest(`/rest/v1/profiles?select=id,email&email=eq.${encodeURIComponent(email)}&limit=1`);
    return records[0] || null;
}

async function restRequest(path, { method = 'GET', body, prefer = 'return=representation' } = {}) {
    const headers = {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    };

    if (method !== 'GET') {
        headers['Content-Type'] = 'application/json';
        headers.Prefer = prefer;
    }

    const response = await fetch(`${SUPABASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });
    const payload = await safeJson(response);

    if (!response.ok) {
        throw mapSupabaseError(payload, response.status, 'The database request could not be completed.');
    }

    return Array.isArray(payload) ? payload : payload ? [payload] : [];
}

async function adminAuthRequest(path, { method = 'POST', body } = {}) {
    const response = await fetch(`${SUPABASE_URL}${path}`, {
        method,
        headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const payload = await safeJson(response);

    if (!response.ok) {
        throw mapSupabaseError(payload, response.status, 'The authentication request could not be completed.');
    }

    return payload;
}

async function deleteAuthUser(userId) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
    });
}

async function cleanupPartialProvision(state) {
    try {
        if (state.projectId) {
            await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${encodeURIComponent(state.projectId)}`, {
                method: 'DELETE',
                headers: {
                    apikey: SUPABASE_SERVICE_ROLE_KEY,
                    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                }
            });
        }
        if (state.clientId) {
            await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${encodeURIComponent(state.clientId)}`, {
                method: 'DELETE',
                headers: {
                    apikey: SUPABASE_SERVICE_ROLE_KEY,
                    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                }
            });
        }
        if (state.invitedUserId) {
            await deleteAuthUser(state.invitedUserId);
        }
    } catch (error) {
        console.error('[admin-provision-user] cleanup failed', error);
    }
}

async function safeJson(response) {
    const text = await response.text();
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        return { message: text };
    }
}

function mapSupabaseError(payload, status, fallbackMessage) {
    const message = String(payload?.msg || payload?.message || payload?.error_description || fallbackMessage || '').trim();
    const lowerMessage = message.toLowerCase();

    if (status === 401) {
        return createProvisioningError('AUTH_REQUIRED', 'Sign in again before creating a client account.', payload);
    }
    if (status === 403) {
        return createProvisioningError('FORBIDDEN', 'Only internal admin accounts can provision live client access.', payload);
    }
    if (status === 409 || lowerMessage.includes('already') || lowerMessage.includes('duplicate')) {
        return createProvisioningError('DUPLICATE_CLIENT', 'That portal email is already tied to an existing account.', payload);
    }
    if (status === 400) {
        return createProvisioningError('VALIDATION_ERROR', message || 'Review the client details and try again.', payload);
    }

    return createProvisioningError('PROVISIONING_FAILED', message || fallbackMessage, payload);
}

function createProvisioningError(code, message, details = null) {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    return error;
}

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);
}
