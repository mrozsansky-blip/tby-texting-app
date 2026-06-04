'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock, Megaphone, Search, Send } from 'lucide-react';

type Recipient = {
  id: string;
  family: string;
  person: string;
  type: 'Mother cell' | 'Father cell';
  phone: string;
  checked: boolean;
};

const initialRecipients: Recipient[] = [
  { id: '1', family: 'Sample Family A', person: 'Parent A', type: 'Mother cell', phone: '***1234', checked: true },
  { id: '2', family: 'Sample Family A', person: 'Parent B', type: 'Father cell', phone: '***7788', checked: true },
  { id: '3', family: 'Sample Family B', person: 'Parent C', type: 'Mother cell', phone: '***4422', checked: true },
  { id: '4', family: 'Sample Family C', person: 'Parent D', type: 'Father cell', phone: '***8899', checked: true }
];

const broadcastRows = [
  { title: 'Grade 4 Forms Reminder', status: 'Draft', audience: 'Grade 4 families', count: 143, time: 'Created today' },
  { title: 'Bus 6 Delay Notice', status: 'Scheduled - provider not connected', audience: 'Bus 6', count: 42, time: 'Tomorrow 8:30 AM' },
  { title: 'All Families Notice', status: 'Processed - not sent', audience: 'All Families', count: 684, time: 'Yesterday' }
];

