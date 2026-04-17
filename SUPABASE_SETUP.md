1. Create or open the Supabase project that will back the real client portal.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Deploy these Edge Functions:

```bash
supabase functions deploy admin-provision-user
supabase functions deploy portal-sync-profile
supabase functions deploy stripe-create-checkout-session
supabase functions deploy stripe-webhook
```

4. Add these Supabase function secrets:

```bash
supabase secrets set SUPABASE_URL="https://your-project.supabase.co"
supabase secrets set SUPABASE_ANON_KEY="your-anon-key"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
supabase secrets set ARCHITECH_ADMIN_DOMAINS="architechdesigns.net"
supabase secrets set ARCHITECH_ADMIN_EMAILS="you@example.com"
supabase secrets set STRIPE_SECRET_KEY="sk_live_..."
supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_..."
```

5. In Stripe, create a webhook endpoint pointed at your deployed Edge Function URL:

```text
https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook
```

6. Subscribe that Stripe webhook to:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
```

7. If you also use the same-origin Vercel API routes, add these server-side variables there for `api/admin-provision-user.js`, `api/contact-consultation.js`, and `api/portal-sync-profile.js`:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ARCHITECH_ADMIN_DOMAINS
ARCHITECH_ADMIN_EMAILS
```

8. Set `window.ARCHITECH_PORTAL_CONFIG.supabaseUrl` and `window.ARCHITECH_PORTAL_CONFIG.supabaseAnonKey` in `js/portal-config.js`.
9. Optional: leave invoice payment URLs blank in the admin portal to use generated Stripe Checkout sessions. Only use the invoice payment URL field when you intentionally want an external override.
10. Promote your internal user to admin once their auth profile exists:

```sql
update public.profiles
set role = 'admin'
where email = 'your-admin-email@example.com';
```

11. Verify the private storage bucket exists as `client-documents`.
12. Sign in at `/client-login.html`, open `/ops-suite.html`, and create the first client from the admin portal.
