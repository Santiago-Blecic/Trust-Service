import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { bookingId } = await request.json();
  const { data: booking } = await supabase.from("bookings").select("id,total_cents,status,provider:providers(wallet_address),customer:profiles!bookings_customer_id_fkey(wallet_address)").eq("id", bookingId).eq("customer_id", user.id).single();
  const provider = Array.isArray(booking?.provider) ? booking?.provider[0] : booking?.provider;
  const customer = Array.isArray(booking?.customer) ? booking?.customer[0] : booking?.customer;
  if (!booking || booking.status !== "awaiting_payment" || !provider?.wallet_address || !customer?.wallet_address) return NextResponse.json({ error: "This booking is not ready for payment." }, { status: 409 });
  return NextResponse.json({ transaction: { TransactionType: "Payment", Account: customer.wallet_address, Destination: provider.wallet_address, Amount: String(booking.total_cents * 10000) } });
}
