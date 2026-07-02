'use client';

import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Search } from 'lucide-react';

type RecipientStatus = 'sent' | 'delivered' | 'queued' | 'pending' | 'failed' | 'failed_fetch' | 'textgrid_http_400' | 'other';

type Recipient = {
  id: string;
  familyName: string;
  to: string;
  body: string;
  status: string;
  normalizedStatus: RecipientStatus;
  providerMessageId: string;
  providerStatus: string;
  errorMessage: string;
  rawProviderError: string;
  lastAttemptAt: string;
};

type Audit = {
  campaign: { id: string; name: string; body: string; status: string };
  counts: {
    totalRecipients: number;
    sent: number;
    delivered: number;
    queuedPending: number;
    failed: number;
    failedFetch: number;
    textgridHttp400Failures: number;
  };
  recipients: Recipient[];
};

const filters = [
  ['all', 'All statuses'],
  ['sent', 'Sent'],
  ['delivered', 'Delivered'],
  ['queued', 'Queued / pending'],
  ['failed', 'Failed'],
  ['failed_fetch', 'Failed fetch'],
  ['textgrid_http_400', 'TextGrid HTTP 400']
] as const;

function maskPhone(phone: string) {
  return phone.length > 4 ? `***${phone.slice(-4)}` : phone;
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

export function CampaignAuditPanel({ campaignId }: { campaignId: string }) {
  const [audit, setAudit] = useState<Audit | null>(null);
  const [statusFilter, setStatusFilter] = useState<(typeof filters)[number][0]>('all');
  const [search, setSearch] = useState('');
  const [banner, setBanner] = useState('Loading campaign status audit...');
  const [isRetrying, setIsRetrying] = useState(false);

  async function loadAudit() {
    const response = await fetch(`/api/broadcasts/${campaignId}/audit`);
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.details || data.error || 'Audit failed.');
    setAudit(data as Audit);
    setBanner('Campaign audit loaded. Nothing is resent automatically.');
  }

  useEffect(() => {
    void loadAudit().catch((error) => setBanner(`Could not load campaign audit: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }, [campaignId]);

  const filteredRecipients = useMemo(() => {
    if (!audit) return [];
    const query = search.toLowerCase();
    return audit.recipients.filter((recipient) => {
      const matchesStatus = statusFilter === 'all'
        || recipient.normalizedStatus === statusFilter
        || (statusFilter === 'queued' && recipient.normalizedStatus === 'pending');
      const matchesSearch = [recipient.familyName, recipient.to, recipient.status, recipient.providerStatus, recipient.errorMessage].join(' ').toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [audit, search, statusFilter]);

  async function retryFailedOnly() {
    if (!audit || audit.counts.failed === 0) return;
    setIsRetrying(true);
    setBanner(`Retrying ${audit.counts.failed} failed recipients only at concurrency 5. Sent, delivered, queued, and pending rows are skipped.`);
    try {
      const response = await fetch(`/api/broadcasts/${campaignId}/retry-failed`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.details || data.error || 'Retry failed.');
      setBanner(`Retry complete: ${data.retried} failed rows retried; ${data.skippedNonFailed} non-failed rows skipped.`);
      await loadAudit();
    } catch (error) {
      setBanner(`Retry failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <section className="broadcast-workspace audit-workspace">
      <header className="chat-head">
        <div>
          <h1 className="chat-title">{audit?.campaign.name || 'Campaign status audit'}</h1>
          <p className="chat-subtitle">Recipient-level TextGrid audit and failed-only retry workflow.</p>
        </div>
        <button className="btn btn-primary" onClick={() => void retryFailedOnly()} disabled={!audit || audit.counts.failed === 0 || isRetrying}>
          <RotateCcw size={16} /> {isRetrying ? 'Retrying failed...' : 'Retry failed only'}
        </button>
      </header>
      <div className="broadcast-scroll">
        <div className="broadcast-status-banner">{banner}</div>
        <div className="preview-stat-grid audit-stat-grid">
          <AuditStat label="Total recipients" value={audit?.counts.totalRecipients || 0} />
          <AuditStat label="Sent" value={audit?.counts.sent || 0} />
          <AuditStat label="Delivered" value={audit?.counts.delivered || 0} />
          <AuditStat label="Queued / pending" value={audit?.counts.queuedPending || 0} />
          <AuditStat label="Failed" value={audit?.counts.failed || 0} />
          <AuditStat label="Failed fetch" value={audit?.counts.failedFetch || 0} />
          <AuditStat label="TextGrid HTTP 400" value={audit?.counts.textgridHttp400Failures || 0} />
        </div>
        <section className="broadcast-step-card">
          <div className="recipient-toolbar">
            {filters.map(([value, label]) => <button className={`tag tab-button ${statusFilter === value ? 'active-tab' : ''}`} key={value} onClick={() => setStatusFilter(value)}>{label}</button>)}
          </div>
          <div className="broadcast-search-wrap">
            <Search size={16} />
            <input className="inbox-search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search recipient audit rows..." />
          </div>
          <div className="recipient-checklist">
            {filteredRecipients.length === 0 ? <p className="helper-text empty-preview-text">No recipient rows match this filter.</p> : null}
            {filteredRecipients.map((recipient) => (
              <div className="recipient-check-row audit-recipient-row" key={recipient.id}>
                <span>{recipient.familyName || 'Recipient'}</span>
                <strong>{statusLabel(recipient.normalizedStatus)}</strong>
                <span>{maskPhone(recipient.to)}</span>
                <span>{recipient.providerMessageId || 'no provider id'}</span>
                <span>{recipient.providerStatus || recipient.status || 'no provider status'}</span>
                <span>{recipient.errorMessage || 'no error'}</span>
                <span>{recipient.lastAttemptAt || 'no attempt timestamp'}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function AuditStat({ label, value }: { label: string; value: number }) {
  return <div className="preview-stat"><div className="info-label">{label}</div><div className="info-value">{value}</div></div>;
}
