'use client';

import { useMemo, useState } from 'react';
import { Bot, Send, Users } from 'lucide-react';

type Conversation = {
  id: string;
  familyName: string;
  snippet: string;
  time: string;
  groupLabels: string[];
};

const conversations: Conversation[] = [
  { id: 'levy', familyName: 'Levy Family', snippet: 'Can you please send the form link again?', time: '2:14 PM', groupLabels: ['Grade 8', 'Bus 4'] },
  { id: 'cohen', familyName: 'Cohen Family', snippet: 'Bus 2 is running late today.', time: '1:48 PM', groupLabels: ['Grade 4', 'Bus 2'] },
  { id: 'gold', familyName: 'Gold Family', snippet: 'Thank you, we submitted it.', time: '12:31 PM', groupLabels: ['Class 6B'] }
];

const messages = [
  { from: 'office', body: 'Reminder: please submit the trip form by tomorrow.', time: 'Yesterday' },
  { from: 'parent', body: 'Can you please send the form link again?', time: '2:14 PM' }
];

export function ConversationShell() {
  const [selectedId, setSelectedId] = useState('levy');
  const [prompt, setPrompt] = useState('Tell bus 4 parents that the bus is delayed 15 minutes today');
  const [draft, setDraft] = useState('');
  const [group, setGroup] = useState('');
  const selected = useMemo(() => conversations.find((c) => c.id === selectedId) ?? conversations[0], [selectedId]);

  async function askAi() {
    const [composeRes, groupRes] = await Promise.all([
      fetch('/api/ai/compose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) }),
      fetch('/api/ai/find-groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) })
    ]);
    const composeJson = await composeRes.json();
    const groupJson = await groupRes.json();
    setDraft(composeJson.message || '');
    setGroup(groupJson.groupSuggestion || '');
  }

  return (
    <div className="inbox-frame">
      <aside className="inbox-left">
        <div className="inbox-head">
          <h1 className="inbox-title">Inbox</h1>
          <input className="search-input" placeholder="Search family, class, bus..." />
        </div>
        {conversations.map((conversation) => (
          <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={`thread-item ${selectedId === conversation.id ? 'active' : ''}`}>
            <div className="thread-row">
              <p className="thread-name">{conversation.familyName}</p>
              <span className="thread-time">{conversation.time}</span>
            </div>
            <p className="thread-snippet">{conversation.snippet}</p>
            <div className="tags">
              {conversation.groupLabels.map((label) => <span key={label} className="tag">{label}</span>)}
            </div>
          </button>
        ))}
      </aside>

      <section className="chat-panel">
        <header className="chat-head">
          <div>
            <h2 className="chat-title">{selected.familyName}</h2>
            <p className="chat-subtitle">Conversation history and staff replies</p>
          </div>
          <div className="status-pill">SMS allowed</div>
        </header>
        <div className="chat-scroll">
          {messages.map((message, index) => {
            const office = message.from === 'office';
            return (
              <div key={index} className={`bubble ${office ? 'office' : 'parent'}`}>
                <p style={{ margin: 0 }}>{message.body}</p>
                <p className="bubble-time">{message.time}</p>
              </div>
            );
          })}
        </div>
        <div className="compose-area">
          <textarea className="compose-box" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message or use AI on the right..." />
          <div className="compose-row">
            <p className="helper-text">Draft must be previewed before sending.</p>
            <button className="btn btn-primary"><Send size={16} /> Preview Send</button>
          </div>
        </div>
      </section>

      <aside className="context-panel">
        <div className="side-card">
          <p className="card-title"><Bot size={20} /> AI compose and group finder</p>
          <textarea className="ai-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <button onClick={askAi} className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}>Draft and find group</button>
          {group && <div className="suggestion"><strong>Suggested recipients</strong><br />{group}</div>}
        </div>

        <div className="side-card">
          <p className="card-title"><Users size={20} /> Family context</p>
          <div className="info-list">
            <Info label="Parents" value="Mrs. Levy, Mr. Levy" />
            <Info label="Students" value="Sara Levy - Grade 8; Chani Levy - Grade 5" />
            <Info label="Groups" value="Grade 8, Grade 5, Bus 4" />
            <Info label="Forms" value="Trip form missing" />
          </div>
        </div>
      </aside>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="info-label">{label}</div><div className="info-value">{value}</div></div>;
}
