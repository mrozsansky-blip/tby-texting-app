const groups = [
  ['Bus Route 4 Parents', 'Bussing', '38 families', 'Bus Route 4'],
  ['Class 6B', 'Class', '24 families', 'Class 6B'],
  ['Grade 4 Missing Trip Form', 'Smart', '37 families', 'Grade 4 plus missing form'],
  ['All Families', 'School', '640 families', 'Active families']
];

export function GroupsTable() {
  return (
    <div style={{ borderRadius: 28, background: '#ffffff', padding: 28, boxShadow: '0 18px 60px rgba(15, 23, 42, 0.10)', border: '1px solid #e5e7eb', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Groups</h1>
          <p style={{ margin: '8px 0 0', color: '#64748b' }}>Bussing, class, grade, and smart recipient groups.</p>
        </div>
        <button style={{ border: 0, borderRadius: 14, background: '#0f172a', color: '#fff', padding: '12px 16px', fontWeight: 800 }}>New group</button>
      </div>
      <div style={{ marginTop: 22, border: '1px solid #e5e7eb', borderRadius: 18, overflow: 'hidden' }}>
        {groups.map((group, index) => (
          <div key={group[0]} style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr 0.8fr 1.2fr', gap: 12, padding: 16, background: index % 2 === 0 ? '#fbfdff' : '#ffffff', borderTop: index === 0 ? 0 : '1px solid #eef2f7' }}>
            <strong>{group[0]}</strong>
            <span>{group[1]}</span>
            <span>{group[2]}</span>
            <span style={{ color: '#64748b' }}>{group[3]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
