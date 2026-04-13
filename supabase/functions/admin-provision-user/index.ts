/// <reference lib="deno" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type ProvisionPayload = {
    fullName: string;
    email: string;
    companyName: string;
    billingEmail?: string | null;
    projectName: string;
    serviceLine?: string | null;
    redirectTo?: string | null;
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

function slugify(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);
}

Deno.serve(async (request: Request) => {
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
        return json({ error: 'Method not allowed.' }, 405);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('SUPABASE_PROJECT_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = request.headers.get('Authorization');

    const missingSecrets = [
        ['SUPABASE_URL', supabaseUrl],
        ['SUPABASE_ANON_KEY', supabaseAnonKey],
        ['SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey]
    ].filter(([, value]) => !value).map(([name]) => name);

    if (missingSecrets.length) {
        return json({ error: `Missing environment variables: ${missingSecrets.join(', ')}.` }, 500);
    }

    if (!authHeader) {
        return json({ error: 'Missing authorization header.' }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: { Authorization: authHeader }
        },
        auth: { autoRefreshToken: false, persistSession: false }
    });

    const {
        data: { user: caller },
        error: authError
    } = await authClient.auth.getUser();

    if (authError || !caller) {
        return json({ error: 'Unable to authenticate the current user.' }, 401);
    }

    const { data: callerProfile } = await adminClient
        .from('profiles')
        .select('id, role')
        .eq('id', caller.id)
        .single();

    if (callerProfile?.role !== 'admin') {
        return json({ error: 'Only admins can provision new portal users.' }, 403);
    }

    const payload = await request.json() as ProvisionPayload;
    const fullName = payload.fullName?.trim();
    const email = payload.email?.trim().toLowerCase();
    const companyName = payload.companyName?.trim();
    const projectName = payload.projectName?.trim();

    if (!fullName || !email || !companyName || !projectName) {
        return json({ error: 'fullName, email, companyName, and projectName are required.' }, 400);
    }

    const { data: existingClient } = await adminClient
        .from('clients')
        .select('id')
        .eq('billing_email', email)
        .maybeSingle();

    if (existingClient) {
        return json({ error: 'A client record already exists for that email.' }, 409);
    }

    const inviteResponse = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        redirectTo: payload.redirectTo || undefined
    });

    if (inviteResponse.error || !inviteResponse.data.user) {
        return json({ error: inviteResponse.error?.message || 'The invite could not be created.' }, 400);
    }

    const invitedUserId = inviteResponse.data.user.id;

    const { error: profileError } = await adminClient
        .from('profiles')
        .upsert({
            id: invitedUserId,
            email,
            full_name: fullName,
            role: 'client'
        }, { onConflict: 'id' });

    if (profileError) {
        return json({ error: profileError.message }, 400);
    }

    const companySlug = slugify(companyName);
    const projectSlugBase = slugify(projectName);
    const timestamp = Date.now().toString().slice(-6);

    const { data: clientRecord, error: clientError } = await adminClient
        .from('clients')
        .insert({
            profile_id: invitedUserId,
            company_name: companyName,
            slug: `${companySlug}-${timestamp}`,
            billing_email: payload.billingEmail?.trim().toLowerCase() || email,
            created_by: caller.id
        })
        .select()
        .single();

    if (clientError || !clientRecord) {
        return json({ error: clientError?.message || 'The client record could not be created.' }, 400);
    }

    const { data: projectRecord, error: projectError } = await adminClient
        .from('projects')
        .insert({
            client_id: clientRecord.id,
            name: projectName,
            slug: `${projectSlugBase}-${timestamp}`,
            service_line: payload.serviceLine?.trim() || null,
            status: 'active',
            current_phase: 'Onboarding and workspace setup',
            description: 'Initial project created during client portal provisioning.',
            created_by: caller.id
        })
        .select()
        .single();

    if (projectError || !projectRecord) {
        return json({ error: projectError?.message || 'The project record could not be created.' }, 400);
    }

    const { error: membershipError } = await adminClient
        .from('project_memberships')
        .upsert([
            {
                project_id: projectRecord.id,
                user_id: caller.id,
                membership_role: 'admin',
                is_primary: false
            },
            {
                project_id: projectRecord.id,
                user_id: invitedUserId,
                membership_role: 'client',
                is_primary: true
            }
        ], { onConflict: 'project_id,user_id' });

    if (membershipError) {
        return json({ error: membershipError.message }, 400);
    }

    return json({
        clientId: clientRecord.id,
        projectId: projectRecord.id,
        invitedUserId
    });
});
