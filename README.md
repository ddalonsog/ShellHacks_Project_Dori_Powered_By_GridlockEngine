# ⚡ GridLock — Coordinated Power Grid Infrastructure Platform

> **ShellHacks 2026 Project**  
> *Real-time spatial and temporal overlap detection for power grid construction projects.*

---

## 📌 Problem Statement

Power grid companies (*utilities*) plan large-scale infrastructure and construction projects years in advance. However, neighboring utilities in adjacent states or territories historically plan in complete isolation with little visibility into nearby ongoing or planned work.

This lack of coordination leads to:
* **Duplicate spending** on machinery, heavy equipment, and specialized labor.
* **Severe delays** in building a reliable, interconnected grid.
* **Resource bottlenecks** in regional power transmission.

In **2024, federal regulators (FERC Order 1920)** mandated long-term regional transmission planning because isolated utility planning results in systemic waste and grid instability.

---

## 🚀 Solution

**GridLock** is a geospatial platform that ingests public construction plans across neighboring utilities, visualizes them on an interactive map, and automatically flags **spatial and temporal overlaps**.

By detecting projects that are physically close and scheduled within matching timeframes, GridLock enables utilities to:
1. **Share critical resources** (heavy machinery, cranes, specialized crews, logistics).
2. **Co-locate infrastructure** to minimize environmental impact and land acquisition costs.
3. **Send formal collaboration requests** directly through the platform.

---

## ✨ Key Features

* 🗺️ **Interactive Geospatial Map:** Dark-mode map displaying transmission lines (vectors) and substations/battery storage (points) using Mapbox GL.
* 🔍 **Spatial & Temporal Overlap Engine:** PostGIS-powered `ST_DWithin` queries calculating real-time proximity (e.g., within 15 km) and overlapping execution windows.
* 🏷️ **6-Category Project Taxonomy:** Categorizes all projects into:
  1. *Transmission (>69 kV)*
  2. *Substations*
  3. *Distribution (<69 kV)*
  4. *Generation & Storage Integration (BESS)*
  5. *Grid Hardening & Resilience*
  6. *Grid Enhancing Technologies (GETs)*
* 📊 **Regional Analytics & Gap Detection:** Identifies underrepresented or least-developed project types per region (e.g., BESS storage deficits).
* 🤝 **Inter-Utility Collaboration:** In-app collaboration request flow to streamline resource sharing between entities.

---

## 🛠️ Tech Stack

* **Frontend:** React, TypeScript, Vite, Tailwind CSS, Mapbox GL / Leaflet, Recharts.
* **Backend:** Node.js (Express) / Python (FastAPI).
* **Database:** PostgreSQL with **PostGIS** extension (spatial indexing using GiST / R-Tree).
* **Containerization:** Docker & Docker Compose.

---

## ⚡ Quick Start & Installation

### Prerequisites
* [Docker Desktop](https://www.docker.com/) installed and running.
* [Node.js](https://nodejs.org/) (v18+) or Python 3.11+.

### 1. Clone the Repository
```bash
git clone [https://github.com/YOUR_USERNAME/gridlock.git](https://github.com/YOUR_USERNAME/gridlock.git)
cd gridlock