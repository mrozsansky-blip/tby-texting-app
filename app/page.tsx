import Link from 'next/link';
import { MessageSquare, Users, ShieldCheck, Sparkles } from 'lucide-react';

const cards = [
  { title: 'Texting Inbox', body: 'Family conversations with school context.', href: '/inbox', icon: MessageSquare },
  { title: 'Groups', body: 'Bussing, class, grade, and smart groups.', href: '/groups', icon: Users },
  { title: 'Safe Sends', body: 'Preview recipients, deduplicate, then confirm.', href: '/inbox', icon: ShieldCheck },
  { title: 'AI Assistant', body: 'Compose messages and suggest recipient groups.', href: '/inbox', icon: Sparkles }
];

const page = { minHeight: '100vh', padding: 32, background: 'linear-gradient(135deg, #eef6ff 0%, #f8fafc 45%, #ffffff 100%)', fontFamily: 'Arial, Helvetica, sans-serif', color: '#0f172a' } as React.CSSProperties;
const wrap = { maxWidth: 1120, margin: '0 auto' } as React.CSSProperties;
const hero = { borderRadius: 30, background: '#ffffff', padding: 34, boxShadow: '0 18px 60px rgba(15, 23, 42, 0.10)', border: '1px solid #e5e7eb' } as React.CSSProperties;
const button = { display: 'inline-block', borderRadius: 14, padding: '12px 18px', background: '#0f172a', color: '#ffffff', fontWeight: 800, textDecoration: 'none' } as React.CSSProperties;
const outline = { ...button, background: '#ffffff', color: '#0f172a', border: '1px solid #dbe3ee' } as React.CSSProperties;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginTop: 18 } as React.CSSProperties;
const cardStyle = { borderRadius: 22, background: '#ffffff', padding: 22, boxShadow: '0 10px 28px rgba(15, 23, 42, 0.06)', border: '1px solid #e5e7eb', textDecoration: 'none', color: '#0f172a' } as React.CSSProperties;

export default function Home() {
  return (
    <main style={page}>
      <section style={wrap}>
        <div style={hero}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: 1.2, color: '#64748b', textTransform: 'uppercase' }}>
            {process.env.NEXT_PUBLIC_SCHOOL_NAME || 'School'} communication center
          </p>
          <h1 style={{ margin: '14px 0 0', maxWidth: 820, fontSize: 44, lineHeight: 1.05, letterSpacing: -1.2 }}>A texting app powered by Airtable, Textgrid, and AI.</h1>
          <p style={{ margin: '18px 0 0', maxWidth: 760, fontSize: 18, lineHeight: 1.6, color: '#475569' }}>
            Built for office staff: choose families or groups, let AI draft the message, review exact recipients, then confirm before sending.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <Link style={button} href="/inbox">Open inbox</Link>
            <Link style={outline} href="/groups">Manage groups</Link>
          </div>
        </div>
        <div style={grid}>
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.title} href={card.href} style={cardStyle}>
                <Icon size={26} />
                <h2 style={{ margin: '16px 0 0', fontSize: 17 }}>{card.title}</h2>
                <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.45 }}>{card.body}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
