export function GroupsTable() {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold">Groups</h1>
      <p className="mt-2 text-gray-600">Bussing, class, grade, and smart recipient groups will show here.</p>
      <div className="mt-6 grid gap-3">
        <div className="rounded-2xl border border-gray-200 p-4">Bus Route 4 Parents</div>
        <div className="rounded-2xl border border-gray-200 p-4">Class 6B</div>
        <div className="rounded-2xl border border-gray-200 p-4">Grade 4 Missing Trip Form</div>
        <div className="rounded-2xl border border-gray-200 p-4">All Families</div>
      </div>
    </div>
  );
}
