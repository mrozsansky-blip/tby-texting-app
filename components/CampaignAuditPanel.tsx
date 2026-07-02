'use client';

import { useEffect, useMemo, useState } from 'react';
import { Play, RotateCcw, Search } from 'lucide-react';

type RecipientStatus = 'delivered' | 'failed' | 'failed_fetch' | 'textgrid_http_400' | 'undelivered' | 'queued' | 'pending' | 'sent' | 'ready_to_send' | 'not_attempted' | 'other';

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
    undelivered: number;
    reachedTextgrid: number;
    notAttempted: number;
  };
  recipients: Recipient[];
};

const filters = [
  ['all', 'All statuses'],
  ['sent', 'Reached TextGrid / Sent'],
  ['delivered', 'Delivered'],
  ['queued', 'Queued / pending'],
  ['failed', 'Failed'],
  ['failed_fetch', 'Failed fetch'],
  ['textgrid_http_400', 'TextGrid HTTP 400'],
  ['undelivered', 'Undelivered'],
  ['not_attempted', 'Not attempted']
] as const;


const terminalOrAttemptedStatuses = new Set<RecipientStatus>(['sent', 'delivered', 'queued', 'pending', 'failed', 'failed_fetch', 'textgrid_http_400', 'undelivered']);
const terminalOrAttemptedStatusText = /\b(sent|delivered|queued|pending|failed|failed fetch|undelivered)\b|http\s*400/i;

function isNeverAttemptedSendable(recipient: Recipient) {
  if (terminalOrAttemptedStatuses.has(recipient.normalizedStatus)) return false;
  if (recipient.providerMessageId || recipient.providerStatus || recipient.lastAttemptAt) return false;
  if (terminalOrAttemptedStatusText.test(recipient.status)) return false;
  return recipient.normalizedStatus === 'not_attempted' || recipient.normalizedStatus === 'ready_to_send';
}

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
  const [isSendingNotAttempted, setIsSendingNotAttempted] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('Never');

  async function loadAudit() {
    const response = await fetch(`/api/broadcasts/${campaignId}/audit`);
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.details || data.error || 'Audit failed.');
    setAudit(data as Audit);
    setLastUpdated(new Date().toLocaleTimeString());
    setBanner('Campaign audit loaded. Nothing is resent automatically.');
  }

  useEffect(() => {
    void loadAudit().catch((error) => setBanner(`Could not load campaign audit: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }, [campaignId]);

  useEffect(() => {
    if (isRetrying || isSendingNotAttempted) return;
    const hasActiveRows = Boolean(audit && audit.counts.queuedPending > 0);
    const intervalMs = hasActiveRows ? 10000 : 30000;
    const timer = window.setTimeout(() => {
      void loadAudit().catch((error) => setBanner(`Could not refresh campaign audit: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }, intervalMs);
    return () => window.clearTimeout(timer);
  }, [audit?.counts.queuedPending, campaignId, isRetrying, isSendingNotAttempted]);

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

  const sendableNotAttemptedCount = useMemo(() => audit ? audit.recipients.filter(isNeverAttemptedSendable).length : 0, [audit]);

  async function sendNotAttemptedOnly() {
    if (!audit || sendableNotAttemptedCount === 0) return;
    if (!window.confirm(`Send ${sendableNotAttemptedCount} never-attempted recipients only? Queued, pending, sent, delivered, and failed rows will be skipped.`)) return;
    setIsSendingNotAttempted(true);
    setBanner(`Sending ${sendableNotAttemptedCount} never-attempted recipients only at concurrency 5. Attempted and terminal rows are skipped.`);
    try {
      const response = await fetch(`/api/broadcasts/${campaignId}/send`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.details || data.error || 'Send failed.');
      setBanner(`Send complete: ${data.attempted} never-attempted rows processed; ${data.skippedAttemptedOrTerminalRows} attempted or terminal rows skipped.`);
      await loadAudit();
    } catch (error) {
      setBanner(`Send failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSendingNotAttempted(false);
    }
  }

  async function retryFailedOnly() {
    if (!audit || audit.counts.failed === 0) return;
    if (!window.confirm(`Retry ${audit.counts.failed} failed recipients only?`)) return;
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
        <div className="broadcast-actions">
          <button className="btn btn-secondary" onClick={() => void sendNotAttemptedOnly()} disabled={!audit || sendableNotAttemptedCount === 0 || isRetrying || isSendingNotAttempted}>
            <Play size={16} /> {isSendingNotAttempted ? 'Sending...' : 'Send not attempted only'}
          </button>
          <button className="btn btn-primary" onClick={() => void retryFailedOnly()} disabled={!audit || audit.counts.failed === 0 || isRetrying || isSendingNotAttempted}>
            <RotateCcw size={16} /> {isRetrying ? 'Retrying failed...' : 'Retry failed only'}
          </button>
        </div>
      </header>
      <div className="broadcast-scroll">
        <div className="broadcast-status-banner">{banner} Last updated: {lastUpdated}.</div>
        <BroadcastProgress audit={audit} />
        <div className="preview-stat-grid audit-stat-grid">
          <AuditStat label="Total recipients" value={audit?.counts.totalRecipients || 0} />
          <AuditStat label="Sent" value={audit?.counts.sent || 0} />
          <AuditStat label="Delivered" value={audit?.counts.delivered || 0} />
          <AuditStat label="Queued / pending" value={audit?.counts.queuedPending || 0} />
          <AuditStat label="Failed" value={audit?.counts.failed || 0} />
          <AuditStat label="Failed fetch" value={audit?.counts.failedFetch || 0} />
          <AuditStat label="TextGrid HTTP 400" value={audit?.counts.textgridHttp400Failures || 0} />
          <AuditStat label="Not attempted" value={audit?.counts.notAttempted || 0} />
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

function BroadcastProgress({ audit }: { audit: Audit | null }) {
  const total = audit?.counts.totalRecipients || 0;
  const reached = audit?.counts.reachedTextgrid || 0;
  const percent = total > 0 ? Math.round((reached / total) * 100) : 0;

  return (
    <section className="broadcast-step-card audit-progress-card">
      <div className="thread-row">
        <div>
          <p className="card-title">Broadcast progress</p>
          <p className="helper-text">{reached} of {total} accepted by TextGrid</p>
        </div>
        <strong>{percent}%</strong>
      </div>
      <div className="audit-progress-track"><div className="audit-progress-fill" style={{ width: `${percent}%` }} /></div>
      <p className="helper-text">Reached TextGrid = accepted by TextGrid · Queued / pending = accepted by TextGrid but not final · Delivered = final delivered · Failed = failed/undelivered/http errors · Not attempted = never tried</p>
      <p className="helper-text">{audit?.counts.delivered || 0} delivered · {audit?.counts.queuedPending || 0} queued/pending · {audit?.counts.failed || 0} failed · {audit?.counts.notAttempted || 0} not attempted</p>
    </section>
  );
}

function AuditStat({ label, value }: { label: string; value: number }) {
  return <div className="preview-stat"><div className="info-label">{label}</div><div className="info-value">{value}</div></div>;
}
