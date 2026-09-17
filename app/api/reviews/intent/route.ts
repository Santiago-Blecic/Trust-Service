import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { proofId, rating } = await request.json();
  if (typeof proofId !== "string" || !Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) return NextResponse.json({ error: "Invalid rating token request" }, { status: 400 });
  const { data: proof } = await supabase.from("proofs_of_service").select("id,review_used_at,booking:bookings(customer_id,status)").eq("id", proofId).single();
  const booking = Array.isArray(proof?.booking) ? proof?.booking[0] : proof?.booking;
  const { data: profile } = await supabase.from("profiles").select("wallet_address").eq("id", user.id).single();
  if (!proof || proof.review_used_at || booking?.customer_id !== user.id || booking.status !== "completed" || !profile?.wallet_address) return NextResponse.json({ error: "This review is not eligible for a rating token" }, { status: 403 });
  const marker = Buffer.from(JSON.stringify({ app: "proofly", proofId, rating: Number(rating) }), "utf8").toString("hex").toUpperCase();
  return NextResponse.json({ transaction: { TransactionType: "NFTokenMint", Account: profile.wallet_address, URI: marker, NFTokenTaxon: 0, Flags: 8 } });
}
