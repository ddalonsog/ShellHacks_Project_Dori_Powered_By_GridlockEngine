import { useState, type ChangeEvent } from 'react';

export type FilterValues = {
  search: string;
  category: string;
  status: string;
  minVoltage: string;
  maxVoltage: string;
};

type FiltersProps = {
  filters: FilterValues;
  onChange: (filters: FilterValues) => void;
};

export default function Filters({ filters, onChange }: FiltersProps) {
  const [open, setOpen] = useState(false);

  const handleChange =
    (field: keyof FilterValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      onChange({
        ...filters,
        [field]: event.target.value,
      });
    };

  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        left: 20,
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
        }}
      >
        🔎 Filters
        {activeFilters > 0 && ` (${activeFilters})`}
        <span style={{ marginLeft: 8 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          style={{
            marginTop: 8,
            width: 260,
            background: 'white',
            padding: 16,
            borderRadius: 10,
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Project Filters</h3>

          <label>
            Search
            <input
              type="text"
              value={filters.search}
              onChange={handleChange('search')}
              placeholder="Project name..."
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
              value={filters.category}
              onChange={handleChange('category')}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 4,
                marginBottom: 10,
              }}
            >
              <option value="">All categories</option>
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
            Status
            <select
              value={filters.status}
              onChange={handleChange('status')}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 4,
                marginBottom: 10,
              }}
            >
              <option value="">All statuses</option>
              <option value="Planned">Planned</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
            </select>
          </label>

          <label>
            Minimum voltage (kV)
            <input
              type="number"
              value={filters.minVoltage}
              onChange={handleChange('minVoltage')}
              placeholder="e.g. 115"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 4,
                marginBottom: 10,
              }}
            />
          </label>

          <label>
            Maximum voltage (kV)
            <input
              type="number"
              value={filters.maxVoltage}
              onChange={handleChange('maxVoltage')}
              placeholder="e.g. 500"
              style={{
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}