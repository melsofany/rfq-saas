import { createClient } from "npm:@supabase/supabase-js@2";

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const action = url.pathname.split("/").pop() || "";
    const body = await req.json().catch(() => ({}));

    if (action === "login") {
      const { email, password } = body;
      if (!email || !password) {
        return new Response(JSON.stringify({ error: "Email and password required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: user } = await supabase
        .from("org_users")
        .select("id, email, password_hash, full_name, is_active")
        .eq("email", email.toLowerCase())
        .eq("is_active", true)
        .maybeSingle();

      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid email or password" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const bcrypt = await import("npm:bcryptjs@2.4.3");
      const valid = bcrypt.compareSync(password, user.password_hash);
      if (!valid) {
        return new Response(JSON.stringify({ error: "Invalid email or password" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: member } = await supabase
        .from("organization_members")
        .select("id, org_id, role, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!member) {
        return new Response(JSON.stringify({ error: "No active organization membership" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const jwt = await import("npm:jsonwebtoken@9.0.2");
      const token = jwt.sign(
        { sub: user.id, email: user.email, orgId: member.org_id, role: member.role, type: "org" },
        Deno.env.get("JWT_SECRET") || "rfq-saas-secret-key-2026",
        { expiresIn: "7d" }
      );

      return new Response(JSON.stringify({
        session: { access_token: token },
        user: { id: user.id, email: user.email, full_name: user.full_name },
        member: { id: member.id, org_id: member.org_id, role: member.role, is_active: member.is_active },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "register") {
      const { email, password, full_name, org_name, org_name_ar, slug, phone, address, country, plan_id } = body;
      if (!email || !password || !org_name || !slug) {
        return new Response(JSON.stringify({ error: "Email, password, org name, and slug required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existing } = await supabase
        .from("org_users").select("id").eq("email", email.toLowerCase()).maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ error: "Account already exists" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existingSlug } = await supabase
        .from("organizations").select("id").eq("slug", slug).maybeSingle();
      if (existingSlug) {
        return new Response(JSON.stringify({ error: "Slug already taken" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const bcrypt = await import("npm:bcryptjs@2.4.3");
      const passwordHash = bcrypt.hashSync(password, 10);

      const { data: newUser } = await supabase
        .from("org_users")
        .insert({ email: email.toLowerCase(), password_hash: passwordHash, full_name: full_name || null, is_active: true })
        .select("id, email, full_name")
        .single();

      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data: org } = await supabase
        .from("organizations")
        .insert({
          name: org_name, name_ar: org_name_ar || null, slug,
          email: email.toLowerCase(), phone: phone || null,
          address: address || null, country: country || null,
          plan_id: plan_id || null, status: "trialing", trial_ends_at: trialEndsAt,
        })
        .select("id")
        .single();

      await supabase
        .from("organization_members")
        .insert({ org_id: org.id, user_id: newUser.id, email: email.toLowerCase(), role: "admin", is_active: true });

      await supabase
        .from("company_settings")
        .insert({ org_id: org.id, name_en: org_name, name_ar: org_name_ar || null, currency: "USD" });

      if (plan_id) {
        await supabase
          .from("subscriptions")
          .insert({ org_id: org.id, plan_id, status: "active", billing_cycle: "monthly", current_period_start: new Date().toISOString(), current_period_end: trialEndsAt });
      }

      const { data: member } = await supabase
        .from("organization_members")
        .select("id, org_id, role, is_active")
        .eq("org_id", org.id).eq("user_id", newUser.id).maybeSingle();

      const jwt = await import("npm:jsonwebtoken@9.0.2");
      const token = jwt.sign(
        { sub: newUser.id, email: newUser.email, orgId: org.id, role: "admin", type: "org" },
        Deno.env.get("JWT_SECRET") || "rfq-saas-secret-key-2026",
        { expiresIn: "7d" }
      );

      return new Response(JSON.stringify({
        session: { access_token: token },
        user: { id: newUser.id, email: newUser.email, full_name: newUser.full_name },
        member: { id: member.id, org_id: member.org_id, role: member.role, is_active: member.is_active },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "session") {
      const { access_token } = body;
      if (!access_token) {
        return new Response(JSON.stringify({ user: null, member: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const jwt = await import("npm:jsonwebtoken@9.0.2");
        const decoded = jwt.verify(access_token, Deno.env.get("JWT_SECRET") || "rfq-saas-secret-key-2026") as any;
        if (!decoded || decoded.type !== "org") {
          return new Response(JSON.stringify({ user: null, member: null }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: user } = await supabase
          .from("org_users")
          .select("id, email, full_name, is_active")
          .eq("id", decoded.sub)
          .eq("is_active", true)
          .maybeSingle();

        if (!user) {
          return new Response(JSON.stringify({ user: null, member: null }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: member } = await supabase
          .from("organization_members")
          .select("id, org_id, role, is_active")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        return new Response(JSON.stringify({
          user: { id: user.id, email: user.email, full_name: user.full_name },
          member: member || null,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch {
        return new Response(JSON.stringify({ user: null, member: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "logout") {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});