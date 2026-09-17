import { NextResponse } from "next/server";
import { Client, Wallet, dropsToXrp } from "xrpl";
import { createClient } from "@/lib/supabase/server";

const xrplUrl = process.env.XRPL_WSS_URL || "wss://s.altnet.rippletest.net:51233";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { accountType } = await request.json();
  if (accountType !== "buyer" && accountType !== "provider") return NextResponse.json({ error: "Choose buyer or provider." }, { status: 400 });
  const { data: profile } = await supabase.from("profiles").select("wallet_address").eq("id", user.id).single();
  if (profile?.wallet_address) return NextResponse.json({ error: "This account already has a wallet." }, { status: 409 });
  const wallet = Wallet.generate();
  const client = new Client(xrplUrl);
  try {
    await client.connect();
    const funded = await client.fundWallet(wallet, {
      // Explicit values avoid faucet auto-discovery, which is unreliable in a
      // Cloudflare Worker WebSocket runtime.
      faucetHost: "faucet.altnet.rippletest.net",
      faucetPath: "/accounts",
      faucetProtocol: "https",
      usageContext: "proofly-testnet-wallet",
    });
    const { error } = await supabase.rpc("register_wallet", { p_address: wallet.classicAddress, p_account_type: accountType });
    if (error) throw error;
    return NextResponse.json({ address: wallet.classicAddress, seed: wallet.seed, balanceXrp: dropsToXrp(funded.balance) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Wallet creation failed" }, { status: 400 });
  } finally {
    if (client.isConnected()) await client.disconnect();
  }
}
