/**
 * Public GitHub Pages configuration.
 *
 * Supabase publishable/anon keys are designed to be used in browser apps.
 * Never place a service_role key in this file. Database access is protected
 * by the RLS policies in supabase/schema.sql.
 */
window.CASUALPASS_CLOUD = Object.freeze({
    enabled: false,
    supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
    supabasePublishableKey: 'YOUR_SUPABASE_PUBLISHABLE_KEY',
    table: 'casual_profiles',
    sdkUrl: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm'
});
