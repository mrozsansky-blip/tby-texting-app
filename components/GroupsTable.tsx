'use client';

import { useEffect, useMemo, useState } from 'react';

type Group = {
  id: string;
  name: string;
  type: string;
  rule?: string;
  familyCount?: number;
  studentCount?: number;
  active?: boolean;
};

type PhoneChoice = 'mother_cell' | 'father_cell';

type PreviewRecipient = {
  familyId: string;
  familyName: string;
  phoneNumberRecordId: string;
  phoneE164: string;
  recipientPhoneChoice: string;
  phoneType?: string;
  personRole?: string;
  personTitle?: string;
};

type GroupPreview = {
  group: Group;
  planningMode: true;
  requestedPhoneChoices: string[];
  counts: {
    familiesFound: number;
    phonesFound: number;
    eligiblePhonesFound: number;
    dedupedRecipients: number;
    skippedReasons: Record<string, number>;
  };
  recipients: PreviewRecipient[];
  skippedReasons: Record<string, number>;
  notes: string[];
};

const PHONE_CHOICE_LABELS: Record<PhoneChoice, string> = {
  mother_cell: 'Mother cell',
  father_cell: 'Father cell'
};

function formatReason(reason: string) {
  return reason
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function GroupsTable() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [phoneChoices, setPhoneChoices] = useState<PhoneChoice[]>(['mother_cell', 'father_cell']);
  const [preview, setPreview] = useState<GroupPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewGroupId, setPreviewGroupId] = useState<string | null>(null);

  const phoneChoiceQuery = useMemo(() => phoneChoices.join(','), [phoneChoices]);

  useEffect(() => {
    async function loadGroups() {
      try {
        const response = await fetch('/api/groups', { cache: 'no-store' });
        const data = await response.json();
        setGroups(Array.isArray(data.groups) ? data.groups : []);
        setWarning(data.warning || null);
      } catch (error) {
        setWarning('Could not load groups from Airtable.');
      } finally {
        setLoading(false);
      }
    }

    loadGroups();
  }, []);

  function togglePhoneChoice(choice: PhoneChoice) {
    setPhoneChoices((current) => {
      if (current.includes(choice)) {
        const next = current.filter((item) => item !== choice);
        return next.length > 0 ? next : current;
      }
      return [...current, choice];
    });
  }

  async function loadPreview(group: Group) {
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewGroupId(group.id);
    setPreview(null);

    try {
      const response = await fetch(`/api/groups/${group.id}/preview?phoneChoices=${encodeURIComponent(phoneChoiceQuery)}`, { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) {
        setPreviewError(data.error || 'Could not calculate preview.');
        return;
      }

      setPreview(data);
    } catch (error) {
      setPreviewError('Could not calculate preview.');
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div className="groups-shell">
      <div className="groups-header">
        <div>
          <h1 className="groups-title">Groups</h1>
          <p className="groups-copy">Bussing, class, grade, and smart recipient groups.</p>
        </div>
        <button className="btn btn-primary">New group</button>
      </div>

      <section className="preview-controls">
        <div>
          <p className="card-title">Send SMS to</p>
          <p className="helper-text">SMS previews include parent cell phones only. Home phones are voice-only for later.</p>
        </div>
        <div className="choice-row">
          {(Object.keys(PHONE_CHOICE_LABELS) as PhoneChoice[]).map((choice) => (
            <label className="choice-pill" key={choice}>
              <input
                type="checkbox"
                checked={phoneChoices.includes(choice)}
                onChange={() => togglePhoneChoice(choice)}
              />
              {PHONE_CHOICE_LABELS[choice]}
            </label>
          ))}
        </div>
      </section>

      {loading ? <p className="groups-copy">Loading groups from Airtable...</p> : null}
      {warning ? <p className="groups-copy">{warning}</p> : null}

      {!loading && groups.length === 0 ? (
        <p className="groups-copy">No groups found yet. Add records in Airtable or run the starter group seed route.</p>
      ) : null}

      <div className="group-grid">
        {groups.map((group) => {
          const familyText = `${group.familyCount || 0} families`;
          const detailText = group.rule || (group.studentCount ? `${group.studentCount} students linked` : 'No rule yet');
          const isPreviewingThisGroup = previewGroupId === group.id && previewLoading;

          return (
            <div className="group-card" key={group.id}>
              <div className="group-card-top">
                <h2 className="group-name">{group.name}</h2>
                <span className="group-type">{group.type}</span>
              </div>
              <div className="group-meta">
                <span>{familyText}</span>
                <span>•</span>
                <span>{detailText}</span>
              </div>
              <button className="btn btn-secondary group-preview-button" onClick={() => loadPreview(group)}>
                {isPreviewingThisGroup ? 'Previewing...' : 'Preview SMS recipients'}
              </button>
            </div>
          );
        })}
      </div>

      {previewError ? <p className="preview-error">{previewError}</p> : null}

      {preview ? (
        <section className="preview-panel">
          <div className="preview-panel-header">
            <div>
              <p className="eyebrow">Safe recipient preview</p>
              <h2 className="group-name">{preview.group.name}</h2>
            </div>
            <span className="status-pill">No SMS sent</span>
          </div>

          <div className="preview-stat-grid">
            <PreviewStat label="Families found" value={preview.counts.familiesFound} />
            <PreviewStat label="Phones found" value={preview.counts.phonesFound} />
            <PreviewStat label="Eligible phones" value={preview.counts.eligiblePhonesFound} />
            <PreviewStat label="Final SMS recipients" value={preview.counts.dedupedRecipients} />
          </div>

          <div className="preview-columns">
            <div>
              <p className="card-title">Skipped reasons</p>
              {Object.keys(preview.skippedReasons).length === 0 ? (
                <p className="helper-text">No skipped recipients reported.</p>
              ) : (
                <ul className="preview-list">
                  {Object.entries(preview.skippedReasons).map(([reason, count]) => (
                    <li key={reason}><span>{formatReason(reason)}</span><strong>{count}</strong></li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="card-title">Sample recipients</p>
              {preview.recipients.length === 0 ? (
                <p className="helper-text">No SMS recipients matched the selected choices.</p>
              ) : (
                <ul className="preview-list">
                  {preview.recipients.slice(0, 8).map((recipient) => (
                    <li key={`${recipient.familyId}-${recipient.phoneNumberRecordId}`}>
                      <span>{recipient.familyName}</span>
                      <strong>{PHONE_CHOICE_LABELS[recipient.recipientPhoneChoice as PhoneChoice] || recipient.recipientPhoneChoice}</strong>
                    </li>
                  ))}
                </ul>
              )}
              {preview.recipients.length > 8 ? <p className="helper-text">Showing 8 of {preview.recipients.length} recipients.</p> : null}
            </div>
          </div>

          {preview.notes.length > 0 ? (
            <div className="preview-notes">
              {preview.notes.map((note) => <p className="helper-text" key={note}>{note}</p>)}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="preview-stat">
      <div className="info-label">{label}</div>
      <div className="info-value">{value}</div>
    </div>
  );
}
