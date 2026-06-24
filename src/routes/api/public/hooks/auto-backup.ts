import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/auto-backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey =
          request.headers.get("apikey") ||
          request.headers.get("x-api-key") ||
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        let force = false;
        try {
          const body = (await request.json()) as { force?: boolean };
          force = !!body?.force;
        } catch {
          // empty body is fine
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { runAutoBackup } = await import("@/lib/backup-runner.server");
          const result = await runAutoBackup(supabaseAdmin, { force, trigger: "cron" });
          return Response.json(result);
        } catch (err: any) {
          return new Response(
            JSON.stringify({ error: err?.message ?? "internal" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});