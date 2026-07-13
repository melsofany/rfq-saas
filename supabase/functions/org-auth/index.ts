import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const url = new URL(req.url);
    const action = url.pathname.split("/").pop();

    if (action === "login" && req.method === "POST") {
      const { email, password } = await req.json();

      const { data: authData, error: authError } =
        await adminSupabase.auth.signInWithPassword({ email, password });

      if (authError || !authData.user) {
        return new Response(
          JSON.stringify({ error: authError?.message || "Invalid credentials" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: member } = await adminSupabase
        .from("organization_members")
        .select("id, org_id, role, is_active")
        .eq("user_id", authData.user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!member) {
        await adminSupabase.auth.signOut();
        return new Response(
          JSON.stringify({ error: "No organization membership found for this account." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          user: { id: authData.user.id, email: authData.user.email },
          session: {
            access_token: authData.session?.access_token,
            refresh_token: authData.session?.refresh_token,
            expires_at: authData.session?.expires_at,
          },
          member: member,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "register" && req.method === "POST") {
      const { email, password, org_name, org_name_ar, slug, phone, address, country, plan_id } = await req.json();

      const { data: authData, error: authError } =
        await adminSupabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (authError || !authData.user) {
        return new Response(
          JSON.stringify({ error: authError?.message || "Failed to create user" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: orgData, error: orgError } = await adminSupabase
        .from("organizations")
        .insert({
          name: org_name,
          name_ar: org_name_ar || null,
          slug,
          email,
          phone: phone || null,
          address: address || null,
          country: country || null,
          plan_id: plan_id || null,
          status: "trialing",
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select("id")
        .single();

      if (orgError || !orgData) {
        await adminSupabase.auth.admin.deleteUser(authData.user.id);
        return new Response(
          JSON.stringify({ error: orgError?.message || "Failed to create organization" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: memberError } = await adminSupabase
        .from("organization_members")
        .insert({
          org_id: orgData.id,
          user_id: authData.user.id,
          role: "admin",
          is_active: true,
        });

      if (memberError) {
        await adminSupabase.from("organizations").delete().eq("id", orgData.id);
        await adminSupabase.auth.admin.deleteUser(authData.user.id);
        return new Response(
          JSON.stringify({ error: "Failed to create organization membership" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await adminSupabase
        .from("company_settings")
        .insert({
          org_id: orgData.id,
          name_en: org_name,
          name_ar: org_name_ar || null,
          address: address || null,
          phone: phone || null,
          email,
          currency: "USD",
        });

      const { data: signInData, error: signInError } =
        await adminSupabase.auth.signInWithPassword({ email, password });

      if (signInError || !signInData.session) {
        return new Response(
          JSON.stringify({ error: "Account created but login failed. Please sign in." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          user: { id: authData.user.id, email: authData.user.email },
          session: {
            access_token: signInData.session.access_token,
            refresh_token: signInData.session.refresh_token,
            expires_at: signInData.session.expires_at,
          },
          member: { org_id: orgData.id, role: "admin", is_active: true },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "session" && req.method === "POST") {
      const { access_token } = await req.json();

      if (!access_token) {
        return new Response(
          JSON.stringify({ user: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: userData, error: userError } =
        await adminSupabase.auth.getUser(access_token);

      if (userError || !userData.user) {
        return new Response(
          JSON.stringify({ user: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: member } = await adminSupabase
        .from("organization_members")
        .select("id, org_id, role, is_active")
        .eq("user_id", userData.user.id)
        .eq("is_active", true)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          user: { id: userData.user.id, email: userData.user.email },
          member: member,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "refresh" && req.method === "POST") {
      const { refresh_token } = await req.json();

      if (!refresh_token) {
        return new Response(
          JSON.stringify({ error: "No refresh token" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: refreshData, error: refreshError } =
        await adminSupabase.auth.refreshSession({ refresh_token });

      if (refreshError || !refreshData.session) {
        return new Response(
          JSON.stringify({ error: "Session expired" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          session: {
            access_token: refreshData.session.access_token,
            refresh_token: refreshData.session.refresh_token,
            expires_at: refreshData.session.expires_at,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "logout" && req.method === "POST") {
      const { access_token } = await req.json();
      if (access_token) {
        await adminSupabase.auth.signOut(access_token);
      }
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
