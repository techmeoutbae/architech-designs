/// <reference lib="deno" />
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

async function recordSuccessfulCheckout(adminClient: ReturnType<typeof createClient>, session: Stripe.Checkout.Session) {
    const invoiceId = String(session.metadata?.invoice_id || session.client_reference_id || '').trim();
    if (!invoiceId) {
        return;
    }

    const { data: invoice, error: invoiceError } = await adminClient
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .maybeSingle();

    if (invoiceError) {
        throw invoiceError;
    }

    if (!invoice) {
        return;
    }

    const paidAt = new Date((session.created || Math.floor(Date.now() / 1000)) * 1000).toISOString();
    const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id || session.id;
    const amountPaid = Number((session.amount_total ?? Math.round(Number(invoice.amount || 0) * 100)) / 100);
    const customerId = typeof session.customer === 'string' ? session.customer : null;

    const { data: existingPayment, error: existingPaymentError } = await adminClient
        .from('payment_records')
        .select('id')
        .eq('provider_payment_id', paymentIntentId)
        .maybeSingle();

    if (existingPaymentError) {
        throw existingPaymentError;
    }

    const { error: invoiceUpdateError } = await adminClient
        .from('invoices')
        .update({
            status: 'paid',
            paid_at: paidAt,
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: paymentIntentId,
            stripe_customer_id: customerId
        })
        .eq('id', invoice.id);

    if (invoiceUpdateError) {
        throw invoiceUpdateError;
    }

    if (!existingPayment) {
        const { error: paymentInsertError } = await adminClient.from('payment_records').insert({
            invoice_id: invoice.id,
            recorded_by: invoice.created_by,
            amount: amountPaid,
            method: 'Stripe Checkout',
            reference: session.id,
            paid_at: paidAt,
            provider: 'stripe',
            provider_payment_id: paymentIntentId,
            provider_status: session.payment_status || 'paid',
            metadata: {
                checkout_session_id: session.id,
                customer_id: customerId,
                customer_email: session.customer_details?.email || session.customer_email || null,
                payment_status: session.payment_status || 'paid'
            }
        });

        if (paymentInsertError) {
            throw paymentInsertError;
        }
    }
}

Deno.serve(async (request: Request) => {
    if (request.method !== 'POST') {
        return json({ ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Use POST for Stripe webhooks.' }, 405);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('SUPABASE_PROJECT_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    const missingSecrets = [
        ['SUPABASE_URL', supabaseUrl],
        ['SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey],
        ['STRIPE_SECRET_KEY', stripeSecretKey],
        ['STRIPE_WEBHOOK_SECRET', stripeWebhookSecret]
    ].filter(([, value]) => !value).map(([name]) => name);

    if (missingSecrets.length) {
        return json({
            ok: false,
            code: 'CONFIG_MISSING',
            message: `Missing environment variables: ${missingSecrets.join(', ')}.`
        }, 500);
    }

    const signature = request.headers.get('stripe-signature');
    if (!signature) {
        return json({ ok: false, code: 'SIGNATURE_MISSING', message: 'Missing Stripe signature header.' }, 400);
    }

    const rawBody = await request.text();
    const stripe = new Stripe(stripeSecretKey!, {
        apiVersion: '2024-06-20'
    });
    const cryptoProvider = Stripe.createSubtleCryptoProvider();
    const adminClient = createClient(supabaseUrl!, serviceRoleKey!, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    try {
        const event = await stripe.webhooks.constructEventAsync(rawBody, signature, stripeWebhookSecret!, undefined, cryptoProvider);

        if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
            await recordSuccessfulCheckout(adminClient, event.data.object as Stripe.Checkout.Session);
        }

        return json({ ok: true, received: true });
    } catch (error) {
        console.error('[stripe-webhook] failed', error);
        return json({
            ok: false,
            code: 'WEBHOOK_FAILED',
            message: error instanceof Error ? error.message : 'The Stripe webhook could not be processed.'
        }, 400);
    }
});
