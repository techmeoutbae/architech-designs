const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eaiwhqqwirahmppfjsva.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJlYWl3aHFxd2lyYWhtcHBmanN2YSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc1ODk5NTM0LCJleHAiOjIwOTE0NzU1MzR9.WRLIyYQDuLn5k8XKuiv4SfUdh1qkFwSimT1fvP06VGU';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_EMAILS = parseCsv(process.env.ARCHITECH_ADMIN_EMAILS);
const ADMIN_DOMAINS = parseCsv(process.env.ARCHITECH_ADMIN_DOMAINS || 'architechdesigns.net');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store'
};

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
            message: 'Use POST to synchronize the portal profile.'
        });
        return;
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
        sendJson(res, 503, {
            ok: false,
            code: 'CONFIG_MISSING',
            message: 'The secure portal profile sync service is missing its server-side Supabase configuration.'
        });
        return;
    }

    const authHeader = req.headers.authorization || req.headers.Authorization || '';
    if (!String(authHeader).startsWith('Bearer ')) {
        sendJson(res, 401, {
            ok: false,
            code: 'AUTH_REQUIRED',
            message: 'Sign in again before loading the portal.'
        });
        return;
    }

    try {
        const user = await getAuthenticatedUser(authHeader);
        const email = String(user?.email || '').trim().toLowerCase();
        const fullName = String(
            user?.user_metadata?.full_name
            || user?.user_metadata?.fullName
            || user?.app_metadata?.full_name
            || email.split('@')[0]
            || ''
        ).trim();
        const existingProfile = await getProfile(user.id);
        const shouldBeAdmin = isInternalAdmin(email) || existingProfile?.role === 'admin';

        const [profile] = await restRequest('/rest/v1/profiles?on_conflict=id', {
            method: 'POST',
            body: [{
                id: user.id,
                email,
                full_name: fullName,
                role: shouldBeAdmin ? 'admin' : (existingProfile?.role || 'client')
            }],
            prefer: 'resolution=merge-duplicates,return=representation'
        });

        sendJson(res, 200, {
            ok: true,
            code: 'PROFILE_SYNCED',
            message: shouldBeAdmin
                ? 'Portal profile synchronized with internal admin access.'
                : 'Portal profile synchronized successfully.',
            data: profile || null
        });
    } catch (error) {
        console.error('[portal-sync-profile] sync failed', {
            code: error?.code,
            message: error?.message,
            details: error?.details
        });

        sendJson(res, error?.code === 'AUTH_REQUIRED' ? 401 : 500, {
            ok: false,
            code: error?.code || 'PROFILE_SYNC_FAILED',
            message: error?.message || 'The portal profile could not be synchronized.',
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

function isInternalAdmin(email) {
    if (!email) {
        return false;
    }

    if (ADMIN_EMAILS.includes(email)) {
        return true;
    }

    const domain = email.split('@')[1] || '';
    return ADMIN_DOMAINS.includes(domain);
}

function parseCsv(value) {
    return String(value || '')
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
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
        const error = new Error('Sign in again before loading the portal.');
        error.code = 'AUTH_REQUIRED';
        error.details = body;
        throw error;
    }

    return body;
}

async function getProfile(userId) {
    const records = await restRequest(`/rest/v1/profiles?select=id,role,email,full_name&id=eq.${encodeURIComponent(userId)}&limit=1`);
    return records[0] || null;
}

async function restRequest(path, options = {}) {
    const url = `${SUPABASE_URL}${path}`;
    const method = options.method || 'GET';
    const headers = {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: 'application/json',
        ...options.headers
    };

    if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    if (options.prefer) {
        headers.Prefer = options.prefer;
    }

    const response = await fetch(url, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });

    const body = await safeJson(response);
    if (!response.ok) {
        const message = body?.message || body?.error_description || body?.hint || 'Supabase request failed.';
        const error = new Error(message);
        error.details = body;
        throw error;
    }

    return Array.isArray(body) ? body : body ? [body] : [];
}

async function safeJson(response) {
    const text = await response.text();
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        return { raw: text };
    }
}
