import { NextResponse } from "next/server";
import { Client, dropsToXrp } from "xrpl";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
  const {bookingId,transactionHash}=await request.json(); if(typeof bookingId!=="string"||typeof transactionHash!=="string"||!/^[A-Fa-f0-9]{64}$/.test(transactionHash))return NextResponse.json({error:"Invalid request"},{status:400});
  const {data:booking}=await supabase.from("bookings").select("id,customer_id,total_cents,status,provider:providers(wallet_address),customer:profiles!bookings_customer_id_fkey(wallet_address)").eq("id",bookingId).eq("customer_id",user.id).single();
  if(!booking||booking.status!=="awaiting_payment")return NextResponse.json({error:"Booking cannot be paid"},{status:409});
  const client=new Client(process.env.XRPL_WSS_URL||"wss://s.altnet.rippletest.net:51233");
  try { await client.connect(); const result=await client.request({command:"tx",transaction:transactionHash}); const tx=result.tx as {TransactionType?:string;Account?:string;Destination?:string;Amount?:string}; const provider=Array.isArray(booking.provider)?booking.provider[0]:booking.provider; const customer=Array.isArray(booking.customer)?booking.customer[0]:booking.customer;
    if(!result.validated||tx.TransactionType!=="Payment"||!customer?.wallet_address||tx.Account!==customer.wallet_address||tx.Destination!==provider?.wallet_address||typeof tx.Amount!=="string"||Math.round(Number(dropsToXrp(tx.Amount))*100)!==booking.total_cents) return NextResponse.json({error:"This validated XRP payment does not match the booking"},{status:422});
    const {error}=await supabase.rpc("record_verified_payment",{p_booking_id:bookingId,p_tx_hash:transactionHash,p_amount_drops:tx.Amount}); if(error)throw error; return NextResponse.json({verified:true});
  } catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Payment verification failed"},{status:400});} finally {await client.disconnect();}
}
