import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json();
  const { data, error } = await supabase.rpc("apply_as_provider", {
    p_bio: String(body.bio || ""),
    p_title: String(body.title || ""),
    p_description: String(body.description || ""),
    p_category: String(body.category || ""),
    p_price_cents: Number(body.priceCents),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ serviceId: data, status: "pending_manual_identity_review" }, { status: 201 });
}
