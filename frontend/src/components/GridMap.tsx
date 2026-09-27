import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { apiFetch } from '../api';
import Filters, { type FilterValues } from './Filters';
import ConflictPanel from './ConflictPanel';
import ProjectForm from './ProjectForm';
import NotificationsPanel from './NotificationsPanel';
import CollaborationPanel from './CollaborationPanel';

type BackendProject = {
  id: number;
  utility_id: number;
  utility?: string;
  external_id?: string | null;

  title: string;
  category?: string;
  subtype?: string;

  entity_type?: string;
  infrastructure_type?: string | null;
  technology?: string | null;

  voltage_kv?: number | null;
  capacity_mw?: string | number | null;

  county?: string | null;
  state?: string | null;
  address?: string | null;

  latitude?: number | null;
  longitude?: number | null;

  start_year?: number | null;
  end_year?: number | null;

  start_date?: string | null;
  end_date?: string | null;

  construction_start_text?: string | null;
  commercial_service_text?: string | null;

  status?: string;
  is_tbd?: boolean;

  description?: string | null;
};

type ProjectCollection = {
  type: 'FeatureCollection';
  features: any[];
};

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

const initialFilters: FilterValues = {
  search: '',
  category: '',
  status: '',
  minVoltage: '',
  maxVoltage: '',
};

