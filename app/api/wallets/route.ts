import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const testnetFaucetUrl = "https://faucet.altnet.rippletest.net/accounts";

export async function POST(request: Request) {
  let stage = "initialize Supabase";
  try {
    const supabase = await createClient();
    stage = "verify your Proofly session";
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    stage = "read the wallet request";
    const { accountType, address } = await request.json() as { accountType?: string; address?: string };
    if (accountType !== "buyer" && accountType !== "provider") return NextResponse.json({ error: "Choose buyer or provider." }, { status: 400 });
    if (typeof address !== "string" || !/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address)) return NextResponse.json({ error: "The generated XRP wallet address is invalid." }, { status: 400 });
    stage = "check whether this account already has a wallet";
    const { data: profile, error: profileError } = await supabase.from("profiles").select("wallet_address").eq("id", user.id).single();
    if (profileError) throw profileError;
    if (profile?.wallet_address) return NextResponse.json({ error: "This account already has a wallet." }, { status: 409 });
    stage = "fund the new XRPL Testnet wallet";
    // Calling the official HTTPS faucet directly avoids the Node/WebSocket
    // internals in xrpl.js that are incompatible with Cloudflare Workers.
    const faucetResponse = await fetch(testnetFaucetUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ destination: address, usageContext: "proofly-testnet-wallet" }),
    });
    const funded = await faucetResponse.json() as { account?: { classicAddress?: string; address?: string }; balance?: string | number; error?: string };
    if (!faucetResponse.ok) throw new Error(funded.error || `The XRP Testnet faucet returned HTTP ${faucetResponse.status}.`);
    const fundedAddress = funded.account?.classicAddress || funded.account?.address;
    if (fundedAddress !== address) throw new Error("The XRP Testnet faucet returned a different wallet address.");
    stage = "save the wallet address in Supabase";
    const { error } = await supabase.rpc("register_wallet", { p_address: address, p_account_type: accountType });
    if (error) throw error;
    return NextResponse.json({ address, balanceXrp: String(funded.balance ?? "0") }, { status: 201 });
  } catch (error) {
    console.error("Proofly wallet creation failed", { stage, message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: `Could not ${stage}: ${error instanceof Error ? error.message : "Unknown error"}` }, { status: 400 });
  }
}
