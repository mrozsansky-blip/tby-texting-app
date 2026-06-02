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
    <main className="min-h-screen p-8">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {process.env.NEXT_PUBLIC_SCHOOL_NAME || 'School'} communication center
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">A texting app powered by Airtable, Textgrid, and AI.</h1>
          <p className="mt-4 max-w-3xl text-lg text-gray-600">
            Built for office staff: choose families or groups, let AI draft the message, review exact recipients, then confirm before sending.
          </p>
          <div className="mt-6 flex gap-3">
            <Link className="rounded-xl bg-gray-900 px-5 py-3 font-medium text-white" href="/inbox">Open inbox</Link>
            <Link className="rounded-xl border border-gray-200 bg-white px-5 py-3 font-medium" href="/groups">Manage groups</Link>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.title} href={card.href} className="rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md">
                <Icon className="h-6 w-6" />
                <h2 className="mt-4 font-semibold">{card.title}</h2>
                <p className="mt-2 text-sm text-gray-600">{card.body}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
