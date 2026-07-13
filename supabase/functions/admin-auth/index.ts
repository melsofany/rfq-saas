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

      const { data: adminCheck } = await adminSupabase
        .from("saas_admins")
        .select("id, role")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      if (!adminCheck) {
        await adminSupabase.auth.signOut();
        return new Response(
          JSON.stringify({ error: "You do not have admin privileges." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          user: {
            id: authData.user.id,
            email: authData.user.email,
          },
          session: {
            access_token: authData.session?.access_token,
            refresh_token: authData.session?.refresh_token,
            expires_at: authData.session?.expires_at,
          },
          admin: adminCheck,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "session" && req.method === "POST") {
      const { access_token, refresh_token } = await req.json();

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

      const { data: adminCheck } = await adminSupabase
        .from("saas_admins")
        .select("id, role")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          user: { id: userData.user.id, email: userData.user.email },
          admin: adminCheck,
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
