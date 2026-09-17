import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
  const {proofId,rating,body}=await request.json(); const {data,error}=await supabase.rpc("publish_verified_review",{p_proof_id:proofId,p_rating:Number(rating),p_body:body});
  if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({reviewId:data},{status:201});
}