export default function GridMap() {
  const [allProjects, setAllProjects] =
    useState<BackendProject[]>([]);

  const [projects, setProjects] =
    useState<ProjectCollection>({
      type: 'FeatureCollection',
      features: [],
    });

  const [conflicts, setConflicts] =
    useState<Conflict[]>([]);

  const [filters, setFilters] =
    useState<FilterValues>(initialFilters);

  const [loading, setLoading] =
    useState(true);

  const [showUnmapped, setShowUnmapped] =
    useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [projectData, conflictData] =
          await Promise.all([
            apiFetch('/projects'),
            apiFetch('/conflicts'),
          ]);

        const backendProjects: BackendProject[] =
          Array.isArray(projectData)
            ? projectData
            : [];

        setAllProjects(backendProjects);

        // Only projects with coordinates can be
        // represented on the Leaflet map.
        const geoJsonProjects: ProjectCollection = {
          type: 'FeatureCollection',

          features: backendProjects
            .filter(
              (project) =>
                project.latitude != null &&
                project.longitude != null
            )
            .map((project) => ({
              type: 'Feature',

              geometry: {
                type: 'Point',

                coordinates: [
                  Number(project.longitude),
                  Number(project.latitude),
                ],
              },

              properties: {
                ...project,
              },
            })),
        };

        setProjects(geoJsonProjects);

        if (Array.isArray(conflictData)) {
          setConflicts(conflictData);
        } else if (
          Array.isArray(conflictData?.conflicts)
        ) {
          setConflicts(conflictData.conflicts);
        } else {
          setConflicts([]);
        }
      } catch (error) {
        console.error(
          'Failed to load GridLock data:',
          error
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // ==========================================================
  // PROJECTS INVOLVED IN CONFLICTS
  // ==========================================================

  const conflictIds = new Set<number>();

  conflicts.forEach((conflict) => {
    conflictIds.add(conflict.project1_id);
    conflictIds.add(conflict.project2_id);
  });

  // ==========================================================
  // MAP FILTERS
  // ==========================================================

  const filteredFeatures =
    projects.features.filter((feature) => {
      const properties =
        feature.properties;

      const matchesSearch =
        !filters.search ||
        properties.title
          ?.toLowerCase()
          .includes(
            filters.search.toLowerCase()
          );

      const matchesCategory =
        !filters.category ||
        properties.category ===
          filters.category;

      const matchesStatus =
        !filters.status ||
        properties.status ===
          filters.status;

      const voltage =
        Number(properties.voltage_kv);

      const matchesMinVoltage =
        !filters.minVoltage ||
        (
          !Number.isNaN(voltage) &&
          voltage >=
            Number(filters.minVoltage)
        );

      const matchesMaxVoltage =
        !filters.maxVoltage ||
        (
          !Number.isNaN(voltage) &&
          voltage <=
            Number(filters.maxVoltage)
        );

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus &&
        matchesMinVoltage &&
        matchesMaxVoltage
      );
    });

  // ==========================================================
  // PROJECTS WITHOUT PRECISE LOCATION
  // ==========================================================

  const unmappedProjects =
    allProjects.filter(
      (project) =>
        project.latitude == null ||
        project.longitude == null
    );

  const countyKnownProjects =
    unmappedProjects.filter(
      (project) =>
        Boolean(project.county)
    );

  const unsitedProjects =
    unmappedProjects.filter(
      (project) =>
        !project.county
    );

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <div>
        Loading GridLock map...
      </div>
    );
  }

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: '#f5f5f5',
      }}
    >
      {/* =====================================================
          MAP
          ===================================================== */}

      <div
        style={{
          position: 'relative',
          height: '70vh',
          width: '100%',
        }}
      >
        <Filters
          filters={filters}
          onChange={setFilters}
        />

        <NotificationsPanel />

        <CollaborationPanel />

        <ProjectForm
          onProjectCreated={() => {
            window.location.reload();
          }}
        />

        {/* MAP PROJECT COUNTER */}

        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            zIndex: 1000,
            background: 'white',
            padding: '8px 12px',
            borderRadius: 8,
            boxShadow:
              '0 2px 8px rgba(0,0,0,0.2)',
            color: '#222',
          }}
        >
          Showing{' '}
          {filteredFeatures.length} of{' '}
          {projects.features.length}{' '}
          located projects
        </div>

        {/* CONFLICT PANEL */}

        <ConflictPanel
          conflicts={conflicts}
        />

        {/* LEAFLET MAP */}

        <MapContainer
          center={[27.8, -81.7]}
          zoom={7}
          style={{
            height: '100%',
            width: '100%',
          }}
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          {filteredFeatures.map(
            (feature) => {
              const projectId =
                feature.properties.id;

              const isConflict =
                conflictIds.has(projectId);

              // Find every conflict involving
              // this specific project.
              const relatedConflicts =
                conflicts.filter(
                  (conflict) =>
                    conflict.project1_id ===
                      projectId ||
                    conflict.project2_id ===
                      projectId
                );

              return (
                <GeoJSON
                  key={`${projectId}-${isConflict}`}
                  data={feature}

                  style={() => ({
                    color: isConflict
                      ? 'red'
                      : 'blue',

                    weight: isConflict
                      ? 6
                      : 4,
                  })}

                  pointToLayer={(
                    _feature,
                    latlng
                  ) => {
                    return L.circleMarker(
                      latlng,
                      {
                        radius: isConflict
                          ? 9
                          : 7,

                        color: isConflict
                          ? 'red'
                          : 'blue',

                        weight: isConflict
                          ? 3
                          : 2,

                        fillOpacity: 0.8,
                      }
                    );
                  }}

                  onEachFeature={(
                    currentFeature,
                    layer
                  ) => {
                    const properties =
                      currentFeature.properties;

                    // -----------------------------------------
                    // CONFLICT INFORMATION FOR POPUP
                    // -----------------------------------------

                    const conflictText =
                      relatedConflicts
                        .map((conflict) => {
                          const otherProject =
                            conflict.project1_id ===
                            projectId
                              ? conflict.project2_title
                              : conflict.project1_title;

                          const otherUtility =
                            conflict.project1_id ===
                            projectId
                              ? conflict.utility2_name
                              : conflict.utility1_name;

                          const distanceKm =
                            Number(
                              conflict.distance_km
                            );

                          return `
                            <br/><br/>

                            <strong style="color:red;">
                              ⚠️ Coordination conflict detected
                            </strong>

                            <br/>

                            Conflicts with:
                            <strong>
                              ${otherProject}
                            </strong>

                            <br/>

                            Utility:
                            ${otherUtility}

                            <br/>

                            Distance:
                            ${
                              Number.isFinite(
                                distanceKm
                              )
                                ? distanceKm.toFixed(
                                    2
                                  )
                                : 'Unknown'
                            } km

                            ${
                              conflict.overlap_days >
                              0
                                ? `
                                  <br/>
                                  Timeline overlap:
                                  ${conflict.overlap_days}
                                  days
                                `
                                : ''
                            }
                          `;
                        })
                        .join('');

                    // -----------------------------------------
                    // TIMELINE DISPLAY
                    // -----------------------------------------

                    const startText =
                      properties.start_date ||
                      properties
                        .construction_start_text ||
                      properties.start_year ||
                      'Unknown';

                    const endText =
                      properties.end_date ||
                      properties
                        .commercial_service_text ||
                      properties.end_year ||
                      'Unknown';

                    // -----------------------------------------
                    // POPUP
                    // -----------------------------------------

                    layer.bindPopup(`
                      <strong>
                        ${properties.title}
                      </strong>

                      <br/>

                      Utility:
                      ${
                        properties.utility ??
                        'Unknown'
                      }

                      <br/>

                      Category:
                      ${
                        properties.category ??
                        'Unknown'
                      }

                      <br/>

                      Subtype:
                      ${
                        properties.subtype ??
                        'Unknown'
                      }

                      <br/>

                      Voltage:
                      ${
                        properties.voltage_kv !=
                        null
                          ? `${properties.voltage_kv} kV`
                          : 'Unknown'
                      }

                      <br/>

                      Capacity:
                      ${
                        properties.capacity_mw !=
                        null
                          ? `${properties.capacity_mw} MW`
                          : 'Unknown'
                      }

                      <br/>

                      Status:
                      ${
                        properties.status ??
                        'Unknown'
                      }

                      <br/>

                      County:
                      ${
                        properties.county ??
                        'Unknown'
                      }

                      <br/>

                      Dates:
                      ${startText}
                      →
                      ${endText}

                      ${conflictText}
                    `);
                  }}
                />
              );
            }
          )}
        </MapContainer>
      </div>

      {/* =====================================================
          PROJECTS WITHOUT PRECISE LOCATION
          ===================================================== */}

      <div
        style={{
          padding: 24,
          background: 'white',
          borderTop: '1px solid #ddd',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems: 'center',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color: '#222',
              }}
            >
              Projects without precise
              location
            </h2>

            <p
              style={{
                margin: '6px 0 0',
                color: '#666',
              }}
            >
              {unmappedProjects.length}{' '}
              projects cannot currently be
              placed precisely on the map.{' '}

              {countyKnownProjects.length}{' '}
              have a known county and{' '}

              {unsitedProjects.length}{' '}
              have no county-level location.
            </p>
          </div>

          <button
            onClick={() =>
              setShowUnmapped(
                !showUnmapped
              )
            }
            style={{
              padding: '8px 14px',
              cursor: 'pointer',
            }}
          >
            {showUnmapped
              ? 'Hide table'
              : 'Show table'}
          </button>
        </div>

        {showUnmapped && (
          <div
            style={{
              overflowX: 'auto',
              maxHeight: 500,
              overflowY: 'auto',
              border: '1px solid #ddd',
              borderRadius: 8,
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse:
                  'collapse',
                minWidth: 900,
                color: '#222',
              }}
            >
              <thead>
                <tr
                  style={{
                    background:
                      '#f3f3f3',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  <th style={headerStyle}>
                    Utility
                  </th>

                  <th style={headerStyle}>
                    Project
                  </th>

                  <th style={headerStyle}>
                    Category
                  </th>

                  <th style={headerStyle}>
                    County
                  </th>

                  <th style={headerStyle}>
                    State
                  </th>

                  <th style={headerStyle}>
                    Status
                  </th>

                  <th style={headerStyle}>
                    Location
                  </th>
                </tr>
              </thead>

              <tbody>
                {unmappedProjects.map(
                  (project) => {
                    const hasCounty =
                      Boolean(
                        project.county
                      );

                    return (
                      <tr
                        key={project.id}
                      >
                        <td
                          style={cellStyle}
                        >
                          {project.utility ??
                            'Unknown'}
                        </td>

                        <td
                          style={cellStyle}
                        >
                          <strong>
                            {project.title}
                          </strong>
                        </td>

                        <td
                          style={cellStyle}
                        >
                          {project.category ??
                            'Unknown'}
                        </td>

                        <td
                          style={cellStyle}
                        >
                          {project.county ??
                            '—'}
                        </td>

                        <td
                          style={cellStyle}
                        >
                          {project.state ??
                            '—'}
                        </td>

                        <td
                          style={cellStyle}
                        >
                          {project.status ??
                            'Unknown'}
                        </td>

                        <td
                          style={cellStyle}
                        >
                          {hasCounty
                            ? 'County known — precise coordinates missing'
                            : project.is_tbd
                            ? 'TBD / unsited'
                            : 'Location unavailable'}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


// ============================================================
// TABLE STYLES
// ============================================================

const headerStyle = {
  textAlign: 'left' as const,
  padding: '12px',
  borderBottom: '1px solid #ccc',
  whiteSpace: 'nowrap' as const,
};

const cellStyle = {
  padding: '10px 12px',
  borderBottom: '1px solid #eee',
  verticalAlign: 'top' as const,
};