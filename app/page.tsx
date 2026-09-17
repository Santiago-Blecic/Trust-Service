import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: services } = await supabase.from("services").select("slug,title,category,price_cents,provider:providers!inner(id,verification_status,profile:profiles(display_name))").eq("is_active", true).eq("provider.verification_status", "approved").limit(12);
  return <main className="shell"><nav className="nav"><Link className="brand" href="/">proof<i>ly</i></Link><Link className="button secondary" href="/auth">Sign in</Link></nav>
    <section className="hero"><div className="eyebrow">XRPL-VERIFIED LOCAL SERVICES</div><h1>Find help you can actually trust.</h1><p className="lead">Only manually approved provider accounts appear here. Each review is tied to a completed XRP Testnet payment and a public XRPL rating token.</p><Link className="button" href="/offer">Offer a service</Link></section>
    <section className="section"><h2>Verified providers</h2><div className="grid">{services?.length ? services.map((service) => { const provider = Array.isArray(service.provider) ? service.provider[0] : service.provider; const profile = Array.isArray(provider?.profile) ? provider?.profile[0] : provider?.profile; return <Link className="card" href={`/providers/${service.slug}`} key={service.slug}><div className="rating">XRPL verified</div><h3>{profile?.display_name || "Verified provider"}</h3><div className="muted">{service.title}</div><div className="verify">✓ Identity review approved</div><div className="price">€{(service.price_cents / 100).toFixed(2)}/hour</div></Link>; }) : <p className="notice">No providers are published yet. Proofly does not show demo or unverified accounts.</p>}</div></section>
  </main>;
}
