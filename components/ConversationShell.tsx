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
    <div className="grid h-[calc(100vh-2rem)] grid-cols-1 overflow-hidden rounded-3xl bg-white shadow-sm md:grid-cols-[310px_1fr_340px]">
      <aside className="border-r border-gray-100">
        <div className="border-b border-gray-100 p-4">
          <h1 className="text-xl font-bold">Inbox</h1>
          <input className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder="Search family, class, bus..." />
        </div>
        {conversations.map((conversation) => (
          <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={`w-full border-b border-gray-100 p-4 text-left ${selectedId === conversation.id ? 'bg-gray-50' : 'bg-white'}`}>
            <div className="flex items-center justify-between">
              <p className="font-semibold">{conversation.familyName}</p>
              <span className="text-xs text-gray-500">{conversation.time}</span>
            </div>
            <p className="mt-1 truncate text-sm text-gray-600">{conversation.snippet}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {conversation.groupLabels.map((label) => <span key={label} className="rounded-full bg-gray-100 px-2 py-1 text-xs">{label}</span>)}
            </div>
          </button>
        ))}
      </aside>

      <section className="flex min-h-0 flex-col">
        <header className="border-b border-gray-100 p-4">
          <h2 className="text-lg font-bold">{selected.familyName}</h2>
          <p className="text-sm text-gray-500">Conversation history and staff replies</p>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto bg-gray-50 p-6">
          {messages.map((message, index) => (
            <div key={index} className={`max-w-[75%] rounded-2xl p-4 shadow-sm ${message.from === 'office' ? 'ml-auto bg-gray-900 text-white' : 'bg-white'}`}>
              <p>{message.body}</p>
              <p className={`mt-2 text-xs ${message.from === 'office' ? 'text-gray-300' : 'text-gray-500'}`}>{message.time}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 p-4">
          <textarea className="h-24 w-full rounded-2xl border border-gray-200 p-3" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message or use AI on the right..." />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-gray-500">Draft must be previewed before sending.</p>
            <button className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 font-medium text-white"><Send className="h-4 w-4" /> Preview Send</button>
          </div>
        </div>
      </section>

      <aside className="border-l border-gray-100 p-4">
        <div className="rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 font-semibold"><Bot className="h-5 w-5" /> AI compose and group finder</div>
          <textarea className="mt-3 h-28 w-full rounded-xl border border-gray-200 p-3 text-sm" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <button onClick={askAi} className="mt-3 w-full rounded-xl bg-gray-900 px-4 py-2 font-medium text-white">Draft and find group</button>
          {group && <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm"><p className="font-semibold">Suggested recipients</p><p>{group}</p></div>}
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 font-semibold"><Users className="h-5 w-5" /> Family context</div>
          <dl className="mt-3 space-y-2 text-sm">
            <div><dt className="text-gray-500">Parents</dt><dd>Mrs. Levy, Mr. Levy</dd></div>
            <div><dt className="text-gray-500">Students</dt><dd>Sara Levy - Grade 8<br />Chani Levy - Grade 5</dd></div>
            <div><dt className="text-gray-500">Groups</dt><dd>Grade 8, Grade 5, Bus 4</dd></div>
            <div><dt className="text-gray-500">Forms</dt><dd>Trip form missing</dd></div>
          </dl>
        </div>
      </aside>
    </div>
  );
}
