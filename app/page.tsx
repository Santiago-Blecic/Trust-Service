import Link from "next/link";

const providers = [
  ["David M.", "Mathematics Tutor", "4.9", "€25/hour", "127 verified services"],
  ["Laura K.", "Mathematics & Physics", "4.8", "€28/hour", "89 verified services"],
  ["Maya R.", "Home Cleaning", "4.9", "€22/hour", "64 verified services"]
];

export default function Home() {
  return <main className="shell"><nav className="nav"><Link className="brand" href="/">proof<i>ly</i></Link><Link className="button secondary" href="/auth">Sign in</Link></nav>
    <section className="hero"><div className="eyebrow">TRUSTED LOCAL SERVICES</div><h1>Find help you can actually trust.</h1><p className="lead">Book local services backed by reputation that is connected to completed, verified services.</p><form className="search" action="/providers"><input name="q" placeholder="What do you need help with?" aria-label="Search services"/><button className="button">Find a service</button></form></section>
    <section className="section"><h2>Popular providers</h2><div className="grid">{providers.map(([name, title, rating, price, count]) => <Link className="card" href={`/providers/${name === "David M." ? "david-m" : "coming-soon"}`} key={name}><div className="rating">★ {rating}</div><h3>{name}</h3><div className="muted">{title}</div><div className="verify">✓ {count}</div><div className="price">{price}</div></Link>)}</div></section>
  </main>;
}
