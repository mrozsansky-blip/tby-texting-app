'use client';

import { useState } from 'react';
import { Search, Send } from 'lucide-react';

type Conversation = {
  id: string;
  familyName: string;
  personName: string;
  phoneType: string;
  phoneMasked: string;
  lastText: string;
  lastTime: string;
  unread?: boolean;
  needsReply?: boolean;
  messages: Array<{
    id: string;
    direction: 'inbound' | 'outbound';
    body: string;
    time: string;
    status?: string;
    relatedBroadcast?: string;
  }>;
  familyInfo: {
    smsStatus: string;
    parents: string[];
    students: string[];
    notes: string;
    groups: string[];
  };
};

const conversations: Conversation[] = [
  {
    id: 'sample-mother',
    familyName: 'Sample Family A',
    personName: 'Parent A',
    phoneType: 'Mother cell',
    phoneMasked: '***1234',
    lastText: 'Thank you, we sent it in.',
    lastTime: '2:14 PM',
    unread: true,
    needsReply: true,
    messages: [
      { id: '1', direction: 'outbound', body: 'Reminder from school: forms are due tomorrow.', time: '10:32 AM', status: 'Processed - provider not connected', relatedBroadcast: 'Forms Reminder' },
      { id: '2', direction: 'inbound', body: 'Thank you, we sent it in.', time: '2:14 PM', relatedBroadcast: 'Forms Reminder' }
    ],
    familyInfo: {
      smsStatus: 'SMS allowed',
      parents: ['Parent A - Mother cell', 'Parent B - Father cell', 'Home phone - voice only'],
      students: ['Student A - Grade 4', 'Student B - Grade 8'],
      notes: 'Sample office note for the selected family.',
      groups: ['Grade 4', 'Grade 8', 'Bus 6']
    }
  },
  {
    id: 'sample-father',
    familyName: 'Sample Family B',
    personName: 'Parent B',
    phoneType: 'Father cell',
    phoneMasked: '***7788',
    lastText: 'You: Bus 4 is running about 10 minutes late.',
    lastTime: 'Yesterday',
    messages: [
      { id: '1', direction: 'outbound', body: 'Bus 4 is running about 10 minutes late today.', time: 'Yesterday 3:20 PM', status: 'Processed - provider not connected', relatedBroadcast: 'Bus 4 Delay' }
    ],
    familyInfo: {
      smsStatus: 'SMS allowed',
      parents: ['Parent A - Mother cell', 'Parent B - Father cell'],
      students: ['Student C - Grade 6'],
      notes: 'Bus updates should go to both parents.',
      groups: ['Grade 6', 'Bus 4']
    }
  },
  {
    id: 'sample-question',
    familyName: 'Sample Family C',
    personName: 'Parent C',
    phoneType: 'Mother cell',
    phoneMasked: '***4422',
    lastText: 'Can we send the form on Monday?',
    lastTime: 'Mon',
    messages: [
      { id: '1', direction: 'outbound', body: 'Please return the signed permission form by Friday.', time: 'Mon 9:02 AM', status: 'Processed - provider not connected' },
      { id: '2', direction: 'inbound', body: 'Can we send the form on Monday?', time: 'Mon 10:18 AM' }
    ],
    familyInfo: {
      smsStatus: 'SMS allowed',
      parents: ['Parent C - Mother cell', 'Parent D - Father cell'],
      students: ['Student D - Grade 5'],
      notes: 'Sample note about a form follow-up.',
      groups: ['Grade 5']
    }
  }
];

export function ConversationShell() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(conversations[0].id);
  const [reply, setReply] = useState('');
  const selected = conversations.find((conversation) => conversation.id === selectedId) || conversations[0];
  const filteredConversations = conversations.filter((conversation) => {
    const text = [conversation.familyName, conversation.personName, conversation.phoneType, conversation.phoneMasked, conversation.lastText].join(' ').toLowerCase();
    return text.includes(search.toLowerCase());
  });

  function sendVisualReply() {
    if (!reply.trim()) return;
    setReply('');
  }

  return (
    <div className="inbox-frame">
      <aside className="inbox-left">
        <div className="inbox-head">
          <h1 className="inbox-title">Inbox</h1>
          <div className="inbox-search-wrap">
            <Search size={16} />
            <input
              className="inbox-search-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search texts, names, numbers..."
            />
          </div>
          <button className="btn btn-primary inbox-new-button">+ New text</button>
        </div>

        <div className="thread-list">
          {filteredConversations.map((conversation) => (
            <button
              className={`thread-item ${conversation.id === selected.id ? 'active' : ''}`}
              key={conversation.id}
              onClick={() => setSelectedId(conversation.id)}
            >
              <div className="thread-row">
                <p className="thread-name">{conversation.familyName}</p>
                <span className="thread-time">{conversation.lastTime}</span>
              </div>
              <p className="thread-subtitle">{conversation.personName} - {conversation.phoneType} - {conversation.phoneMasked}</p>
              <p className="thread-snippet">{conversation.lastText}</p>
              <div className="tags">
                {conversation.unread ? <span className="tag">Unread</span> : null}
                {conversation.needsReply ? <span className="tag">Needs reply</span> : null}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="chat-panel">
        <header className="chat-head">
          <div>
            <h2 className="chat-title">{selected.familyName}</h2>
            <p className="chat-subtitle">{selected.personName} - {selected.phoneType} - {selected.phoneMasked}</p>
          </div>
          <div className="status-pill">One-on-one</div>
        </header>

        <div className="chat-scroll">
          {selected.messages.map((message) => (
            <div className={`bubble ${message.direction === 'outbound' ? 'office' : 'parent'}`} key={message.id}>
              <p style={{ margin: 0 }}>{message.body}</p>
              {message.relatedBroadcast ? <p className="bubble-note">Related: {message.relatedBroadcast}</p> : null}
              <p className="bubble-time">{message.time}{message.status ? ` - ${message.status}` : ''}</p>
            </div>
          ))}
        </div>

        <div className="compose-area one-to-one-compose">
          <textarea
            className="compose-box"
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder={`Text ${selected.personName}...`}
          />
          <div className="compose-row">
            <p className="helper-text">Provider not connected: messages can appear as processed/not sent during setup.</p>
            <button className="btn btn-primary" onClick={sendVisualReply}><Send size={16} /> Send</button>
          </div>
        </div>
      </section>

      <aside className="context-panel">
        <div className="side-card">
          <p className="card-title">Family info</p>
          <div className="info-list">
            <Info label="Family" value={selected.familyName} />
            <Info label="Matched number" value={`${selected.personName} - ${selected.phoneType} - ${selected.phoneMasked}`} />
            <Info label="SMS status" value={selected.familyInfo.smsStatus} />
          </div>
        </div>

        <div className="side-card">
          <p className="card-title">Parents and phones</p>
          <SimpleList items={selected.familyInfo.parents} />
        </div>

        <div className="side-card">
          <p className="card-title">Students</p>
          <SimpleList items={selected.familyInfo.students} />
        </div>

        <div className="side-card">
          <p className="card-title">Groups</p>
          <SimpleList items={selected.familyInfo.groups} />
        </div>

        <div className="side-card">
          <p className="card-title">Office notes</p>
          <p className="helper-text">{selected.familyInfo.notes}</p>
        </div>
      </aside>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="info-label">{label}</div><div className="info-value">{value}</div></div>;
}

function SimpleList({ items }: { items: string[] }) {
  return (
    <div className="info-list">
      {items.map((item) => <div className="info-value" key={item}>{item}</div>)}
    </div>
  );
}
