import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Authentication required"},{status:401});const {data,error}=await supabase.rpc("confirm_booking_completion",{p_booking_id:id});if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({proof:data});}
