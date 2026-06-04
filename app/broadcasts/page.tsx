import { BroadcastsShell } from '@/components/BroadcastsShell';
import { AppNav } from '@/components/AppNav';

export default function BroadcastsPage() {
  return (
    <main className="app-screen">
      <AppNav active="broadcasts" />
      <BroadcastsShell />
    </main>
  );
}
