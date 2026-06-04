import Link from 'next/link';
import { Megaphone, MessageSquare } from 'lucide-react';

const cards = [
  { title: 'Inbox', body: 'One-on-one parent texting with family context.', href: '/inbox', icon: MessageSquare },
  { title: 'Broadcasts', body: 'Create, preview, schedule, and process mass texts.', href: '/broadcasts', icon: Megaphone }
];

export default function Home() {
  return (
    <main className="page-shell">
      <nav className="topbar">
        <div className="brand"><div className="logo-mark">T</div><span>TBY Texting</span></div>
        <div className="nav-pills">
          <Link className="nav-pill primary" href="/inbox">Inbox</Link>
          <Link className="nav-pill" href="/broadcasts">Broadcasts</Link>
        </div>
      </nav>

      <section className="hero-card">
        <p className="eyebrow">{process.env.NEXT_PUBLIC_SCHOOL_NAME || 'School'} communication center</p>
        <h1 className="hero-title">A simple texting system for one-on-one replies and school broadcasts.</h1>
        <p className="hero-copy">
          Inbox is for individual parent conversations. Broadcasts is for mass texts with audience selection, recipient preview, scheduling, and safe processing.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/inbox"><MessageSquare size={18} /> Open inbox</Link>
          <Link className="btn btn-secondary" href="/broadcasts"><Megaphone size={18} /> Open broadcasts</Link>
        </div>
      </section>

      <section className="feature-grid simple-feature-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href} className="feature-card">
              <div className="feature-icon"><Icon size={23} /></div>
              <h2>{card.title}</h2>
              <p>{card.body}</p>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
