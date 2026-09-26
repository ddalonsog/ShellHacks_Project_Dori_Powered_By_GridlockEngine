type Conflict = {
  project_id: number;
  project_title: string;
  conflict_id: number;
  conflict_title: string;
  distance_meters: number;
};

type ConflictPanelProps = {
  conflicts: Conflict[];
};

export default function ConflictPanel({
  conflicts,
}: ConflictPanelProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 90,
        right: 20,
        zIndex: 1000,
        width: 300,
        maxHeight: '70vh',
        overflowY: 'auto',
        background: 'white',
        padding: 16,
        borderRadius: 10,
        boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 6 }}>
        ⚠️ Project Conflicts
      </h3>

      <p style={{ marginTop: 0, color: '#555' }}>
        {conflicts.length === 0
          ? 'No conflicts detected.'
          : `${conflicts.length} conflict${
              conflicts.length === 1 ? '' : 's'
            } detected.`}
      </p>

      {conflicts.map((conflict) => (
        <div
          key={`${conflict.project_id}-${conflict.conflict_id}`}
          style={{
            borderTop: '1px solid #ddd',
            paddingTop: 12,
            marginTop: 12,
          }}
        >
          <strong>{conflict.project_title}</strong>

          <div
            style={{
              textAlign: 'center',
              margin: '8px 0',
              color: '#777',
              fontSize: 18,
            }}
          >
            ↕
          </div>

          <strong>{conflict.conflict_title}</strong>

          <div
            style={{
              marginTop: 8,
              fontSize: 14,
              color: '#555',
            }}
          >
            Distance: {conflict.distance_meters.toFixed(2)} m
          </div>
        </div>
      ))}
    </div>
  );
}
