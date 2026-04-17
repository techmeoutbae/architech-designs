/// <reference lib="deno" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type ProvisionPayload = {
    fullName?: string;
    email?: string;
    companyName?: string;
    billingEmail?: string | null;
    projectName?: string;
    serviceLine?: string | null;
    redirectTo?: string | null;
};

type ProvisionState = {
    invitedUserId?: string;
    clientId?: string;
    projectId?: string;
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

function provisioningError(code: string, message: string, details: unknown = null) {
    const error = new Error(message) as Error & { code?: string; details?: unknown };
    error.code = code;
    error.details = details;
    return error;
}

function slugify(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);
}

function isRedirectInviteError(message: string | undefined | null) {
    const normalized = String(message || '').toLowerCase();
    return normalized.includes('redirect')
        || normalized.includes('site url')
        || normalized.includes('allowed')
        || normalized.includes('not permitted');
}

async function inviteClientUser(
    adminClient: ReturnType<typeof createClient>,
    email: string,
    fullName: string,
    redirectTo?: string | null
) {
    let inviteResponse = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        redirectTo: redirectTo || undefined
    });

    if ((inviteResponse.error || !inviteResponse.data.user) && redirectTo && isRedirectInviteError(inviteResponse.error?.message)) {
        inviteResponse = await adminClient.auth.admin.inviteUserByEmail(email, {
            data: { full_name: fullName }
        });
    }

    return inviteResponse;
}

async function cleanupPartialProvision(adminClient: ReturnType<typeof createClient>, state: ProvisionState) {
    try {
        if (state.projectId) {
            await adminClient.from('projects').delete().eq('id', state.projectId);
        }
        if (state.clientId) {
            await adminClient.from('clients').delete().eq('id', state.clientId);
        }
        if (state.invitedUserId) {
            await adminClient.auth.admin.deleteUser(state.invitedUserId);
        }
    } catch (error) {
        console.error('[admin-provision-user] cleanup failed', error);
    }
}

Deno.serve(async (request: Request) => {
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
        return json({
            ok: false,
            code: 'METHOD_NOT_ALLOWED',
            message: 'Use POST when provisioning a client account.'
        }, 405);
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
            message: 'Sign in again before creating a client account.'
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

    const state: ProvisionState = {};

    try {
        const {
            data: { user: caller },
            error: authError
        } = await authClient.auth.getUser();

        if (authError || !caller) {
            throw provisioningError('AUTH_REQUIRED', 'Sign in again before creating a client account.', authError);
        }

        const { data: callerProfile, error: callerProfileError } = await adminClient
            .from('profiles')
            .select('id, role')
            .eq('id', caller.id)
            .single();

        if (callerProfileError) {
            throw provisioningError('PROVISIONING_FAILED', callerProfileError.message, callerProfileError);
        }

        if (callerProfile?.role !== 'admin') {
            throw provisioningError('FORBIDDEN', 'Only internal admin accounts can provision live client access.');
        }

        const payload = await request.json() as ProvisionPayload;
        const fullName = payload.fullName?.trim();
        const email = payload.email?.trim().toLowerCase();
        const companyName = payload.companyName?.trim();
        const billingEmail = payload.billingEmail?.trim().toLowerCase() || email;
        const projectName = payload.projectName?.trim();
        const serviceLine = payload.serviceLine?.trim() || null;

        if (!fullName || !email || !companyName || !projectName) {
            throw provisioningError('VALIDATION_ERROR', 'Primary contact, portal email, company name, and initial project are required.');
        }

        const { data: existingProfile, error: existingProfileError } = await adminClient
            .from('profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (existingProfileError) {
            throw provisioningError('PROVISIONING_FAILED', existingProfileError.message, existingProfileError);
        }

        if (existingProfile) {
            throw provisioningError('DUPLICATE_CLIENT', 'That portal email is already tied to an existing account.');
        }

        const inviteResponse = await inviteClientUser(adminClient, email, fullName, payload.redirectTo || null);

        if (inviteResponse.error || !inviteResponse.data.user) {
            throw provisioningError('PROVISIONING_FAILED', inviteResponse.error?.message || 'The invite could not be created.', inviteResponse.error);
        }

        const invitedUserId = inviteResponse.data.user.id;
        state.invitedUserId = invitedUserId;

        const { error: profileError } = await adminClient
            .from('profiles')
            .upsert({
                id: invitedUserId,
                email,
                full_name: fullName,
                role: 'client'
            }, { onConflict: 'id' });

        if (profileError) {
            throw provisioningError('PROVISIONING_FAILED', profileError.message, profileError);
        }

        const timestamp = Date.now().toString().slice(-6);
        const { data: clientRecord, error: clientError } = await adminClient
            .from('clients')
            .insert({
                profile_id: invitedUserId,
                company_name: companyName,
                slug: `${slugify(companyName)}-${timestamp}`,
                billing_email: billingEmail,
                created_by: caller.id
            })
            .select()
            .single();

        if (clientError || !clientRecord) {
            throw provisioningError('PROVISIONING_FAILED', clientError?.message || 'The client record could not be created.', clientError);
        }
        state.clientId = clientRecord.id;

        const { data: projectRecord, error: projectError } = await adminClient
            .from('projects')
            .insert({
                client_id: clientRecord.id,
                name: projectName,
                slug: `${slugify(projectName)}-${timestamp}`,
                service_line: serviceLine,
                status: 'active',
                current_phase: 'Onboarding and workspace setup',
                description: 'Initial project created during client portal provisioning.',
                created_by: caller.id
            })
            .select()
            .single();

        if (projectError || !projectRecord) {
            throw provisioningError('PROVISIONING_FAILED', projectError?.message || 'The project record could not be created.', projectError);
        }
        state.projectId = projectRecord.id;

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
            throw provisioningError('PROVISIONING_FAILED', membershipError.message, membershipError);
        }

        return json({
            ok: true,
            code: 'CLIENT_PROVISIONED',
            message: 'Client account created and invite sent.',
            data: {
                clientId: clientRecord.id,
                projectId: projectRecord.id,
                invitedUserId
            }
        }, 201);
    } catch (error) {
        console.error('[admin-provision-user] provisioning failed', error);
        await cleanupPartialProvision(adminClient, state);

        const typedError = error as Error & { code?: string; details?: unknown };
        const code = typedError.code || 'PROVISIONING_FAILED';
        const status = code === 'VALIDATION_ERROR'
            ? 400
            : code === 'AUTH_REQUIRED'
                ? 401
                : code === 'FORBIDDEN'
                    ? 403
                    : code === 'DUPLICATE_CLIENT'
                        ? 409
                        : 500;

        return json({
            ok: false,
            code,
            message: typedError.message || 'The client account could not be provisioned.',
            details: typedError.details || null
        }, status);
    }
});
