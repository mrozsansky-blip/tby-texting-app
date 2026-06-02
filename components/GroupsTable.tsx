const groups = [
  { name: 'Bus Route 4 Parents', type: 'Bussing', count: '38 families', rule: 'Bus Route 4' },
  { name: 'Class 6B', type: 'Class', count: '24 families', rule: 'Class 6B' },
  { name: 'Grade 4 Missing Trip Form', type: 'Smart', count: '37 families', rule: 'Grade 4 plus missing form' },
  { name: 'All Families', type: 'School', count: '640 families', rule: 'Active families' }
];

export function GroupsTable() {
  return (
    <div className="groups-shell">
      <div className="groups-header">
        <div>
          <h1 className="groups-title">Groups</h1>
          <p className="groups-copy">Bussing, class, grade, and smart recipient groups.</p>
        </div>
        <button className="btn btn-primary">New group</button>
      </div>
      <div className="group-grid">
        {groups.map((group) => (
          <div className="group-card" key={group.name}>
            <div className="group-card-top">
              <h2 className="group-name">{group.name}</h2>
              <span className="group-type">{group.type}</span>
            </div>
            <div className="group-meta">
              <span>{group.count}</span>
              <span>•</span>
              <span>{group.rule}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
