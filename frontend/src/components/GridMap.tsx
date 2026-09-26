import { useEffect, useState } from 'react';
import {
  GeoJSON,
  MapContainer,
  TileLayer,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { apiFetch } from '../api';

type Project = {
  id: number;
  title: string;
  utility_name?: string;
  category: string;
  subtype: string;
  voltage_kv?: number;
  status: string;
  start_date: string;
  end_date: string;
  has_conflict?: boolean;
  geometry: GeoJSON.Geometry;
};

type ProjectCollection = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: GeoJSON.Geometry;
    properties: Project;
  }>;
};

export default function GridMap() {
  const [projects, setProjects] = useState<ProjectCollection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await apiFetch('/projects');
        setProjects(data);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to load projects'
        );
      }
    }

    loadProjects();
  }, []);

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <MapContainer
        center={[27.5, -81.5]}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {projects && (
          <GeoJSON
            data={projects}
            style={(feature) => ({
              color: feature?.properties?.has_conflict ? 'red' : 'cyan',
              weight: 4,
            })}
            onEachFeature={(feature, layer) => {
              const project = feature.properties as Project;

              layer.bindPopup(`
                <strong>${project.title}</strong><br />
                Utility: ${project.utility_name ?? 'Unknown'}<br />
                Category: ${project.category}<br />
                Subtype: ${project.subtype}<br />
                Voltage: ${project.voltage_kv ?? 'N/A'} kV<br />
                Status: ${project.status}<br />
                Timeline: ${project.start_date} → ${project.end_date}
              `);
            }}
          />
        )}

        {error && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 1000,
              background: 'white',
              padding: '10px',
              borderRadius: '6px',
              color: 'red',
            }}
          >
            API: {error}
          </div>
        )}
      </MapContainer>
    </div>
  );
}
