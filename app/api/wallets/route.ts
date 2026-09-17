import { NextResponse } from "next/server";
import { Wallet } from "xrpl";
import { createClient } from "@/lib/supabase/server";

const testnetFaucetUrl = "https://faucet.altnet.rippletest.net/accounts";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { accountType } = await request.json();
  if (accountType !== "buyer" && accountType !== "provider") return NextResponse.json({ error: "Choose buyer or provider." }, { status: 400 });
  const { data: profile } = await supabase.from("profiles").select("wallet_address").eq("id", user.id).single();
  if (profile?.wallet_address) return NextResponse.json({ error: "This account already has a wallet." }, { status: 409 });
  const wallet = Wallet.generate();
  let stage = "fund the new XRPL Testnet wallet";
  try {
    // Calling the official HTTPS faucet directly avoids the Node/WebSocket
    // internals in xrpl.js that are incompatible with Cloudflare Workers.
    const faucetResponse = await fetch(testnetFaucetUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ destination: wallet.classicAddress, usageContext: "proofly-testnet-wallet" }),
    });
    const funded = await faucetResponse.json() as { account?: { classicAddress?: string; address?: string }; balance?: string | number; error?: string };
    if (!faucetResponse.ok) throw new Error(funded.error || `The XRP Testnet faucet returned HTTP ${faucetResponse.status}.`);
    const fundedAddress = funded.account?.classicAddress || funded.account?.address;
    if (fundedAddress !== wallet.classicAddress) throw new Error("The XRP Testnet faucet returned a different wallet address.");
    stage = "save the wallet address in Supabase";
    const { error } = await supabase.rpc("register_wallet", { p_address: wallet.classicAddress, p_account_type: accountType });
    if (error) throw error;
    return NextResponse.json({ address: wallet.classicAddress, seed: wallet.seed, balanceXrp: String(funded.balance ?? "0") }, { status: 201 });
  } catch (error) {
    console.error("Proofly wallet creation failed", { stage, message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: `Could not ${stage}: ${error instanceof Error ? error.message : "Unknown error"}` }, { status: 400 });
  }
}
