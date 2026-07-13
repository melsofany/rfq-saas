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

      const { data: admin } = await supabase
        .from("saas_admins")
        .select("id, email, password_hash, role, is_active")
        .eq("email", email.toLowerCase())
        .eq("is_active", true)
        .maybeSingle();

      if (!admin) {
        return new Response(JSON.stringify({ error: "Invalid credentials" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const bcrypt = await import("npm:bcryptjs@2.4.3");
      const valid = bcrypt.compareSync(password, admin.password_hash);
      if (!valid) {
        return new Response(JSON.stringify({ error: "Invalid credentials" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const jwt = await import("npm:jsonwebtoken@9.0.2");
      const token = jwt.sign(
        { sub: admin.id, email: admin.email, role: admin.role, type: "admin" },
        Deno.env.get("JWT_SECRET") || "rfq-saas-secret-key-2026",
        { expiresIn: "7d" }
      );

      return new Response(JSON.stringify({
        session: { access_token: token },
        user: { id: admin.id, email: admin.email },
        admin: { id: admin.id, role: admin.role },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "session") {
      const { access_token } = body;
      if (!access_token) {
        return new Response(JSON.stringify({ user: null, admin: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const jwt = await import("npm:jsonwebtoken@9.0.2");
        const decoded = jwt.verify(access_token, Deno.env.get("JWT_SECRET") || "rfq-saas-secret-key-2026") as any;
        if (!decoded || decoded.type !== "admin") {
          return new Response(JSON.stringify({ user: null, admin: null }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: admin } = await supabase
          .from("saas_admins")
          .select("id, email, role, is_active")
          .eq("id", decoded.sub)
          .eq("is_active", true)
          .maybeSingle();

        if (!admin) {
          return new Response(JSON.stringify({ user: null, admin: null }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          user: { id: admin.id, email: admin.email },
          admin: { id: admin.id, role: admin.role },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch {
        return new Response(JSON.stringify({ user: null, admin: null }), {
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