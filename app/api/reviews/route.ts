import { NextResponse } from "next/server";
import { Client } from "xrpl";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
  const {proofId,rating,body,blockchainMintTransactionHash}=await request.json();
  if(typeof proofId!=="string"||typeof blockchainMintTransactionHash!=="string"||!/^[A-Fa-f0-9]{64}$/.test(blockchainMintTransactionHash)) return NextResponse.json({error:"A validated rating-token transaction is required"},{status:400});
  const {data:profile}=await supabase.from("profiles").select("wallet_address").eq("id",user.id).single();
  const client=new Client(process.env.XRPL_WSS_URL||"wss://s.altnet.rippletest.net:51233");
  try { await client.connect(); const response=await client.request({command:"tx",transaction:blockchainMintTransactionHash}); const tx=response.result.tx_json;
    if(!response.result.validated||tx.TransactionType!=="NFTokenMint"||tx.Account!==profile?.wallet_address||typeof tx.URI!=="string") return NextResponse.json({error:"The rating token is not a validated Proofly wallet transaction"},{status:422});
    const marker=JSON.parse(Buffer.from(tx.URI,"hex").toString("utf8")) as {proofId?:string;rating?:number}; if(marker.proofId!==proofId||marker.rating!==Number(rating)) return NextResponse.json({error:"The token does not match this rating"},{status:422});
  } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"Rating token verification failed"},{status:400}); } finally { await client.disconnect(); }
  const {data,error}=await supabase.rpc("publish_verified_review",{p_proof_id:proofId,p_rating:Number(rating),p_body:body,p_blockchain_mint_transaction_hash:blockchainMintTransactionHash});
  if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({reviewId:data},{status:201});
}
