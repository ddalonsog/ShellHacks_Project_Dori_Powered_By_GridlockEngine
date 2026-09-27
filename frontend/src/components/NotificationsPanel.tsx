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

export default function NotificationsPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  async function loadNotifications() {
    try {
      const data = await apiFetch('/notifications');
      setNotifications(data.notifications);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }

  async function markAsRead(id: number) {
    try {
      await apiFetch(`/notifications/${id}/read`, {
        method: 'PATCH',
      });

      setNotifications((current) =>
        current.filter((notification) => notification.id !== id)
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

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
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: 'none',
          background: 'white',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          cursor: 'pointer',
          fontSize: 22,
        }}
      >
        🔔
        {unreadCount > 0 && (
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
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            marginTop: 10,
            width: 320,
            maxHeight: 400,
            overflowY: 'auto',
            background: 'white',
            borderRadius: 8,
            padding: 16,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <strong>Notifications</strong>

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

          {notifications.length === 0 ? (
            <div>No new notifications.</div>
          ) : (
            notifications
              .filter((notification) => !notification.is_read)
              .map((notification) => (
                <div
                  key={notification.id}
                  style={{
                    padding: 10,
                    marginBottom: 8,
                    borderRadius: 6,
                    background: '#fff3f3',
                    border: '1px solid #ddd',
                  }}
                >
                  <div style={{ fontSize: 14 }}>
                    {notification.message}
                  </div>

                  <button
                    onClick={() => markAsRead(notification.id)}
                    style={{
                      marginTop: 8,
                      padding: '5px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    Mark as read
                  </button>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
}