/// <reference lib="deno" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

function parseCsv(value: string | undefined | null) {
    return String(value || '')
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
}

function isInternalAdmin(email: string, adminEmails: string[], adminDomains: string[]) {
    if (!email) {
        return false;
    }

    if (adminEmails.includes(email)) {
        return true;
    }

    const domain = email.split('@')[1] || '';
    return adminDomains.includes(domain);
}

Deno.serve(async (request: Request) => {
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
        return json({
            ok: false,
            code: 'METHOD_NOT_ALLOWED',
            message: 'Use POST to synchronize the portal profile.'
        }, 405);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('SUPABASE_PROJECT_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = request.headers.get('Authorization');
    const adminEmails = parseCsv(Deno.env.get('ARCHITECH_ADMIN_EMAILS'));
    const adminDomains = parseCsv(Deno.env.get('ARCHITECH_ADMIN_DOMAINS') || 'architechdesigns.net');

    const missingSecrets = [
        ['SUPABASE_URL', supabaseUrl],
        ['SUPABASE_ANON_KEY', supabaseAnonKey],
        ['SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey]
    ].filter(([, value]) => !value).map(([name]) => name);

    if (missingSecrets.length) {
        return json({
            ok: false,
            code: 'CONFIG_MISSING',
            message: `Missing environment variables: ${missingSecrets.join(', ')}.`
        }, 500);
    }

    if (!authHeader) {
        return json({
            ok: false,
            code: 'AUTH_REQUIRED',
            message: 'Sign in again before loading the portal.'
        }, 401);
    }

    const adminClient = createClient(supabaseUrl!, serviceRoleKey!, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    const authClient = createClient(supabaseUrl!, supabaseAnonKey!, {
        global: {
            headers: { Authorization: authHeader }
        },
        auth: { autoRefreshToken: false, persistSession: false }
    });

    try {
        const {
            data: { user },
            error: authError
        } = await authClient.auth.getUser();

        if (authError || !user) {
            return json({
                ok: false,
                code: 'AUTH_REQUIRED',
                message: 'Sign in again before loading the portal.'
            }, 401);
        }

        const email = String(user.email || '').trim().toLowerCase();
        const fullName = String(
            user.user_metadata?.full_name
            || user.user_metadata?.fullName
            || user.app_metadata?.full_name
            || email.split('@')[0]
            || ''
        ).trim();

        const { data: existingProfile, error: profileError } = await adminClient
            .from('profiles')
            .select('id, role, email, full_name')
            .eq('id', user.id)
            .maybeSingle();

        if (profileError) {
            throw profileError;
        }

        const role = isInternalAdmin(email, adminEmails, adminDomains) || existingProfile?.role === 'admin'
            ? 'admin'
            : (existingProfile?.role || 'client');

        const { data: profile, error: upsertError } = await adminClient
            .from('profiles')
            .upsert({
                id: user.id,
                email,
                full_name: fullName,
                role
            }, { onConflict: 'id' })
            .select('*')
            .single();

        if (upsertError) {
            throw upsertError;
        }

        return json({
            ok: true,
            code: 'PROFILE_SYNCED',
            message: role === 'admin'
                ? 'Portal profile synchronized with internal admin access.'
                : 'Portal profile synchronized successfully.',
            data: profile
        });
    } catch (error) {
        console.error('[portal-sync-profile] sync failed', error);
        return json({
            ok: false,
            code: 'PROFILE_SYNC_FAILED',
            message: error instanceof Error ? error.message : 'The portal profile could not be synchronized.'
        }, 500);
    }
});
