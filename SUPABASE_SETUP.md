1. Create or open the Supabase project that will back the real client portal.
2. Run [supabase/schema.sql](/c:/Projects/architech-designs/supabase/schema.sql) in the SQL editor.
3. Deploy the Edge Function in [supabase/functions/admin-provision-user/index.ts](/c:/Projects/architech-designs/supabase/functions/admin-provision-user/index.ts).
4. Set `window.ARCHITECH_PORTAL_CONFIG.supabaseUrl` and `window.ARCHITECH_PORTAL_CONFIG.supabaseAnonKey` in [js/portal-config.js](/c:/Projects/architech-designs/js/portal-config.js).
5. Promote your internal user to admin once their auth profile exists:

```sql
update public.profiles
set role = 'admin'
where email = 'your-admin-email@example.com';
```

6. Verify the private storage bucket exists as `client-documents`.
7. Sign in at `/client-login.html`, open `/ops-suite.html`, and create the first client from the admin portal.
