import { useState } from 'react';

type Conflict = {
  project1_id: number;
  project1_title: string;
  project1_category?: string;
  utility1_id: number;
  utility1_name: string;

  project2_id: number;
  project2_title: string;
  project2_category?: string;
  utility2_id: number;
  utility2_name: string;

  distance_km: string | number;
  distance_miles: string | number;

  timelines_overlap: boolean;
  start_year_gap: number | null;
  overlap_days: number;

  temporal_relationship?: string;
  infrastructure_compatible?: boolean;

  reasons?: string[];
};

type ConflictPanelProps = {
  conflicts: Conflict[];
};

export default function ConflictPanel({
  conflicts,
}: ConflictPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 1000,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'white',
          border: 'none',
          borderRadius: 10,
          padding: '10px 14px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          fontSize: 15,
          fontWeight: 600,
          color: '#222',
        }}
      >
        ⚠️ {conflicts.length} Conflict
        {conflicts.length !== 1 ? 's' : ''}

        <span style={{ marginLeft: 8 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div
          style={{
            marginTop: 8,
            width: 340,
            maxHeight: '70vh',
            overflowY: 'auto',
            background: 'white',
            padding: 16,
            borderRadius: 10,
            boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
            color: '#222',
          }}
        >
          <h3
            style={{
              marginTop: 0,
              marginBottom: 6,
            }}
          >
            ⚠️ Project Conflicts
          </h3>

          <p
            style={{
              marginTop: 0,
              color: '#555',
            }}
          >
            {conflicts.length === 0
              ? 'No conflicts detected.'
              : `${conflicts.length} conflict${
                  conflicts.length === 1 ? '' : 's'
                } detected.`}
          </p>

          {conflicts.map((conflict) => {
            const distanceKm = Number(conflict.distance_km);
            const distanceMiles = Number(
              conflict.distance_miles
            );

            return (
              <div
                key={`${conflict.project1_id}-${conflict.project2_id}`}
                style={{
                  borderTop: '1px solid #ddd',
                  paddingTop: 12,
                  marginTop: 12,
                }}
              >
                <strong>
                  {conflict.project1_title}
                </strong>

                <div
                  style={{
                    fontSize: 13,
                    color: '#666',
                    marginTop: 3,
                  }}
                >
                  {conflict.utility1_name}
                </div>

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

                <strong>
                  {conflict.project2_title}
                </strong>

                <div
                  style={{
                    fontSize: 13,
                    color: '#666',
                    marginTop: 3,
                  }}
                >
                  {conflict.utility2_name}
                </div>

                <div
                  style={{
                    marginTop: 10,
                    fontSize: 14,
                    color: '#555',
                  }}
                >
                  <strong>Distance:</strong>{' '}
                  {Number.isFinite(distanceKm)
                    ? distanceKm.toFixed(2)
                    : 'Unknown'}{' '}
                  km

                  {Number.isFinite(distanceMiles) &&
                    ` (${distanceMiles.toFixed(2)} mi)`}
                </div>

                <div
                  style={{
                    marginTop: 5,
                    fontSize: 14,
                    color: '#555',
                  }}
                >
                  <strong>Timeline:</strong>{' '}

                  {conflict.timelines_overlap
                    ? `Overlapping${
                        conflict.overlap_days > 0
                          ? ` for ${conflict.overlap_days} days`
                          : ''
                      }`
                    : conflict.temporal_relationship ||
                      'Within coordination window'}
                </div>

                {typeof conflict.infrastructure_compatible ===
                  'boolean' && (
                  <div
                    style={{
                      marginTop: 5,
                      fontSize: 14,
                      color: '#555',
                    }}
                  >
                    <strong>
                      Infrastructure compatible:
                    </strong>{' '}

                    {conflict.infrastructure_compatible
                      ? 'Yes'
                      : 'No'}
                  </div>
                )}

                {conflict.reasons &&
                  conflict.reasons.length > 0 && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 8,
                        background: '#f7f7f7',
                        borderRadius: 6,
                        fontSize: 13,
                      }}
                    >
                      <strong>
                        Why coordination was flagged:
                      </strong>

                      <ul
                        style={{
                          marginTop: 6,
                          marginBottom: 0,
                          paddingLeft: 18,
                        }}
                      >
                        {conflict.reasons.map(
                          (reason, index) => (
                            <li
                              key={index}
                              style={{
                                marginBottom: 4,
                              }}
                            >
                              {reason}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}