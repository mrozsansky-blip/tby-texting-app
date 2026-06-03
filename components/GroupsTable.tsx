'use client';

import { useEffect, useState } from 'react';

type Group = {
  id: string;
  name: string;
  type: string;
  rule?: string;
  familyCount?: number;
  studentCount?: number;
  active?: boolean;
};

export function GroupsTable() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);

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

  return (
    <div className="groups-shell">
      <div className="groups-header">
        <div>
          <h1 className="groups-title">Groups</h1>
          <p className="groups-copy">Bussing, class, grade, and smart recipient groups.</p>
        </div>
        <button className="btn btn-primary">New group</button>
      </div>

      {loading ? <p className="groups-copy">Loading groups from Airtable...</p> : null}
      {warning ? <p className="groups-copy">{warning}</p> : null}

      {!loading && groups.length === 0 ? (
        <p className="groups-copy">No groups found yet. Add records in Airtable or run the starter group seed route.</p>
      ) : null}

      <div className="group-grid">
        {groups.map((group) => {
          const familyText = `${group.familyCount || 0} families`;
          const detailText = group.rule || (group.studentCount ? `${group.studentCount} students linked` : 'No rule yet');

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
            </div>
          );
        })}
      </div>
    </div>
  );
}