export function BroadcastsShell() {
  const [audience, setAudience] = useState('Grade 4 families');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('Reminder from Tiferes Bais Yaakov: forms are due tomorrow. Thank you.');
  const [sendMother, setSendMother] = useState(true);
  const [sendFather, setSendFather] = useState(true);
  const [recipients, setRecipients] = useState(initialRecipients);
  const selectedCount = recipients.filter((recipient) => recipient.checked).length;
  const characterCount = message.length;
  const smsParts = Math.max(1, Math.ceil(characterCount / 160));
  const autoTitle = useMemo(() => {
    const words = message.replace(/[^a-zA-Z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 4).join(' ');
    return `${audience || 'Broadcast'} - ${words || 'Message'} - Today`;
  }, [audience, message]);

  function setAll(checked: boolean) {
    setRecipients((current) => current.map((recipient) => ({ ...recipient, checked })));
  }

  function selectType(type: Recipient['type'] | 'both') {
    setRecipients((current) => current.map((recipient) => ({ ...recipient, checked: type === 'both' || recipient.type === type })));
  }

  function toggleRecipient(id: string) {
    setRecipients((current) => current.map((recipient) => recipient.id === id ? { ...recipient, checked: !recipient.checked } : recipient));
  }

  return (
    <div className="broadcast-frame">
      <aside className="broadcast-list-panel">
        <div className="broadcast-list-header">
          <div>
            <h1 className="inbox-title">Broadcasts</h1>
            <p className="helper-text">Drafts, scheduled, and past mass texts.</p>
          </div>
          <button className="btn btn-primary"><Megaphone size={16} /> New</button>
        </div>
        <div className="broadcast-tabs">
          <span className="tag">All</span>
          <span className="tag">Drafts</span>
          <span className="tag">Scheduled</span>
          <span className="tag">Past</span>
        </div>
        <div className="broadcast-search-wrap">
          <Search size={16} />
          <input className="inbox-search-input" placeholder="Search broadcasts..." />
        </div>
        <div className="broadcast-row-list">
          {broadcastRows.map((row) => (
            <div className="broadcast-row" key={row.title}>
              <div className="thread-row">
                <p className="thread-name">{row.title}</p>
                <span className="thread-time">{row.time}</span>
              </div>
              <p className="helper-text">{row.audience}</p>
              <div className="tags">
                <span className="tag">{row.status}</span>
                <span className="tag">{row.count} recipients</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="broadcast-workspace">
        <header className="chat-head">
          <div>
            <h2 className="chat-title">New Broadcast</h2>
            <p className="chat-subtitle">Visual workflow only: prepare, preview, schedule, or process without sending SMS.</p>
          </div>
          <div className="status-pill">Provider not connected</div>
        </header>

        <div className="broadcast-scroll">
          <section className="broadcast-step-card">
            <StepTitle number="1" title="Choose audience" />
            <div className="broadcast-search-wrap">
              <Search size={16} />
              <input className="inbox-search-input" placeholder="Search families, students, grades, buses..." />
            </div>
            <div className="choice-row broadcast-choice-row">
              {['All Families', 'Grade', 'Class', 'Bus', 'Manual List'].map((choice) => (
                <button className="choice-pill" key={choice} onClick={() => setAudience(choice === 'Grade' ? 'Grade 4 families' : choice)}>{choice}</button>
              ))}
            </div>
            <p className="helper-text">Selected audience: <strong>{audience}</strong></p>
          </section>

          <section className="broadcast-step-card">
            <StepTitle number="2" title="Choose SMS recipients" />
            <div className="choice-row">
              <label className="choice-pill"><input type="checkbox" checked={sendMother} onChange={(event) => setSendMother(event.target.checked)} /> Mother cell</label>
              <label className="choice-pill"><input type="checkbox" checked={sendFather} onChange={(event) => setSendFather(event.target.checked)} /> Father cell</label>
            </div>
            <p className="helper-text">Home phones are voice-only and are not used for SMS.</p>
          </section>

          <section className="broadcast-step-card">
            <StepTitle number="3" title="Write message" />
            <label className="helper-text" htmlFor="broadcast-title">Broadcast title, optional</label>
            <input id="broadcast-title" className="search-input broadcast-title-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={autoTitle} />
            <textarea className="compose-box broadcast-message-box" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Type your broadcast message..." />
            <p className="helper-text">Characters: {characterCount} • Estimated SMS parts: {smsParts}</p>
          </section>

          <section className="broadcast-step-card">
            <StepTitle number="4" title="Preview recipients" />
            <div className="preview-stat-grid">
              <PreviewStat label="Families found" value={82} />
              <PreviewStat label="Eligible recipients" value={recipients.length} />
              <PreviewStat label="Selected to send" value={selectedCount} />
              <PreviewStat label="Skipped" value={17} />
            </div>
            <div className="recipient-toolbar">
              <button className="btn btn-secondary" onClick={() => setAll(true)}>Check all</button>
              <button className="btn btn-secondary" onClick={() => setAll(false)}>Deselect all</button>
              <button className="btn btn-secondary" onClick={() => selectType('Mother cell')}>Select mother cells</button>
              <button className="btn btn-secondary" onClick={() => selectType('Father cell')}>Select father cells</button>
              <button className="btn btn-secondary" onClick={() => selectType('both')}>Select both</button>
            </div>
            <div className="recipient-checklist">
              {recipients.map((recipient) => (
                <label className="recipient-check-row" key={recipient.id}>
                  <input type="checkbox" checked={recipient.checked} onChange={() => toggleRecipient(recipient.id)} />
                  <span>{recipient.family} - {recipient.person}</span>
                  <strong>{recipient.type}</strong>
                  <span>{recipient.phone}</span>
                </label>
              ))}
            </div>
            <div className="preview-notes">
              <p className="helper-text">Skipped examples: missing father cell, SMS not allowed, Do Not Contact, invalid number, duplicate phone removed.</p>
            </div>
          </section>

          <section className="broadcast-step-card">
            <StepTitle number="5" title="Actions" />
            <div className="broadcast-actions">
              <button className="btn btn-secondary"><CheckCircle2 size={16} /> Save Draft</button>
              <button className="btn btn-secondary"><CalendarClock size={16} /> Schedule</button>
              <button className="btn btn-primary"><Send size={16} /> Send Now</button>
            </div>
            <p className="helper-text">Until TextGrid is connected, Send Now will visually process the broadcast but mark recipients as not sent.</p>
          </section>
        </div>
      </section>
    </div>
  );
}

function StepTitle({ number, title }: { number: string; title: string }) {
  return <h3 className="broadcast-step-title"><span>{number}</span>{title}</h3>;
}

function PreviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="preview-stat">
      <div className="info-label">{label}</div>
      <div className="info-value">{value}</div>
    </div>
  );
}
