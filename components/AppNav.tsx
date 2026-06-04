import Link from 'next/link';
import { Megaphone, MessageSquare } from 'lucide-react';

type AppNavProps = {
  active?: 'inbox' | 'broadcasts';
};

export function AppNav({ active }: AppNavProps) {
  return (
    <nav className="topbar app-nav" aria-label="Main navigation">
      <Link className="brand" href="/inbox" aria-label="TBY Texting inbox">
        <div className="logo-mark">T</div>
        <span>TBY Texting</span>
      </Link>
      <div className="nav-pills">
        <Link className={`nav-pill ${active === 'inbox' ? 'primary' : ''}`} href="/inbox">
          <MessageSquare size={16} /> Inbox
        </Link>
        <Link className={`nav-pill ${active === 'broadcasts' ? 'primary' : ''}`} href="/broadcasts">
          <Megaphone size={16} /> Broadcasts
        </Link>
      </div>
    </nav>
  );
}
