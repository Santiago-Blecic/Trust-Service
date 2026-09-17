import { NextResponse } from "next/server";
import { Client, decode } from "xrpl";
import { createClient } from "@/lib/supabase/server";

const xrplUrl = process.env.XRPL_WSS_URL || "wss://s.altnet.rippletest.net:51233";

export async function POST(request: Request) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { signedTransaction } = await request.json();
  if (typeof signedTransaction !== "string" || !/^[A-F0-9]+$/i.test(signedTransaction)) return NextResponse.json({ error: "Invalid signed transaction" }, { status: 400 });
  try {
    const tx = decode(signedTransaction) as { TransactionType?: string; Account?: string };
    if (tx.TransactionType !== "Payment" && tx.TransactionType !== "NFTokenMint") return NextResponse.json({ error: "Only Proofly payments and rating tokens may be submitted." }, { status: 400 });
    const { data: profile } = await supabase.from("profiles").select("wallet_address").eq("id", user.id).single();
    if (!profile?.wallet_address || tx.Account !== profile.wallet_address) return NextResponse.json({ error: "Transaction must be signed by your Proofly wallet." }, { status: 403 });
    const client = new Client(xrplUrl); await client.connect();
    try { const response = await client.submitAndWait(signedTransaction); return NextResponse.json({ hash: response.result.hash, validated: response.result.validated }); } finally { await client.disconnect(); }
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "XRPL submission failed" }, { status: 400 }); }
}
