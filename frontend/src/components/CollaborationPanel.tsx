import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

type CollaborationRequest = {
  id: number;
  project_id: number;
  project_title: string;
  sender_utility_id: number;
  recipient_utility_id: number;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
};

export default function CollaborationPanel() {
  const [requests, setRequests] = useState<CollaborationRequest[]>([]);
  const [currentUtilityId, setCurrentUtilityId] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  async function loadRequests() {
    try {
      const data = await apiFetch('/collaborations');
      setRequests(data.requests);
    } catch (error) {
      console.error('Failed to load collaboration requests:', error);
    }
  }

 async function loadCurrentUser() {
  try {
    const data = await apiFetch('/auth/me');
    setCurrentUtilityId(data.utility_id);
  } catch (error) {
    console.error('Failed to load current user:', error);
  }
}

  async function updateRequest(
    id: number,
    status: 'accepted' | 'declined'
  ) {
    try {
      await apiFetch(`/collaborations/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });

      loadRequests();
    } catch (error) {
      console.error('Failed to update collaboration request:', error);
    }
  }

  useEffect(() => {
    loadCurrentUser();
    loadRequests();
  }, []);

  const receivedRequests = requests.filter(
    (request) =>
      request.recipient_utility_id === currentUtilityId
  );

  const sentRequests = requests.filter(
    (request) =>
      request.sender_utility_id === currentUtilityId
  );

  const pendingReceived = receivedRequests.filter(
    (request) => request.status === 'pending'
  ).length;

  function renderRequest(
    request: CollaborationRequest,
    isReceived: boolean
  ) {
    return (
      <div
        key={request.id}
        style={{
          padding: 10,
          marginBottom: 8,
          borderRadius: 6,
          background:
            request.status === 'pending' ? '#fff8e1' : '#f5f5f5',
          border: '1px solid #ddd',
        }}
      >
        <strong>{request.project_title}</strong>

        <div style={{ fontSize: 13, marginTop: 5 }}>
          From Utility {request.sender_utility_id}
        </div>

        <div style={{ fontSize: 13, marginTop: 5 }}>
          To Utility {request.recipient_utility_id}
        </div>

        {request.message && (
          <div
            style={{
              fontSize: 13,
              marginTop: 8,
              fontStyle: 'italic',
            }}
          >
            "{request.message}"
          </div>
        )}

        <div
          style={{
            marginTop: 8,
            fontSize: 13,
            fontWeight: 'bold',
          }}
        >
          Status: {request.status}
        </div>

        {isReceived && request.status === 'pending' && (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() =>
                updateRequest(request.id, 'accepted')
              }
              style={{
                marginRight: 6,
                padding: '5px 8px',
                cursor: 'pointer',
              }}
            >
              Accept
            </button>

            <button
              onClick={() =>
                updateRequest(request.id, 'declined')
              }
              style={{
                padding: '5px 8px',
                cursor: 'pointer',
              }}
            >
              Decline
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 180,
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
        🤝

        {pendingReceived > 0 && (
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
            {pendingReceived}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            marginTop: 10,
            width: 340,
            maxHeight: 450,
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
            <strong>Collaboration Requests</strong>

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

          <div style={{ marginBottom: 16 }}>
            <strong>Received</strong>

            {receivedRequests.length === 0 ? (
              <div style={{ marginTop: 8, fontSize: 13 }}>
                No received requests.
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                {receivedRequests.map((request) =>
                  renderRequest(request, true)
                )}
              </div>
            )}
          </div>

          <div>
            <strong>Sent</strong>

            {sentRequests.length === 0 ? (
              <div style={{ marginTop: 8, fontSize: 13 }}>
                No sent requests.
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                {sentRequests.map((request) =>
                  renderRequest(request, false)
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}