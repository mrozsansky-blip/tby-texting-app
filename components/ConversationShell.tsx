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

const styles = {
  shell: { display: 'grid', gridTemplateColumns: '310px 1fr 340px', height: 'calc(100vh - 32px)', overflow: 'hidden', borderRadius: 28, background: '#ffffff', boxShadow: '0 18px 60px rgba(15, 23, 42, 0.10)', border: '1px solid #e5e7eb' } as React.CSSProperties,
  sidebar: { borderRight: '1px solid #eef2f7', background: '#fbfdff' } as React.CSSProperties,
  rightbar: { borderLeft: '1px solid #eef2f7', padding: 18, background: '#ffffff' } as React.CSSProperties,
  header: { padding: 18, borderBottom: '1px solid #eef2f7' } as React.CSSProperties,
  input: { width: '100%', marginTop: 12, borderRadius: 14, border: '1px solid #dbe3ee', padding: '11px 12px', fontSize: 14, outline: 'none' } as React.CSSProperties,
  conversationButton: (active: boolean): React.CSSProperties => ({ width: '100%', border: 0, borderBottom: '1px solid #eef2f7', padding: 16, textAlign: 'left', background: active ? '#eef6ff' : '#fbfdff', cursor: 'pointer' }),
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 } as React.CSSProperties,
  tag: { borderRadius: 999, background: '#e8eef7', padding: '4px 9px', fontSize: 12, color: '#334155' } as React.CSSProperties,
  thread: { display: 'flex', minHeight: 0, flexDirection: 'column' } as React.CSSProperties,
  messages: { flex: 1, overflowY: 'auto', padding: 24, background: 'linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)' } as React.CSSProperties,
  bubble: (office: boolean): React.CSSProperties => ({ maxWidth: '76%', marginLeft: office ? 'auto' : 0, marginBottom: 16, borderRadius: office ? '22px 22px 6px 22px' : '22px 22px 22px 6px', padding: 16, background: office ? '#0f172a' : '#ffffff', color: office ? '#ffffff' : '#111827', boxShadow: '0 8px 22px rgba(15, 23, 42, 0.08)' }),
  compose: { borderTop: '1px solid #eef2f7', padding: 16, background: '#ffffff' } as React.CSSProperties,
  textarea: { width: '100%', borderRadius: 18, border: '1px solid #dbe3ee', padding: 14, fontSize: 14, resize: 'vertical', outline: 'none', fontFamily: 'inherit' } as React.CSSProperties,
  primaryButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, border: 0, background: '#0f172a', color: '#ffffff', padding: '11px 16px', fontWeight: 700, cursor: 'pointer' } as React.CSSProperties,
  card: { border: '1px solid #e5e7eb', borderRadius: 22, padding: 16, background: '#ffffff', boxShadow: '0 10px 28px rgba(15, 23, 42, 0.05)' } as React.CSSProperties
};

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
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.header}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Inbox</h1>
          <input style={styles.input} placeholder="Search family, class, bus..." />
        </div>
        {conversations.map((conversation) => (
          <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} style={styles.conversationButton(selectedId === conversation.id)}>
            <div style={styles.row}>
              <p style={{ margin: 0, fontWeight: 800 }}>{conversation.familyName}</p>
              <span style={{ fontSize: 12, color: '#64748b' }}>{conversation.time}</span>
            </div>
            <p style={{ margin: '6px 0 0', color: '#475569', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conversation.snippet}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {conversation.groupLabels.map((label) => <span key={label} style={styles.tag}>{label}</span>)}
            </div>
          </button>
        ))}
      </aside>

      <section style={styles.thread}>
        <header style={styles.header}>
          <h2 style={{ margin: 0, fontSize: 20 }}>{selected.familyName}</h2>
          <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: 14 }}>Conversation history and staff replies</p>
        </header>
        <div style={styles.messages}>
          {messages.map((message, index) => {
            const office = message.from === 'office';
            return (
              <div key={index} style={styles.bubble(office)}>
                <p style={{ margin: 0, lineHeight: 1.45 }}>{message.body}</p>
                <p style={{ margin: '8px 0 0', fontSize: 12, color: office ? '#cbd5e1' : '#64748b' }}>{message.time}</p>
              </div>
            );
          })}
        </div>
        <div style={styles.compose}>
          <textarea style={{ ...styles.textarea, height: 92 }} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message or use AI on the right..." />
          <div style={{ ...styles.row, marginTop: 12 }}>
            <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>Draft must be previewed before sending.</p>
            <button style={styles.primaryButton}><Send size={16} /> Preview Send</button>
          </div>
        </div>
      </section>

      <aside style={styles.rightbar}>
        <div style={styles.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800 }}><Bot size={20} /> AI compose and group finder</div>
          <textarea style={{ ...styles.textarea, height: 112, marginTop: 12 }} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <button onClick={askAi} style={{ ...styles.primaryButton, width: '100%', marginTop: 12 }}>Draft and find group</button>
          {group && <div style={{ marginTop: 14, borderRadius: 16, background: '#f1f5f9', padding: 12, fontSize: 14 }}><p style={{ margin: 0, fontWeight: 800 }}>Suggested recipients</p><p style={{ margin: '5px 0 0' }}>{group}</p></div>}
        </div>

        <div style={{ ...styles.card, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800 }}><Users size={20} /> Family context</div>
          <div style={{ marginTop: 14, display: 'grid', gap: 12, fontSize: 14 }}>
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
  return <div><div style={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>{label}</div><div style={{ marginTop: 3 }}>{value}</div></div>;
}
