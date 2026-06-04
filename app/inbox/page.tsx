import { ConversationShell } from '@/components/ConversationShell';
import { AppNav } from '@/components/AppNav';

export default function InboxPage() {
  return (
    <main className="app-screen">
      <AppNav active="inbox" />
      <ConversationShell />
    </main>
  );
}
