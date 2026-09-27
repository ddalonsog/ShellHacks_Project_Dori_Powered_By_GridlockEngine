import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import { apiFetch } from '../api';
import Filters, { type FilterValues } from './Filters';
import ConflictPanel from './ConflictPanel';
import ProjectForm from './ProjectForm';
import NotificationsPanel from './NotificationsPanel';

type ProjectCollection = {
  type: 'FeatureCollection';
  features: any[];
};

type Conflict = {
  project_id: number;
  project_title: string;
  conflict_id: number;
  conflict_title: string;
  distance_meters: number;
  dates: {
    project_start: string;
    project_end: string;
    conflict_start: string;
    conflict_end: string;
  };
};

const initialFilters: FilterValues = {
  search: '',
  category: '',
  status: '',
  minVoltage: '',
  maxVoltage: '',
};

export default function GridMap() {
  const [projects, setProjects] = useState<ProjectCollection>({
    type: 'FeatureCollection',
    features: [],
  });

  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [filters, setFilters] = useState<FilterValues>(initialFilters);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [projectData, conflictData] = await Promise.all([
          apiFetch('/projects'),
          apiFetch('/conflicts'),
        ]);

        setProjects(projectData);
        setConflicts(conflictData.conflicts);
      } catch (error) {
        console.error('Failed to load GridLock data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const conflictIds = new Set<number>();

  conflicts.forEach((conflict) => {
    conflictIds.add(conflict.project_id);
    conflictIds.add(conflict.conflict_id);
  });

  const filteredFeatures = projects.features.filter((feature) => {
    const properties = feature.properties;

    const matchesSearch =
      !filters.search ||
      properties.title
        ?.toLowerCase()
        .includes(filters.search.toLowerCase());

    const matchesCategory =
      !filters.category ||
      properties.category === filters.category;

    const matchesStatus =
      !filters.status ||
      properties.status === filters.status;

    const voltage = Number(properties.voltage_kv);

    const matchesMinVoltage =
      !filters.minVoltage || voltage >= Number(filters.minVoltage);

    const matchesMaxVoltage =
      !filters.maxVoltage || voltage <= Number(filters.maxVoltage);

    return (
      matchesSearch &&
      matchesCategory &&
      matchesStatus &&
      matchesMinVoltage &&
      matchesMaxVoltage
    );
  });

  if (loading) {
    return <div>Loading GridLock map...</div>;
  }

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <Filters filters={filters} onChange={setFilters} />
        <NotificationsPanel />
        <ProjectForm
  onProjectCreated={() => {
    window.location.reload();
  }}
/>
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          zIndex: 1000,
          background: 'white',
          padding: '8px 12px',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        Showing {filteredFeatures.length} of {projects.features.length} projects
      </div>

      <ConflictPanel conflicts={conflicts} />

      <MapContainer
        center={[25.7608877, -80.4170414]}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {filteredFeatures.map((feature) => {
          const projectId = feature.properties.id;
          const isConflict = conflictIds.has(projectId);

          const relatedConflicts = conflicts.filter(
            (conflict) =>
              conflict.project_id === projectId ||
              conflict.conflict_id === projectId
          );

          return (
            <GeoJSON
              key={`${projectId}-${isConflict}`}
              data={feature}
              style={() => ({
                color: isConflict ? 'red' : 'blue',
                weight: isConflict ? 6 : 4,
              })}
              onEachFeature={(currentFeature, layer) => {
                const properties = currentFeature.properties;

                const conflictText = relatedConflicts
                  .map((conflict) => {
                    const otherProject =
                      conflict.project_id === projectId
                        ? conflict.conflict_title
                        : conflict.project_title;

                    return `
                      <br/><br/>
                      <strong style="color:red;">
                        ⚠️ Conflict detected
                      </strong>
                      <br/>
                      Conflicts with: <strong>${otherProject}</strong>
                      <br/>
                      Distance: ${conflict.distance_meters.toFixed(2)} m
                    `;
                  })
                  .join('');

                layer.bindPopup(`
                  <strong>${properties.title}</strong><br/>
                  Category: ${properties.category}<br/>
                  Subtype: ${properties.subtype}<br/>
                  Voltage: ${properties.voltage_kv} kV<br/>
                  Status: ${properties.status}<br/>
                  Dates: ${properties.start_date} → ${properties.end_date}
                  ${conflictText}
                `);
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}