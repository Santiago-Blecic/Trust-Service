import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Authentication required"},{status:401});
  const body=await request.json(); const hours=Number(body.hours);
  if(!Number.isInteger(hours)||hours<1||hours>8||!body.scheduled_for||Number.isNaN(Date.parse(body.scheduled_for))||Date.parse(body.scheduled_for)<Date.now()) return NextResponse.json({error:"Invalid booking details"},{status:400});
  const {data:service,error:serviceError}=await supabase.from("services").select("id").eq("slug","mathematics-tutoring-david").eq("is_active",true).single();
  if(serviceError||!service) return NextResponse.json({error:"Service unavailable"},{status:404});
  const {data:booking,error}=await supabase.rpc("create_booking",{p_service_id:service.id,p_scheduled_for:body.scheduled_for,p_hours:hours});
  if(error) return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({booking},{status:201});
}
