import { AppNav } from '@/components/AppNav';
import { CampaignAuditPanel } from '@/components/CampaignAuditPanel';

export default async function BroadcastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="app-screen">
      <AppNav active="broadcasts" />
      <CampaignAuditPanel campaignId={id} />
    </main>
  );
}
