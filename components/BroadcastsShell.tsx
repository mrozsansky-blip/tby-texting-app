'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Megaphone, Search, Send } from 'lucide-react';

type AudienceType = 'all_families' | 'grade' | 'bus' | 'manual_list';
type PhoneChoice = 'mother_cell' | 'father_cell';
type BroadcastStatus = 'New Broadcast' | 'Drafts' | 'Scheduled' | 'Past';

type Recipient = {
  id: string;
  familyId: string;
  familyName: string;
  personName?: string;
  phoneNumberRecordId: string;
  phoneE164: string;
  phoneType?: string;
  recipientPhoneChoice: PhoneChoice;
  checked: boolean;
};

type SkippedRecipient = {
  id: string;
  familyName?: string;
  phoneE164?: string;
  phoneType?: string;
  reason: string;
  detail: string;
};

type PreviewResponse = {
  audience: { label: string; busField?: string };
  counts: { familiesFound: number; phonesFound: number; eligibleRecipients: number; skipped: number };
  recipients: Array<Omit<Recipient, 'checked'>>;
  skipped: SkippedRecipient[];
  skippedReasons: Record<string, number>;
  notes: string[];
  planningMode: true;
  providerConnected: false;
  error?: string;
  details?: string;
};

type PhoneSearchResult = {
  id: string;
  dropdownLabel: string;
  familyName?: string;
  personName?: string;
  phoneE164?: string;
  phoneType?: string;
  smsAllowed: boolean;
  doNotContact: boolean;
  invalidBadNumber: boolean;
};

const broadcastRows = [
  { title: 'Grade 4 Forms Reminder', status: 'Draft', tab: 'Drafts', audience: 'Grade 4 families', count: 143, time: 'Created today' },
  { title: 'Bus 6 Delay Notice', status: 'Scheduled - pending send window', tab: 'Scheduled', audience: 'Bus 6', count: 42, time: 'Tomorrow 8:30 AM' },
  { title: 'All Families Notice', status: 'Processed - not sent', tab: 'Past', audience: 'All Families', count: 684, time: 'Yesterday' }
];

const audienceLabels: Record<AudienceType, string> = {
  all_families: 'All Families',
  grade: 'Grade',
  bus: 'Bus',
  manual_list: 'Manual List'
};

function maskPhone(phone: string) {
  return phone.length > 4 ? `***${phone.slice(-4)}` : phone;
}

function phoneChoiceLabel(choice: PhoneChoice) {
  return choice === 'mother_cell' ? 'Mother cell' : 'Father cell';
}

function reasonLabel(reason: string) {
  return reason.replace(/_/g, ' ');
}

