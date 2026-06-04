'use client';

import { useState } from 'react';
import { Bot, Phone, Send, ShieldCheck, Users } from 'lucide-react';

function parsePhoneNumbers(value: string) {
  return value
    .split(/[\n,]+/)
    .map((phone) => phone.trim())
    .filter(Boolean);
}

type PhoneSearchResult = {
  id: string;
  display: string;
  dropdownLabel?: string;
  personName?: string;
  familyName?: string;
  phoneNumber: string;
  phoneE164: string;
  rawPhone: string;
  phoneType: string;
  familyIds: string;
  personIds: string;
  smsAllowed: boolean;
  voiceAllowed: boolean;
  doNotContact: boolean;
  invalidBadNumber: boolean;
};

export function ConversationShell() {
  const [prompt, setPrompt] = useState('Draft a warm reminder that school forms are due tomorrow.');
  const [draft, setDraft] = useState('');
  const [group, setGroup] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState('Planning mode: no SMS will be sent unless SMS_SEND_ENABLED is true in Vercel.');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [phoneSearchResults, setPhoneSearchResults] = useState<PhoneSearchResult[]>([]);
  const [selectedPhoneId, setSelectedPhoneId] = useState('');
  const [phoneSearchStatus, setPhoneSearchStatus] = useState('Search Airtable phone numbers by name, type, or digits.');
  const [phoneSearchLoading, setPhoneSearchLoading] = useState(false);
  const recipients = parsePhoneNumbers(phoneNumbers);
  const dedupedRecipients = Array.from(new Set(recipients));
  const selectedPhone = phoneSearchResults.find((phone) => phone.id === selectedPhoneId);

  async function askAi() {
    setStatus('Asking AI to draft and suggest a live Airtable group...');
    const [composeRes, groupRes] = await Promise.all([
      fetch('/api/ai/compose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) }),
      fetch('/api/ai/find-groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) })
    ]);
    const composeJson = await composeRes.json();
    const groupJson = await groupRes.json();
    setDraft(composeJson.message || '');
    setGroup(groupJson.groupSuggestion || groupJson.reason || 'No group suggested.');
    setStatus('Draft ready. Review it carefully before saving a planning record.');
  }

  async function searchAirtablePhones() {
    if (phoneSearch.trim().length < 2) {
      setPhoneSearchStatus('Enter at least 2 characters to search.');
      return;
    }

    setPhoneSearchLoading(true);
    setPhoneSearchStatus('Searching Airtable phone numbers...');

    try {
      const response = await fetch(`/api/phones/search?q=${encodeURIComponent(phoneSearch.trim())}`, { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) {
        setPhoneSearchResults([]);
        setSelectedPhoneId('');
        setPhoneSearchStatus(data.error || 'Could not search Airtable phone numbers.');
        return;
      }

      const phones = Array.isArray(data.phones) ? data.phones : [];
      setPhoneSearchResults(phones);
      setSelectedPhoneId(phones[0]?.id || '');
      setPhoneSearchStatus(phones.length === 0 ? 'No Airtable phone numbers matched.' : `Found ${phones.length} matching phone numbers.`);
    } catch (error) {
      setPhoneSearchResults([]);
      setSelectedPhoneId('');
      setPhoneSearchStatus('Could not search Airtable phone numbers.');
    } finally {
      setPhoneSearchLoading(false);
    }
  }

  function addPhoneToManualList(phone: PhoneSearchResult | undefined) {
    if (!phone) {
      setPhoneSearchStatus('Choose a phone number first.');
      return;
    }

    const numberToAdd = phone.phoneE164 || phone.phoneNumber || phone.rawPhone;
    if (!numberToAdd) {
      setPhoneSearchStatus('This Airtable record does not have a usable phone number.');
      return;
    }

    const nextNumbers = Array.from(new Set([...dedupedRecipients, numberToAdd]));
    setPhoneNumbers(nextNumbers.join('\n'));
    setPhoneSearchStatus(`Added ${numberToAdd} to the manual planning list. No SMS was sent.`);
  }

  async function savePlanningRecord() {
    if (!draft.trim()) {
      setStatus('Please enter or generate a message first.');
      return;
    }

    if (dedupedRecipients.length === 0) {
      setStatus('Add at least one phone number to preview/save a planning record.');
      return;
    }

    if (!confirmed) {
      setStatus('Check the confirmation box before saving the planning record.');
      return;
    }

    setStatus('Saving planning record to Airtable. SMS sending remains disabled unless SMS_SEND_ENABLED is true.');
    const response = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: draft,
        recipients: dedupedRecipients,
        recipientGroup: group || 'Manual phone number test',
        confirmed: true,
        confirmedBy: 'Office planning user'
      })
    });
    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || 'Could not save planning record.');
      return;
    }

    setStatus(data.warning || `Saved planning record ${data.airtableMessageId}. No SMS was sent.`);
  }

  return (
    <div className="inbox-frame">
      <aside className="inbox-left">
        <div className="inbox-head">
          <h1 className="inbox-title">Planning Inbox</h1>
          <input className="search-input" placeholder="Live inbox is not connected yet" disabled />
        </div>
        <div className="thread-item active" style={{ textAlign: 'left' }}>
          <div className="thread-row">
            <p className="thread-name">Planning mode</p>
            <span className="thread-time">Safe</span>
          </div>
          <p className="thread-snippet">No live conversations are shown yet. Use this screen to draft and save test planning records.</p>
          <div className="tags">
            <span className="tag">No SMS</span>
            <span className="tag">Airtable draft</span>
          </div>
        </div>
      </aside>

      <section className="chat-panel">
        <header className="chat-head">
          <div>
            <h2 className="chat-title">Manual test message</h2>
            <p className="chat-subtitle">Add phone numbers, draft a message, and save a planning record.</p>
          </div>
          <div className="status-pill">Planning mode</div>
        </header>

        <div className="chat-scroll">
          <div className="bubble office">
            <p style={{ margin: 0 }}>Live inbox conversations are not connected yet.</p>
            <p className="bubble-time">System note</p>
          </div>
          <div className="bubble parent">
            <p style={{ margin: 0 }}>Use this area for safe manual testing. Nothing sends while SMS_SEND_ENABLED is not true.</p>
            <p className="bubble-time">Planning safety</p>
          </div>
        </div>

        <div className="compose-area">
          <label className="helper-text" htmlFor="manual-phones">Manual phone number test list</label>
          <textarea
            id="manual-phones"
            className="compose-box"
            style={{ minHeight: 90 }}
            value={phoneNumbers}
            onChange={(e) => setPhoneNumbers(e.target.value)}
            placeholder="Add one phone number per line or separate with commas"
          />
          <p className="helper-text">Preview: {recipients.length} entered, {dedupedRecipients.length} after dedupe.</p>

          <textarea className="compose-box" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message or use AI on the right..." />
          <label className="helper-text" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            I reviewed this planning draft. Save only; do not send SMS.
          </label>
          <div className="compose-row">
            <p className="helper-text">{status}</p>
            <button className="btn btn-primary" onClick={savePlanningRecord}><Send size={16} /> Save planning record</button>
          </div>
        </div>
      </section>

      <aside className="context-panel">
        <div className="side-card">
          <p className="card-title"><Phone size={20} /> Airtable phone search</p>
          <div className="phone-search-row">
            <input
              className="search-input"
              value={phoneSearch}
              onChange={(e) => setPhoneSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') searchAirtablePhones();
              }}
              placeholder="Search family, parent, or number"
            />
            <button className="btn btn-secondary" onClick={searchAirtablePhones}>{phoneSearchLoading ? 'Searching...' : 'Search'}</button>
          </div>
          <p className="helper-text" style={{ marginTop: 10 }}>{phoneSearchStatus}</p>

          {phoneSearchResults.length > 0 ? (
            <div className="phone-dropdown-block">
              <label className="helper-text" htmlFor="phone-result-dropdown">Choose a matching phone number</label>
              <select
                id="phone-result-dropdown"
                className="search-input phone-dropdown"
                value={selectedPhoneId}
                onChange={(e) => setSelectedPhoneId(e.target.value)}
              >
                {phoneSearchResults.map((phone) => (
                  <option value={phone.id} key={phone.id}>{phone.dropdownLabel || phone.display}</option>
                ))}
              </select>
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 10 }} onClick={() => addPhoneToManualList(selectedPhone)}>
                Add selected number
              </button>
            </div>
          ) : null}

          {phoneSearchResults.length > 0 ? (
            <div className="phone-result-list">
              {phoneSearchResults.map((phone) => (
                <div className="phone-result" key={phone.id}>
                  <div>
                    <strong>{phone.display}</strong>
                    <p className="helper-text">{phone.phoneType || 'No type'} • {phone.phoneE164 || phone.phoneNumber || 'No number'}</p>
                    <div className="tags">
                      <span className="tag">SMS {phone.smsAllowed ? 'allowed' : 'not allowed'}</span>
                      {phone.doNotContact ? <span className="tag">Do not contact</span> : null}
                      {phone.invalidBadNumber ? <span className="tag">Bad number</span> : null}
                    </div>
                  </div>
                  <button className="btn btn-secondary" onClick={() => addPhoneToManualList(phone)}>Add</button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="side-card">
          <p className="card-title"><Bot size={20} /> AI compose and group finder</p>
          <textarea className="ai-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <button onClick={askAi} className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}>Draft and find group</button>
          {group && <div className="suggestion"><strong>Suggested recipients</strong><br />{group}</div>}
        </div>

        <div className="side-card">
          <p className="card-title"><Users size={20} /> Safety checklist</p>
          <div className="info-list">
            <Info label="Live inbox" value="Not connected yet" />
            <Info label="Manual phones" value={`${dedupedRecipients.length} unique numbers`} />
            <Info label="SMS sending" value="Disabled unless SMS_SEND_ENABLED=true" />
            <Info label="Next build step" value="Create Message Queue preview rows" />
          </div>
        </div>

        <div className="side-card">
          <p className="card-title"><ShieldCheck size={20} /> No accidental sending</p>
          <p className="helper-text">This screen saves a planning record through the send endpoint. The endpoint will not send SMS unless Textgrid is configured and SMS_SEND_ENABLED is set to true.</p>
        </div>
      </aside>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="info-label">{label}</div><div className="info-value">{value}</div></div>;
}
