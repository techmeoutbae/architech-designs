/// <reference lib="deno" />

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
        }
    });
}

Deno.serve(async (request: Request) => {
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
        return json({
            ok: false,
            code: 'METHOD_NOT_ALLOWED',
            message: 'Use POST to submit a consultation request.'
        }, 405);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('SUPABASE_PROJECT_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
        return json({
            ok: false,
            code: 'CONFIG_MISSING',
            message: 'The secure consultation service is not configured yet.'
        }, 503);
    }

    let payload: Record<string, unknown>;
    try {
        payload = await request.json();
    } catch {
        return json({
            ok: false,
            code: 'INVALID_JSON',
            message: 'The consultation payload could not be read.'
        }, 400);
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
    const preferredIso = String(payload?.preferredIso || '').trim() || null;
    const timezone = String(payload?.timezone || '').trim() || 'America/New_York';
    const projectDetails = String(payload?.projectDetails || '').trim();
    const source = String(payload?.source || '').trim() || 'website-contact-scheduler';

    if (!fullName || !email || !companyName || !preferredDate || !preferredTime || !projectDetails) {
        return json({
            ok: false,
            code: 'VALIDATION_ERROR',
            message: 'Name, email, company, preferred consultation slot, and project brief are required.'
        }, 400);
    }

    try {
        const existing = await restRequest(supabaseUrl, serviceRoleKey, `/rest/v1/consultations?select=id&preferred_date=eq.${encodeURIComponent(preferredDate)}&preferred_time=eq.${encodeURIComponent(preferredTime)}&status=in.(new,confirmed)&limit=1`);

        if (existing.length) {
            return json({
                ok: false,
                code: 'SLOT_UNAVAILABLE',
                message: 'That consultation slot was just taken. Please choose another time.'
            }, 409);
        }

        await restRequest(supabaseUrl, serviceRoleKey, '/rest/v1/consultations', {
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
                preferred_iso: preferredIso,
                timezone,
                project_details: projectDetails,
                source
            }],
            prefer: 'return=representation'
        });

        return json({
            ok: true,
            code: 'CONSULTATION_CREATED',
            message: 'Consultation request received and saved to the admin calendar.'
        }, 201);
    } catch (error) {
        if (isMissingTableError(error, 'consultations')) {
            return json({
                ok: false,
                code: 'CONSULTATION_CALENDAR_UNAVAILABLE',
                message: 'The consultation calendar is temporarily unavailable, so we could not reserve that slot automatically.'
            }, 503);
        }

        console.error('[contact-consultation] request failed', error);
        return json({
            ok: false,
            code: 'REQUEST_FAILED',
            message: error instanceof Error ? error.message : 'The consultation request could not be saved.'
        }, 500);
    }
});

async function restRequest(supabaseUrl: string, serviceRoleKey: string, path: string, options: { method?: string; body?: unknown; headers?: Record<string, string>; prefer?: string } = {}) {
    const url = `${supabaseUrl}${path}`;
    const headers: Record<string, string> = {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
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
        method: options.method || 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });

    const body = await safeJson(response);
    if (!response.ok) {
        const message = body?.message || body?.error_description || body?.hint || 'Supabase request failed.';
        const error = new Error(message);
        (error as Error & { details?: unknown }).details = body;
        throw error;
    }

    return Array.isArray(body) ? body : body ? [body] : [];
}

async function safeJson(response: Response) {
    const text = await response.text();
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
}

function isMissingTableError(error: unknown, table: string) {
    const typed = error as { code?: string; details?: { code?: string; message?: string; hint?: string; details?: string }; message?: string };
    const code = String(typed?.code || typed?.details?.code || '').toUpperCase();
    const message = [
        typed?.message,
        typed?.details?.message,
        typed?.details?.hint,
        typed?.details?.details
    ].filter(Boolean).join(' ').toLowerCase();

    if (code === 'PGRST205') {
        return true;
    }

    return (
        message.includes(`public.${table}`)
        && (message.includes('schema cache') || message.includes('does not exist') || message.includes('not found'))
    ) || message.includes(`relation "${table}" does not exist`)
      || message.includes(`relation "public.${table}" does not exist`);
}
