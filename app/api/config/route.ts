import { NextResponse } from "next/server";

// The Supabase publishable key is intentionally public. Serving it from the
// Worker avoids coupling client-side Next.js bundles to build-time variables.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return NextResponse.json({ error: "Supabase runtime configuration is missing." }, { status: 503 });
  return NextResponse.json({ url, publishableKey }, { headers: { "Cache-Control": "no-store" } });
}
