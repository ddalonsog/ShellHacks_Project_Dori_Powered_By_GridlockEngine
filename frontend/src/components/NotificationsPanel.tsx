import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

type Notification = {
  id: number;
  project_id: number;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

const demoRanking: Notification[] = [
  {
    id: -1,
    project_id: 1,
    type: 'coordination',
    message:
      'Nova Solar ↔ Bull Creek Solar — Potential high-priority coordination opportunity',
    is_read: false,
    created_at: new Date().toISOString(),
  },
  {
    id: -2,
    project_id: 2,
    type: 'coordination',
    message:
      'Clover Solar ↔ Clover BESS — Projects share the same geographic location',
    is_read: false,
    created_at: new Date().toISOString(),
  },
  {
    id: -3,
    project_id: 3,
    type: 'coordination',
    message:
      'Sand Pine Solar ↔ Big Brook BESS — Nearby infrastructure projects detected',
    is_read: false,
    created_at: new Date().toISOString(),
  },
];

export default function NotificationsPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  async function loadNotifications() {
    try {
      const data = await apiFetch('/notifications');

      const realNotifications = data.notifications || [];

      // Demo fallback for ShellHacks presentation.
      setNotifications(
        realNotifications.length > 0
          ? realNotifications
          : demoRanking
      );
    } catch (error) {
      console.error('Failed to load ranking:', error);

      // Keep the demo usable even if the API is unavailable.
      setNotifications(demoRanking);
    }
  }

  async function markAsRead(id: number) {
    // Demo entries exist only in the frontend.
    if (id < 0) {
      setNotifications((current) =>
        current.filter((notification) => notification.id !== id)
      );
      return;
    }

    try {
      await apiFetch(`/notifications/${id}/read`, {
        method: 'PATCH',
      });

      setNotifications((current) =>
        current.filter((notification) => notification.id !== id)
      );
    } catch (error) {
      console.error('Failed to dismiss ranking item:', error);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  const visibleNotifications = notifications.filter(
    (notification) => !notification.is_read
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 120,
        right: 20,
        zIndex: 1000,
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Coordination Ranking"
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: 'none',
          background: 'white',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          cursor: 'pointer',
          fontSize: 22,
          position: 'relative',
        }}
      >
        🏆

        {visibleNotifications.length > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: 'red',
              color: 'white',
              borderRadius: '50%',
              minWidth: 20,
              height: 20,
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
            }}
          >
            {visibleNotifications.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            marginTop: 10,
            width: 390,
            maxHeight: 440,
            overflowY: 'auto',
            background: 'white',
            borderRadius: 10,
            padding: 16,
            boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 4,
            }}
          >
            <strong style={{ fontSize: 18 }}>
              Coordination Ranking
            </strong>

            <button
              onClick={() => setIsOpen(false)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 18,
              }}
            >
              ✕
            </button>
          </div>

          <div
            style={{
              fontSize: 12,
              color: '#666',
              marginBottom: 14,
            }}
          >
            Prioritized infrastructure coordination opportunities
          </div>

          {visibleNotifications.length === 0 ? (
            <div>No coordination opportunities detected.</div>
          ) : (
            visibleNotifications.map((notification, index) => (
              <div
                key={notification.id}
                style={{
                  padding: 12,
                  marginBottom: 10,
                  borderRadius: 8,
                  background: index === 0 ? '#fff8e1' : '#f8f9fa',
                  border:
                    index === 0
                      ? '1px solid #f0c36d'
                      : '1px solid #ddd',
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 'bold',
                    marginBottom: 6,
                  }}
                >
                  #{index + 1}
                  {index === 0 && ' — Top Priority'}
                </div>

                <div style={{ fontSize: 14 }}>
                  {notification.message}
                </div>

                <button
                  onClick={() => markAsRead(notification.id)}
                  style={{
                    marginTop: 9,
                    padding: '5px 9px',
                    cursor: 'pointer',
                  }}
                >
                  Dismiss
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}