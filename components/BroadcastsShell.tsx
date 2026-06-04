'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Megaphone, Search, Send } from 'lucide-react';

type Recipient = {
  id: string;
  family: string;
  person: string;
  type: 'Mother cell' | 'Father cell';
  phone: string;
  checked: boolean;
};

type BroadcastStatus = 'All' | 'Drafts' | 'Scheduled' | 'Past';

const initialRecipients: Recipient[] = [
  { id: '1', family: 'Sample Family A', person: 'Parent A', type: 'Mother cell', phone: '***1234', checked: true },
  { id: '2', family: 'Sample Family A', person: 'Parent B', type: 'Father cell', phone: '***7788', checked: true },
  { id: '3', family: 'Sample Family B', person: 'Parent C', type: 'Mother cell', phone: '***4422', checked: true },
  { id: '4', family: 'Sample Family C', person: 'Parent D', type: 'Father cell', phone: '***8899', checked: true }
];

const broadcastRows = [
  { title: 'Grade 4 Forms Reminder', status: 'Draft', tab: 'Drafts', audience: 'Grade 4 families', count: 143, time: 'Created today' },
  { title: 'Bus 6 Delay Notice', status: 'Scheduled - provider not connected', tab: 'Scheduled', audience: 'Bus 6', count: 42, time: 'Tomorrow 8:30 AM' },
  { title: 'All Families Notice', status: 'Processed - not sent', tab: 'Past', audience: 'All Families', count: 684, time: 'Yesterday' }
];

