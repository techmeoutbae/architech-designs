const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eaiwhqqwirahmppfjsva.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type',
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
            message: 'Use POST to submit a consultation request.'
        });
        return;
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        sendJson(res, 503, {
            ok: false,
            code: 'CONFIG_MISSING',
            message: 'The secure consultation service is not configured yet.'
        });
        return;
    }

    let payload;
    try {
        payload = await readJsonBody(req);
    } catch (error) {
        sendJson(res, 400, {
            ok: false,
            code: 'INVALID_JSON',
            message: 'The consultation payload could not be read.'
        });
        return;
    }

    const fullName = String(payload?.fullName || '').trim();
    const email = String(payload?.email || '').trim().toLowerCase();
    const phone = String(payload?.phone || '').trim() || null;
    const companyName = String(payload?.companyName || '').trim();
    const requestedService = String(payload?.requestedService || '').trim() || null;
    const budgetRange = String(payload?.budgetRange || '').trim() || null;
    const timeline = String(payload?.timeline || '').trim() || null;
    const preferredDate = String(payload?.preferredDate || '').trim();
    const preferredTime = String(payload?.preferredTime || '').trim();
    const timezone = String(payload?.timezone || '').trim() || 'America/New_York';
    const projectDetails = String(payload?.projectDetails || '').trim();
    const source = String(payload?.source || '').trim() || 'website-contact-scheduler';

    if (!fullName || !email || !companyName || !preferredDate || !preferredTime || !projectDetails) {
        sendJson(res, 400, {
            ok: false,
            code: 'VALIDATION_ERROR',
            message: 'Name, email, company, preferred consultation slot, and project brief are required.'
        });
        return;
    }

    try {
        const existing = await restRequest(
            `/rest/v1/consultations?select=id&preferred_date=eq.${encodeURIComponent(preferredDate)}&preferred_time=eq.${encodeURIComponent(preferredTime)}&status=in.(new,confirmed)&limit=1`
        );

        if (existing.length) {
            sendJson(res, 409, {
                ok: false,
                code: 'SLOT_UNAVAILABLE',
                message: 'That consultation slot was just taken. Please choose another time.'
            });
            return;
        }

        await restRequest('/rest/v1/consultations', {
            method: 'POST',
            body: [{
                full_name: fullName,
                email,
                phone,
                company_name: companyName,
                requested_service: requestedService,
                budget_range: budgetRange,
                timeline,
                preferred_date: preferredDate,
                preferred_time: preferredTime,
                timezone,
                project_details: projectDetails,
                source
            }],
            prefer: 'return=representation'
        });

        sendJson(res, 201, {
            ok: true,
            code: 'CONSULTATION_CREATED',
            message: 'Consultation request received and saved to the admin calendar.'
        });
    } catch (error) {
        if (isMissingTableError(error, 'consultations')) {
            sendJson(res, 503, {
                ok: false,
                code: 'CONSULTATION_CALENDAR_UNAVAILABLE',
                message: 'The consultation calendar is temporarily unavailable, so we could not reserve that slot automatically.'
            });
            return;
        }

        console.error('[contact-consultation] request failed', {
            message: error?.message,
            details: error?.details,
            stack: error?.stack
        });

        sendJson(res, 500, {
            ok: false,
            code: 'REQUEST_FAILED',
            message: error?.message || 'The consultation request could not be saved.'
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

function isMissingTableError(error, table) {
    const code = String(error?.code || error?.details?.code || '').toUpperCase();
    const message = [
        error?.message,
        error?.details?.message,
        error?.details?.hint,
        error?.details?.details
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    if (code === 'PGRST205') {
        return true;
    }

    return (
        message.includes(`public.${table}`)
        && (message.includes('schema cache') || message.includes('does not exist') || message.includes('not found'))
    ) || message.includes(`relation "${table}" does not exist`)
      || message.includes(`relation "public.${table}" does not exist`);
}
