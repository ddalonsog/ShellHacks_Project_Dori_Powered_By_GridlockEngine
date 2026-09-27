import { useState, type FormEvent } from 'react';
import { apiFetch } from '../api';

type ProjectFormProps = {
  onProjectCreated?: () => void;
};

export default function ProjectForm({
  onProjectCreated,
}: ProjectFormProps) {
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Transmission');
  const [subtype, setSubtype] = useState('');
  const [voltage, setVoltage] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('Planned');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setMessage('');
    setError('');
    setSubmitting(true);

    try {
      await apiFetch('/projects', {
        method: 'POST',
        body: JSON.stringify({
          title,
          category,
          subtype,
          voltage_kv: voltage ? Number(voltage) : null,
          start_date: startDate,
          end_date: endDate,
          status,
          latitude: Number(latitude),
          longitude: Number(longitude),
        }),
      });

      setMessage('Project created successfully.');

      setTitle('');
      setSubtype('');
      setVoltage('');
      setStartDate('');
      setEndDate('');
      setLatitude('');
      setLongitude('');

      onProjectCreated?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create project.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
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
        ➕ Add Project
        <span style={{ marginLeft: 8 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <form
          onSubmit={handleSubmit}
          style={{
            marginTop: 8,
            width: 260,
            maxHeight: '70vh',
            overflowY: 'auto',
            background: 'white',
            padding: 16,
            borderRadius: 10,
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Add Project</h3>

          <label>
            Project name
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 4,
                marginBottom: 10,
              }}
            />
          </label>

          <label>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 4,
                marginBottom: 10,
              }}
            >
              <option value="Transmission">Transmission</option>
              <option value="Generation & Storage Integration">
                Generation & Storage Integration
              </option>
              <option value="Substations">Substations</option>
              <option value="Grid Hardening & Resilience">
                Grid Hardening & Resilience
              </option>
            </select>
          </label>

          <label>
            Subtype
            <input
              type="text"
              value={subtype}
              onChange={(e) => setSubtype(e.target.value)}
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 4,
                marginBottom: 10,
              }}
            />
          </label>

          <label>
            Voltage (kV)
            <input
              type="number"
              value={voltage}
              onChange={(e) => setVoltage(e.target.value)}
              min="0"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 4,
                marginBottom: 10,
              }}
            />
          </label>

          <label>
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 4,
                marginBottom: 10,
              }}
            />
          </label>

          <label>
            End date
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 4,
                marginBottom: 10,
              }}
            />
          </label>

          <label>
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 4,
                marginBottom: 10,
              }}
            >
              <option value="Planned">Planned</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
            </select>
          </label>

          <label>
            Latitude
            <input
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              required
              placeholder="e.g. 25.7617"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 4,
                marginBottom: 10,
              }}
            />
          </label>

          <label>
            Longitude
            <input
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              required
              placeholder="e.g. -80.1918"
              style={{
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              marginTop: 10,
              padding: '10px 14px',
              cursor: submitting ? 'default' : 'pointer',
            }}
          >
            {submitting ? 'Creating...' : 'Create Project'}
          </button>

          {message && (
            <p style={{ color: 'green', marginBottom: 0 }}>{message}</p>
          )}

          {error && (
            <p style={{ color: 'red', marginBottom: 0 }}>{error}</p>
          )}
        </form>
      )}
    </div>
  );
}