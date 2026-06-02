import Link from 'next/link';
import { MessageSquare, Users, ShieldCheck, Sparkles } from 'lucide-react';

const cards = [
  { title: 'Texting Inbox', body: 'Family conversations with school context.', href: '/inbox', icon: MessageSquare },
  { title: 'Groups', body: 'Bussing, class, grade, and smart groups.', href: '/groups', icon: Users },
  { title: 'Safe Sends', body: 'Preview recipients, deduplicate, then confirm.', href: '/inbox', icon: ShieldCheck },
  { title: 'AI Assistant', body: 'Compose messages and suggest recipient groups.', href: '/inbox', icon: Sparkles }
];

export default function Home() {
  return (
    <main className="page-shell">
      <nav className="topbar">
        <div className="brand"><div className="logo-mark">T</div><span>TBY Texting</span></div>
        <div className="nav-pills">
          <Link className="nav-pill primary" href="/inbox">Inbox</Link>
          <Link className="nav-pill" href="/groups">Groups</Link>
        </div>
      </nav>

      <section className="hero-card">
        <p className="eyebrow">{process.env.NEXT_PUBLIC_SCHOOL_NAME || 'School'} communication center</p>
        <h1 className="hero-title">A calm, safe texting command center for the school office.</h1>
        <p className="hero-copy">
          Staff can choose families or smart groups, let AI draft the message, review every recipient, and confirm before anything sends through Textgrid.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/inbox"><MessageSquare size={18} /> Open texting inbox</Link>
          <Link className="btn btn-secondary" href="/groups"><Users size={18} /> View groups</Link>
        </div>
      </section>

      <section className="feature-grid">
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
