/// <reference lib="deno" />
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type CheckoutPayload = {
    invoiceId?: string;
    successUrl?: string;
    cancelUrl?: string;
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

function sanitizeUrl(value: string | undefined | null) {
    if (!value) {
        return '';
    }

    try {
        const url = new URL(String(value).trim());
        return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
    } catch {
        return '';
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
            message: 'Use POST to create a Stripe Checkout session.'
        }, 405);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('SUPABASE_PROJECT_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const authHeader = request.headers.get('Authorization');

    const missingSecrets = [
        ['SUPABASE_URL', supabaseUrl],
        ['SUPABASE_ANON_KEY', supabaseAnonKey],
        ['SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey],
        ['STRIPE_SECRET_KEY', stripeSecretKey]
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
            message: 'Sign in again before paying an invoice.'
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

    const stripe = new Stripe(stripeSecretKey!, {
        apiVersion: '2024-06-20'
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
                message: 'Sign in again before paying an invoice.'
            }, 401);
        }

        const payload = await request.json() as CheckoutPayload;
        const invoiceId = String(payload.invoiceId || '').trim();
        const successUrl = sanitizeUrl(payload.successUrl);
        const cancelUrl = sanitizeUrl(payload.cancelUrl);

        if (!invoiceId || !successUrl || !cancelUrl) {
            return json({
                ok: false,
                code: 'VALIDATION_ERROR',
                message: 'Invoice ID, success URL, and cancel URL are required.'
            }, 400);
        }

        const [{ data: profile, error: profileError }, { data: invoice, error: invoiceError }] = await Promise.all([
            adminClient.from('profiles').select('id, role, email, full_name').eq('id', user.id).single(),
            adminClient.from('invoices').select('*').eq('id', invoiceId).single()
        ]);

        if (profileError || !profile) {
            return json({
                ok: false,
                code: 'PROFILE_NOT_FOUND',
                message: profileError?.message || 'Your portal profile could not be loaded.'
            }, 403);
        }

        if (invoiceError || !invoice) {
            return json({
                ok: false,
                code: 'INVOICE_NOT_FOUND',
                message: invoiceError?.message || 'That invoice could not be found.'
            }, 404);
        }

        const isAdmin = profile.role === 'admin';
        if (!isAdmin) {
            const { data: membership, error: membershipError } = await adminClient
                .from('project_memberships')
                .select('id')
                .eq('project_id', invoice.project_id)
                .eq('user_id', user.id)
                .maybeSingle();

            if (membershipError) {
                throw membershipError;
            }

            if (!membership) {
                return json({
                    ok: false,
                    code: 'FORBIDDEN',
                    message: 'You do not have access to this invoice.'
                }, 403);
            }
        }

        if (['paid', 'void'].includes(String(invoice.status || '').toLowerCase())) {
            return json({
                ok: false,
                code: 'INVOICE_NOT_PAYABLE',
                message: 'This invoice is no longer payable.'
            }, 409);
        }

        const amount = Number(invoice.amount || 0);
        if (!Number.isFinite(amount) || amount <= 0) {
            return json({
                ok: false,
                code: 'INVALID_AMOUNT',
                message: 'This invoice has an invalid amount.'
            }, 400);
        }

        const currency = String(invoice.currency || 'USD').toLowerCase();
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            success_url: successUrl,
            cancel_url: cancelUrl,
            customer_email: user.email || profile.email || undefined,
            client_reference_id: invoice.id,
            metadata: {
                invoice_id: invoice.id,
                project_id: invoice.project_id,
                requested_by: user.id
            },
            payment_intent_data: {
                metadata: {
                    invoice_id: invoice.id,
                    project_id: invoice.project_id,
                    requested_by: user.id
                }
            },
            line_items: [{
                quantity: 1,
                price_data: {
                    currency,
                    unit_amount: Math.round(amount * 100),
                    product_data: {
                        name: invoice.title,
                        description: invoice.description || `Invoice ${invoice.invoice_number || invoice.id}`
                    }
                }
            }]
        });

        const updatePayload: Record<string, string> = {
            stripe_checkout_session_id: session.id
        };

        if (typeof session.customer === 'string' && session.customer) {
            updatePayload.stripe_customer_id = session.customer;
        }

        const { error: invoiceUpdateError } = await adminClient.from('invoices').update(updatePayload).eq('id', invoice.id);
        if (invoiceUpdateError) {
            throw invoiceUpdateError;
        }

        return json({
            ok: true,
            code: 'CHECKOUT_CREATED',
            message: 'Stripe Checkout session created.',
            data: {
                sessionId: session.id,
                url: session.url || ''
            }
        });
    } catch (error) {
        console.error('[stripe-create-checkout-session] failed', error);
        return json({
            ok: false,
            code: 'CHECKOUT_FAILED',
            message: error instanceof Error ? error.message : 'Stripe Checkout could not be created.'
        }, 500);
    }
});