export function BroadcastsShell() {
  const [audience, setAudience] = useState('Grade 4 families');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('Reminder from Tiferes Bais Yaakov: forms are due tomorrow. Thank you.');
  const [sendMother, setSendMother] = useState(true);
  const [sendFather, setSendFather] = useState(true);
  const [recipients, setRecipients] = useState(initialRecipients);
  const [activeTab, setActiveTab] = useState<BroadcastStatus>('All');
  const [broadcastSearch, setBroadcastSearch] = useState('');
  const [audienceSearch, setAudienceSearch] = useState('');
  const [visualStatus, setVisualStatus] = useState('Ready to create a visual broadcast workflow. No SMS will be sent.');
  const [showSchedulePanel, setShowSchedulePanel] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');

  const selectedCount = recipients.filter((recipient) => recipient.checked).length;
  const characterCount = message.length;
  const smsParts = Math.max(1, Math.ceil(characterCount / 160));
  const displayedRows = broadcastRows.filter((row) => {
    const matchesTab = activeTab === 'All' || row.tab === activeTab;
    const searchText = [row.title, row.status, row.audience, row.time].join(' ').toLowerCase();
    return matchesTab && searchText.includes(broadcastSearch.toLowerCase());
  });
  const autoTitle = useMemo(() => {
    const words = message.replace(/[^a-zA-Z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 4).join(' ');
    return `${audience || 'Broadcast'} - ${words || 'Message'} - Today`;
  }, [audience, message]);

  function setAll(checked: boolean) {
    setRecipients((current) => current.map((recipient) => ({ ...recipient, checked })));
    setVisualStatus(checked ? 'All eligible recipients are selected.' : 'All recipients are deselected. Select at least one before sending.');
  }

  function selectType(type: Recipient['type'] | 'both') {
    setRecipients((current) => current.map((recipient) => ({ ...recipient, checked: type === 'both' || recipient.type === type })));
    setVisualStatus(type === 'both' ? 'Mother and father cells are selected.' : `${type} recipients are selected.`);
  }

  function toggleRecipient(id: string) {
    setRecipients((current) => current.map((recipient) => recipient.id === id ? { ...recipient, checked: !recipient.checked } : recipient));
    setVisualStatus('Recipient checklist updated. Only checked recipients will be used.');
  }

  function startNewBroadcast() {
    setAudience('Grade 4 families');
    setTitle('');
    setMessage('');
    setSendMother(true);
    setSendFather(true);
    setRecipients(initialRecipients);
    setShowSchedulePanel(false);
    setVisualStatus('New visual broadcast started. Choose an audience, write a message, then preview recipients.');
  }

  function chooseAudience(choice: string) {
    const audienceLabel = choice === 'Grade' ? 'Grade 4 families' : choice === 'Class' ? 'Class 4A families' : choice === 'Bus' ? 'Bus 6 families' : choice;
    setAudience(audienceLabel);
    setVisualStatus(`Audience set to ${audienceLabel}.`);
  }

  function useAudienceSearch() {
    if (!audienceSearch.trim()) {
      setVisualStatus('Type an audience search first, such as Grade 4, Bus 6, or a family name.');
      return;
    }
    setAudience(audienceSearch.trim());
    setVisualStatus(`Audience search selected: ${audienceSearch.trim()}.`);
  }

  function saveDraft() {
    setVisualStatus(`Draft saved visually as "${title || autoTitle}". No SMS was sent.`);
  }

  function scheduleBroadcast() {
    setShowSchedulePanel(true);
    setVisualStatus('Choose a date and time, then save the schedule.');
  }

  function saveSchedule() {
    if (!scheduledDate || !scheduledTime) {
      setVisualStatus('Choose both a schedule date and time.');
      return;
    }
    setShowSchedulePanel(false);
    setVisualStatus(`Broadcast scheduled visually for ${scheduledDate} at ${scheduledTime}. Provider not connected, so no SMS will send yet.`);
  }

  function sendNow() {
    if (!message.trim()) {
      setVisualStatus('Write a message before sending.');
      return;
    }
    if (selectedCount === 0) {
      setVisualStatus('No recipients selected. Check at least one recipient before sending.');
      return;
    }
    setVisualStatus(`Broadcast processed visually for ${selectedCount} selected recipients. Status: not sent - provider not connected.`);
  }

  return (
    <div className="broadcast-frame">
      <aside className="broadcast-list-panel">
        <div className="broadcast-list-header">
          <div>
            <h1 className="inbox-title">Broadcasts</h1>
            <p className="helper-text">Drafts, scheduled, and past mass texts.</p>
          </div>
          <button className="btn btn-primary" onClick={startNewBroadcast}><Megaphone size={16} /> New</button>
        </div>
        <div className="broadcast-tabs">
          {(['All', 'Drafts', 'Scheduled', 'Past'] as BroadcastStatus[]).map((tab) => (
            <button className={`tag tab-button ${activeTab === tab ? 'active-tab' : ''}`} key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>
          ))}
        </div>
        <div className="broadcast-search-wrap">
          <Search size={16} />
          <input className="inbox-search-input" value={broadcastSearch} onChange={(event) => setBroadcastSearch(event.target.value)} placeholder="Search broadcasts..." />
        </div>
        <div className="broadcast-row-list">
          {displayedRows.map((row) => (
            <button className="broadcast-row" key={row.title} onClick={() => setVisualStatus(`Opened ${row.title} visually. Detail pages will be connected later.`)}>
              <div className="thread-row">
                <p className="thread-name">{row.title}</p>
                <span className="thread-time">{row.time}</span>
              </div>
              <p className="helper-text">{row.audience}</p>
              <div className="tags">
                <span className="tag">{row.status}</span>
                <span className="tag">{row.count} recipients</span>
              </div>
            </button>
          ))}
          {displayedRows.length === 0 ? <p className="helper-text">No visual broadcasts match this filter.</p> : null}
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
          <div className="broadcast-status-banner">{visualStatus}</div>

          <section className="broadcast-step-card">
            <StepTitle number="1" title="Choose audience" />
            <div className="broadcast-search-wrap">
              <Search size={16} />
              <input
                className="inbox-search-input"
                value={audienceSearch}
                onChange={(event) => setAudienceSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') useAudienceSearch();
                }}
                placeholder="Search families, students, grades, buses..."
              />
              <button className="mini-action-button" onClick={useAudienceSearch}>Use</button>
            </div>
            <div className="choice-row broadcast-choice-row">
              {['All Families', 'Grade', 'Class', 'Bus', 'Manual List'].map((choice) => (
                <button className="choice-pill" key={choice} onClick={() => chooseAudience(choice)}>{choice}</button>
              ))}
            </div>
            <p className="helper-text">Selected audience: <strong>{audience}</strong></p>
          </section>

          <section className="broadcast-step-card">
            <StepTitle number="2" title="Choose SMS recipients" />
            <div className="choice-row">
              <label className="choice-pill"><input type="checkbox" checked={sendMother} onChange={(event) => { setSendMother(event.target.checked); setVisualStatus('Mother cell option updated.'); }} /> Mother cell</label>
              <label className="choice-pill"><input type="checkbox" checked={sendFather} onChange={(event) => { setSendFather(event.target.checked); setVisualStatus('Father cell option updated.'); }} /> Father cell</label>
            </div>
            <p className="helper-text">Home phones are voice-only and are not used for SMS.</p>
          </section>

          <section className="broadcast-step-card">
            <StepTitle number="3" title="Write message" />
            <label className="helper-text" htmlFor="broadcast-title">Broadcast title, optional</label>
            <input id="broadcast-title" className="search-input broadcast-title-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={autoTitle} />
            <textarea className="compose-box broadcast-message-box" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Type your broadcast message..." />
            <p className="helper-text">Characters: {characterCount} - Estimated SMS parts: {smsParts}</p>
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

          <section className="broadcast-step-card broadcast-actions-card">
            <StepTitle number="5" title="Actions" />
            <div className="broadcast-actions">
              <button className="btn btn-secondary" onClick={saveDraft}><CheckCircle2 size={16} /> Save Draft</button>
              <button className="btn btn-secondary" onClick={scheduleBroadcast}><CalendarClock size={16} /> Schedule</button>
              <button className="btn btn-primary" onClick={sendNow}><Send size={16} /> Send Now</button>
            </div>
            {showSchedulePanel ? (
              <div className="schedule-panel">
                <label className="helper-text">Date <input className="schedule-input" type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} /></label>
                <label className="helper-text">Time <input className="schedule-input" type="time" value={scheduledTime} onChange={(event) => setScheduledTime(event.target.value)} /></label>
                <button className="btn btn-primary" onClick={saveSchedule}>Save Schedule</button>
              </div>
            ) : null}
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