export function BroadcastsShell() {
  const [audienceType, setAudienceType] = useState<AudienceType>('all_families');
  const [audienceValue, setAudienceValue] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('Reminder from Tiferes Bais Yaakov: forms are due tomorrow. Thank you.');
  const [sendMother, setSendMother] = useState(true);
  const [sendFather, setSendFather] = useState(true);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [skipped, setSkipped] = useState<SkippedRecipient[]>([]);
  const [previewCounts, setPreviewCounts] = useState({ familiesFound: 0, phonesFound: 0, eligibleRecipients: 0, skipped: 0 });
  const [previewNotes, setPreviewNotes] = useState<string[]>([]);
  const [previewLabel, setPreviewLabel] = useState('No recipient preview loaded yet');
  const [activeTab, setActiveTab] = useState<BroadcastStatus>('New Broadcast');
  const [broadcastSearch, setBroadcastSearch] = useState('');
  const [visualStatus, setVisualStatus] = useState('Ready. Choose an audience and preview recipients before sending.');
  const [showSchedulePanel, setShowSchedulePanel] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [manualSearch, setManualSearch] = useState('');
  const [manualSearchResults, setManualSearchResults] = useState<PhoneSearchResult[]>([]);
  const [manualPhones, setManualPhones] = useState<PhoneSearchResult[]>([]);
  const [isManualSearchLoading, setIsManualSearchLoading] = useState(false);

  const selectedCount = recipients.filter((recipient) => recipient.checked).length;
  const characterCount = message.length;
  const smsParts = Math.max(1, Math.ceil(characterCount / 160));
  const requestedPhoneChoices: PhoneChoice[] = [sendMother ? 'mother_cell' : null, sendFather ? 'father_cell' : null].filter(Boolean) as PhoneChoice[];
  const displayedRows = broadcastRows.filter((row) => {
    const matchesTab = row.tab === activeTab;
    const searchText = [row.title, row.status, row.audience, row.time].join(' ').toLowerCase();
    return matchesTab && searchText.includes(broadcastSearch.toLowerCase());
  });
  const autoTitle = useMemo(() => {
    const words = message.replace(/[^a-zA-Z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 4).join(' ');
    return `${previewLabel || audienceLabels[audienceType]} - ${words || 'Message'} - Today`;
  }, [audienceType, message, previewLabel]);

  function resetPreview(status: string) {
    setRecipients([]);
    setSkipped([]);
    setPreviewCounts({ familiesFound: 0, phonesFound: 0, eligibleRecipients: 0, skipped: 0 });
    setPreviewNotes([]);
    setPreviewLabel('No recipient preview loaded yet');
    setVisualStatus(status);
  }

  function setAll(checked: boolean) {
    setRecipients((current) => current.map((recipient) => ({ ...recipient, checked })));
    setVisualStatus(checked ? 'All eligible preview recipients are checked.' : 'All preview recipients are unchecked. Select at least one before visual processing.');
  }

  function selectType(type: PhoneChoice | 'both') {
    setRecipients((current) => current.map((recipient) => ({ ...recipient, checked: type === 'both' || recipient.recipientPhoneChoice === type })));
    setVisualStatus(type === 'both' ? 'Mother and father cells are selected.' : `${phoneChoiceLabel(type)} recipients are selected.`);
  }

  function toggleRecipient(id: string) {
    setRecipients((current) => current.map((recipient) => recipient.id === id ? { ...recipient, checked: !recipient.checked } : recipient));
    setVisualStatus('Recipient checklist updated. This is visual only.');
  }

  function startNewBroadcast() {
    setAudienceType('all_families');
    setAudienceValue('');
    setTitle('');
    setMessage('');
    setSendMother(true);
    setSendFather(true);
    setShowSchedulePanel(false);
    setActiveTab('New Broadcast');
    setManualPhones([]);
    setManualSearchResults([]);
    resetPreview('New broadcast started. Choose an audience and preview recipients.');
  }

  function chooseAudience(choice: AudienceType) {
    setAudienceType(choice);
    setAudienceValue('');
    resetPreview(`${audienceLabels[choice]} selected. Preview recipients to load contact data.`);
  }

  async function previewRecipients() {
    if (requestedPhoneChoices.length === 0) {
      setVisualStatus('Choose Mother cell and/or Father cell before previewing. Home phones are voice-only and disabled for SMS.');
      return;
    }

    if ((audienceType === 'grade' || audienceType === 'bus') && !audienceValue.trim()) {
      setVisualStatus(`Enter a ${audienceLabels[audienceType].toLowerCase()} value before previewing.`);
      return;
    }

    if (audienceType === 'manual_list' && manualPhones.length === 0) {
      setVisualStatus('Search phone numbers and add at least one manual recipient before previewing.');
      return;
    }

    setIsPreviewLoading(true);
    setVisualStatus('Loading recipient preview...');

    try {
      const response = await fetch('/api/broadcasts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audienceType,
          audienceValue: audienceType === 'manual_list' ? manualPhones.map((phone) => phone.id).join(',') : audienceValue,
          phoneChoices: requestedPhoneChoices,
          manualPhoneRecordIds: manualPhones.map((phone) => phone.id)
        })
      });
      const data = await response.json() as PreviewResponse;

      if (!response.ok || data.error) {
        throw new Error(data.details || data.error || 'Preview failed.');
      }

      setRecipients(data.recipients.map((recipient) => ({ ...recipient, checked: true })));
      setSkipped(data.skipped || []);
      setPreviewCounts(data.counts);
      setPreviewNotes(data.notes || []);
      setPreviewLabel(data.audience.label);
      setVisualStatus(`Preview loaded: ${data.counts.eligibleRecipients} eligible recipients, ${data.counts.skipped} skipped. No SMS sent.`);
    } catch (error) {
      resetPreview(`Could not load recipient preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function searchManualPhones() {
    if (manualSearch.trim().length < 2) {
      setVisualStatus('Type at least 2 characters or digits to search phone numbers.');
      return;
    }

    setIsManualSearchLoading(true);
    setVisualStatus('Searching phone numbers for manual list preview...');

    try {
      const response = await fetch(`/api/phones/search?q=${encodeURIComponent(manualSearch.trim())}`);
      const data = await response.json() as { phones?: PhoneSearchResult[]; details?: string; error?: string };
      if (!response.ok || data.error) throw new Error(data.details || data.error || 'Phone search failed.');
      setManualSearchResults(data.phones || []);
      setVisualStatus(`Found ${(data.phones || []).length} phone records. Add recipients to the manual list, then preview.`);
    } catch (error) {
      setManualSearchResults([]);
      setVisualStatus(`Could not search phone numbers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsManualSearchLoading(false);
    }
  }

  function addManualPhone(phone: PhoneSearchResult) {
    setManualPhones((current) => current.some((item) => item.id === phone.id) ? current : [...current, phone]);
    resetPreview('Manual recipient added. Preview again to apply SMS safety filters and dedupe.');
  }

  function removeManualPhone(id: string) {
    setManualPhones((current) => current.filter((phone) => phone.id !== id));
    resetPreview('Manual recipient removed. Preview again to update the checklist.');
  }

  function saveDraft() {
    setVisualStatus(`Draft saved visually as "${title || autoTitle}". No SMS was sent.`);
  }

  function scheduleBroadcast() {
    setShowSchedulePanel(true);
    setVisualStatus('Choose a date and time, then save the visual schedule. This visual workspace does not send automatically.');
  }

  function saveSchedule() {
    if (!scheduledDate || !scheduledTime) {
      setVisualStatus('Choose both a schedule date and time.');
      return;
    }
    setShowSchedulePanel(false);
    setVisualStatus(`Broadcast scheduled visually for ${scheduledDate} at ${scheduledTime}. No automatic send was triggered.`);
  }

  async function sendNow() {
    if (!message.trim()) {
      setVisualStatus('Write a message before sending.');
      return;
    }
    const selectedRecipients = recipients.filter((recipient) => recipient.checked);
    if (selectedRecipients.length === 0) {
      setVisualStatus('No recipients selected. Check at least one preview recipient before sending.');
      return;
    }

    setVisualStatus(`Creating app campaign with ${selectedRecipients.length} recipient rows...`);
    try {
      const createResponse = await fetch('/api/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: title || autoTitle,
          message,
          recipients: selectedRecipients.map((recipient) => ({
            familyName: recipient.familyName,
            personName: recipient.personName,
            phoneE164: recipient.phoneE164,
            body: message
          }))
        })
      });
      const createData = await createResponse.json() as { campaignId?: string; error?: string; details?: string };
      if (!createResponse.ok || !createData.campaignId) throw new Error(createData.details || createData.error || 'Campaign creation failed.');

      setVisualStatus(`Campaign saved. Sending never-attempted rows at concurrency 5...`);
      const sendResponse = await fetch(`/api/broadcasts/${createData.campaignId}/send`, { method: 'POST' });
      const sendData = await sendResponse.json() as { error?: string; details?: string; attempted?: number };
      if (!sendResponse.ok || sendData.error) throw new Error(sendData.details || sendData.error || 'Broadcast send failed.');

      setVisualStatus(`Broadcast send workflow attempted ${sendData.attempted || 0} never-attempted rows. Opening status/retry page...`);
      window.location.href = `/broadcasts/${createData.campaignId}`;
    } catch (error) {
      setVisualStatus(`Could not send broadcast: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return (
    <div className="broadcast-frame">
      <aside className="broadcast-list-panel">
        <div className="broadcast-list-header">
          <div>
            <h1 className="inbox-title">Broadcasts</h1>
            <p className="helper-text">Mass texting workspace only.</p>
          </div>
          <button className="btn btn-primary" onClick={startNewBroadcast}><Megaphone size={16} /> New Broadcast</button>
        </div>
        <div className="broadcast-tabs">
          {(['New Broadcast', 'Drafts', 'Scheduled', 'Past'] as BroadcastStatus[]).map((tab) => (
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
          {activeTab === 'New Broadcast' ? <p className="helper-text">Use the workspace to prepare a new mass text. Nothing will be sent.</p> : null}
          {activeTab !== 'New Broadcast' && displayedRows.length === 0 ? <p className="helper-text">No visual broadcasts match this filter.</p> : null}
        </div>
      </aside>

      <section className="broadcast-workspace">
        <header className="chat-head">
          <div>
            <h2 className="chat-title">New Broadcast</h2>
            <p className="chat-subtitle">Recipient preview and live send use app campaign storage.</p>
          </div>
          <div className="status-pill">Preview only</div>
        </header>

        <div className="broadcast-scroll">
          <div className="broadcast-status-banner">{visualStatus}</div>

          <section className="broadcast-step-card">
            <StepTitle number="1" title="Choose audience" />
            <div className="choice-row broadcast-choice-row">
              {(['all_families', 'grade', 'bus', 'manual_list'] as AudienceType[]).map((choice) => (
                <button className={`choice-pill ${audienceType === choice ? 'selected-choice' : ''}`} key={choice} onClick={() => chooseAudience(choice)}>{audienceLabels[choice]}</button>
              ))}
            </div>
            {audienceType === 'grade' || audienceType === 'bus' ? (
              <div className="broadcast-search-wrap audience-value-wrap">
                <Search size={16} />
                <input
                  className="inbox-search-input"
                  value={audienceValue}
                  onChange={(event) => { setAudienceValue(event.target.value); resetPreview(`${audienceLabels[audienceType]} value updated. Preview recipients to refresh contact data.`); }}
                  onKeyDown={(event) => { if (event.key === 'Enter') void previewRecipients(); }}
                  placeholder={audienceType === 'grade' ? 'Enter grade, e.g. 4' : 'Enter bus, e.g. 6'}
                />
              </div>
            ) : null}
            {audienceType === 'manual_list' ? (
              <ManualListSearch
                manualSearch={manualSearch}
                setManualSearch={setManualSearch}
                searchManualPhones={searchManualPhones}
                isManualSearchLoading={isManualSearchLoading}
                manualSearchResults={manualSearchResults}
                manualPhones={manualPhones}
                addManualPhone={addManualPhone}
                removeManualPhone={removeManualPhone}
              />
            ) : null}
            <p className="helper-text">Selected audience: <strong>{previewLabel === 'No recipient preview loaded yet' ? audienceLabels[audienceType] : previewLabel}</strong></p>
          </section>

          <section className="broadcast-step-card">
            <StepTitle number="2" title="Choose SMS recipient types" />
            <div className="choice-row">
              <label className="choice-pill"><input type="checkbox" checked={sendMother} onChange={(event) => { setSendMother(event.target.checked); resetPreview('Mother cell option updated. Preview recipients to refresh contact data.'); }} /> Mother cell</label>
              <label className="choice-pill"><input type="checkbox" checked={sendFather} onChange={(event) => { setSendFather(event.target.checked); resetPreview('Father cell option updated. Preview recipients to refresh contact data.'); }} /> Father cell</label>
              <span className="choice-pill disabled-choice" aria-disabled="true">Home phone disabled - voice only</span>
            </div>
            <p className="helper-text">SMS preview includes mother cell and/or father cell only when the number is SMS-safe.</p>
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
            <button className="btn btn-primary preview-button" onClick={() => void previewRecipients()} disabled={isPreviewLoading}>
              {isPreviewLoading ? 'Loading preview...' : 'Preview recipients'}
            </button>
            <div className="preview-stat-grid">
              <PreviewStat label="Families found" value={previewCounts.familiesFound} />
              <PreviewStat label="Phone records" value={previewCounts.phonesFound} />
              <PreviewStat label="Eligible recipients" value={previewCounts.eligibleRecipients} />
              <PreviewStat label="Selected" value={selectedCount} />
              <PreviewStat label="Skipped" value={previewCounts.skipped} />
            </div>
            <div className="recipient-toolbar">
              <button className="btn btn-secondary" onClick={() => setAll(true)} disabled={recipients.length === 0}>Check all</button>
              <button className="btn btn-secondary" onClick={() => setAll(false)} disabled={recipients.length === 0}>Deselect all</button>
              <button className="btn btn-secondary" onClick={() => selectType('mother_cell')} disabled={recipients.length === 0}>Select mother cells</button>
              <button className="btn btn-secondary" onClick={() => selectType('father_cell')} disabled={recipients.length === 0}>Select father cells</button>
              <button className="btn btn-secondary" onClick={() => selectType('both')} disabled={recipients.length === 0}>Select both</button>
            </div>
            <div className="recipient-checklist">
              {recipients.length === 0 ? <p className="helper-text empty-preview-text">No eligible recipients loaded yet. Click Preview recipients.</p> : null}
              {recipients.map((recipient) => (
                <label className="recipient-check-row" key={recipient.id}>
                  <input type="checkbox" checked={recipient.checked} onChange={() => toggleRecipient(recipient.id)} />
                  <span>{recipient.familyName}{recipient.personName ? ` - ${recipient.personName}` : ''}</span>
                  <strong>{phoneChoiceLabel(recipient.recipientPhoneChoice)}</strong>
                  <span>{maskPhone(recipient.phoneE164)}</span>
                </label>
              ))}
            </div>
            <SkippedPreview skipped={skipped} />
            {previewNotes.length > 0 ? (
              <div className="preview-notes">
                {previewNotes.map((note) => <p className="helper-text" key={note}>{note}</p>)}
              </div>
            ) : null}
          </section>

          <section className="broadcast-step-card broadcast-actions-card">
            <StepTitle number="5" title="Actions" />
            <div className="broadcast-actions">
              <button className="btn btn-secondary" onClick={saveDraft}><CheckCircle2 size={16} /> Save Draft</button>
              <button className="btn btn-secondary" onClick={scheduleBroadcast}><CalendarClock size={16} /> Schedule</button>
              <button className="btn btn-primary" onClick={sendNow} disabled={!message.trim() || selectedCount === 0} title={!message.trim() || selectedCount === 0 ? 'Write a message and select at least one preview recipient first.' : undefined}><Send size={16} /> Send Now</button>
            </div>
            {showSchedulePanel ? (
              <div className="schedule-panel">
                <label className="helper-text">Date <input className="schedule-input" type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} /></label>
                <label className="helper-text">Time <input className="schedule-input" type="time" value={scheduledTime} onChange={(event) => setScheduledTime(event.target.value)} /></label>
                <button className="btn btn-primary" onClick={saveSchedule}>Save Schedule</button>
              </div>
            ) : null}
            <p className="helper-text">Send Now creates an app campaign, stores recipient rows, and sends never-attempted rows through the same batched TextGrid workflow used by retry/status.</p>
          </section>
        </div>
      </section>
    </div>
  );
}

function ManualListSearch({
  manualSearch,
  setManualSearch,
  searchManualPhones,
  isManualSearchLoading,
  manualSearchResults,
  manualPhones,
  addManualPhone,
  removeManualPhone
}: {
  manualSearch: string;
  setManualSearch: (value: string) => void;
  searchManualPhones: () => void;
  isManualSearchLoading: boolean;
  manualSearchResults: PhoneSearchResult[];
  manualPhones: PhoneSearchResult[];
  addManualPhone: (phone: PhoneSearchResult) => void;
  removeManualPhone: (id: string) => void;
}) {
  return (
    <div className="manual-list-panel">
      <div className="broadcast-search-wrap audience-value-wrap">
        <Search size={16} />
        <input
          className="inbox-search-input"
          value={manualSearch}
          onChange={(event) => setManualSearch(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') searchManualPhones(); }}
          placeholder="Search phones by name or number..."
        />
        <button className="mini-action-button" onClick={searchManualPhones} disabled={isManualSearchLoading}>{isManualSearchLoading ? 'Searching' : 'Search'}</button>
      </div>
      {manualSearchResults.length > 0 ? (
        <div className="manual-result-list">
          {manualSearchResults.map((phone) => {
            const alreadyAdded = manualPhones.some((selectedPhone) => selectedPhone.id === phone.id);
            return (
              <button className="manual-result-row" key={phone.id} onClick={() => addManualPhone(phone)} disabled={alreadyAdded}>
                <span>{phone.dropdownLabel}</span>
                <strong>{alreadyAdded ? 'Added' : 'Add'}</strong>
              </button>
            );
          })}
        </div>
      ) : null}
      {manualPhones.length > 0 ? (
        <div className="manual-selected-list">
          <p className="helper-text">Manual recipients selected for preview:</p>
          {manualPhones.map((phone) => (
            <div className="manual-selected-row" key={phone.id}>
              <span>{phone.dropdownLabel}</span>
              <button className="mini-action-button" onClick={() => removeManualPhone(phone.id)}>Remove</button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SkippedPreview({ skipped }: { skipped: SkippedRecipient[] }) {
  if (skipped.length === 0) {
    return <div className="preview-notes"><p className="helper-text">Skipped recipients will appear here with plain-English reasons after preview.</p></div>;
  }

  return (
    <div className="skipped-preview-list">
      <p className="card-title">Skipped recipients</p>
      {skipped.slice(0, 50).map((row) => (
        <div className="skipped-preview-row" key={row.id}>
          <div>
            <strong>{row.familyName || row.phoneE164 || 'phone record'}</strong>
            <p className="helper-text">{row.detail}</p>
          </div>
          <span className="tag">{reasonLabel(row.reason)}</span>
        </div>
      ))}
      {skipped.length > 50 ? <p className="helper-text">Showing 50 of {skipped.length} skipped rows.</p> : null}
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
