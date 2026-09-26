# GridLock — Corrected Technical Implementation Guide & Blueprint

**Event:** ShellHacks Hackathon  
**Target:** Functional MVP aligned with the GridLock SRS  
**Stack:** Docker, PostgreSQL + PostGIS, Node.js + Express, React + Vite, Leaflet, Tailwind CSS, JWT, bcrypt

> This guide expands the original blueprint so the implementation covers the missing SRS areas: authentication, privacy controls, project submission, complete filtering, analytics, notifications, collaboration requests, messaging, and an AI-ingestion MVP.

---

## 0. MVP IMPLEMENTATION ORDER

Build in this order so the team always has a runnable product:

1. Docker + PostGIS
2. Database schema + demo data
3. Express backend foundation
4. Authentication (register/login)
5. Project APIs + manual project submission
6. Overlap detection
7. React frontend + authentication screens
8. Interactive map + complete filters
9. Conflict notifications + collaboration requests
10. Direct messaging
11. Regional analytics + underdeveloped-sector analysis
12. AI ingestion MVP
13. Integration testing + demo preparation

### Recommended project structure

```text
ShellHacks_Project_GridLock/
├── docker-compose.yml
├── .gitignore
├── database/
│   └── schema.sql
├── backend/
│   ├── package.json
│   ├── .env
│   └── src/
│       ├── server.js
│       ├── db.js
│       ├── middleware/
│       │   └── auth.js
│       └── routes/
│           ├── auth.js
│           ├── projects.js
│           ├── conflicts.js
│           ├── collaborations.js
│           ├── messages.js
│           ├── notifications.js
│           └── analytics.js
└── frontend/
    ├── package.json
    └── src/
        ├── App.tsx
        ├── api.ts
        ├── components/
        │   ├── GridMap.tsx
        │   ├── Filters.tsx
        │   ├── ConflictPanel.tsx
        │   └── ProjectForm.tsx
        └── pages/
            ├── Login.tsx
            ├── Register.tsx
            ├── Dashboard.tsx
            ├── Messages.tsx
            └── Profile.tsx
```

---

## 1. SYSTEM ARCHITECTURE

```text
┌─────────────────────────────────────────────────────────────┐
│                       REACT FRONTEND                        │
│ Login / Register / Dashboard / Map / Project Form          │
│ Filters / Analytics / Alerts / Collaboration / Messaging   │
└─────────────────────────────┬───────────────────────────────┘
                              │ REST API (JSON / GeoJSON)
┌─────────────────────────────▼───────────────────────────────┐
│                    NODE.JS + EXPRESS                       │
│ Auth + Projects + Conflicts + Analytics + Collaboration    │
│ Messages + Notifications + Privacy                         │
└─────────────────────────────┬───────────────────────────────┘
                              │ SQL
┌─────────────────────────────▼───────────────────────────────┐
│                  POSTGRESQL + POSTGIS                      │
│ Users / Utilities / Projects / Messages / Notifications    │
│ Collaboration Requests / Spatial GIST Index                │
└─────────────────────────────────────────────────────────────┘

       Public utility/regulatory sources/PDFs
                         │
                         ▼
               AI INGESTION MVP
           Parse → normalize → classify
                         │
                         ▼
                     Projects
```

### Requirement coverage

| SRS | Implementation |
|---|---|
| 1 | JWT registration/login + users linked to utilities |
| 2 | Utility/project visibility fields and protected internal notes |
| 3 | Project submission API + React form |
| 4 | AI ingestion MVP endpoint/service |
| 5 | Server-side category/subtype validation |
| 6 | Leaflet interactive map |
| 7 | Public projects from other utilities visible on map |
| 8 | Utility ownership/contact metadata subject to privacy settings |
| 9 | Search/category/subtype/voltage/status/time filters |
| 10 | Regional analytics endpoint + charts |
| 11 | Underrepresented-category calculation |
| 12 | PostGIS spatial + temporal overlap detection |
| 13 | Stored conflict notifications |
| 14 | Project-linked direct messaging |
| 15 | Persistent collaboration requests |

---

# ROLE 1 — DATA & BACKEND ENGINEER

## STEP 1 — Docker & PostGIS

Create `docker-compose.yml` in the project root:

```yaml
services:
  db:
    image: postgis/postgis:15-3.3
    container_name: gridlock_db
    restart: always
    environment:
      POSTGRES_DB: gridlock
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

The obsolete Compose `version:` property is intentionally omitted.

Start Docker Desktop, then from the VS Code terminal:

```bash
docker compose up -d
docker ps
```

Expected: `gridlock_db` is `Up` and port `5432` is exposed.

---

## STEP 2 — Database schema

Create `database/schema.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS collaboration_requests CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS utilities CASCADE;

CREATE TABLE utilities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) UNIQUE NOT NULL,
    state VARCHAR(2) NOT NULL,
    contact_email VARCHAR(255),
    contact_visibility VARCHAR(20) NOT NULL DEFAULT 'public'
        CHECK (contact_visibility IN ('public', 'authenticated', 'private')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    utility_id INT NOT NULL REFERENCES utilities(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'member',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    utility_id INT NOT NULL REFERENCES utilities(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    category VARCHAR(80) NOT NULL,
    subtype VARCHAR(100) NOT NULL,
    voltage_kv INT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Planned',
    ownership_visibility VARCHAR(20) NOT NULL DEFAULT 'public'
        CHECK (ownership_visibility IN ('public', 'authenticated', 'private')),
    internal_notes TEXT,
    geom GEOMETRY(GEOMETRY, 4326) NOT NULL,
    source_url TEXT,
    source_type VARCHAR(30) DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date >= start_date)
);

CREATE INDEX idx_projects_geom ON projects USING GIST (geom);
CREATE INDEX idx_projects_category ON projects(category);
CREATE INDEX idx_projects_dates ON projects(start_date, end_date);

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    project_id INT REFERENCES projects(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE collaboration_requests (
    id SERIAL PRIMARY KEY,
    sender_utility_id INT NOT NULL REFERENCES utilities(id),
    receiver_utility_id INT NOT NULL REFERENCES utilities(id),
    project1_id INT NOT NULL REFERENCES projects(id),
    project2_id INT REFERENCES projects(id),
    message TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    utility1_id INT NOT NULL REFERENCES utilities(id),
    utility2_id INT NOT NULL REFERENCES utilities(id),
    project_id INT REFERENCES projects(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_user_id INT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Demo utilities and projects

Append:

```sql
INSERT INTO utilities (name, state, contact_email) VALUES
('Florida Power & Light (FPL)', 'FL', 'planning@fpl.com'),
('Duke Energy Florida', 'FL', 'grid-coordination@duke-energy.com');

INSERT INTO projects
(utility_id, title, category, subtype, voltage_kv, start_date, end_date, geom)
VALUES
(
  1,
  'Everglades-Miami 230kV Upgrade',
  'Transmission',
  'Reconductoring / Upgrade',
  230,
  '2026-04-01',
  '2026-11-30',
  ST_GeomFromText(
    'LINESTRING(-80.3500 25.7600, -80.3000 25.8500, -80.2500 25.9500)',
    4326
  )
),
(
  2,
  'Broward Regional Intertie Line',
  'Transmission',
  'Greenfield Line',
  230,
  '2026-05-15',
  '2026-12-15',
  ST_GeomFromText(
    'LINESTRING(-80.3300 25.7700, -80.2800 25.8700)',
    4326
  )
),
(
  1,
  'Homestead Solar-BESS Storage Hub',
  'Generation & Storage Integration',
  'BESS (Battery Energy Storage System)',
  115,
  '2027-01-10',
  '2027-08-30',
  ST_GeomFromText('POINT(-80.4776 25.4687)', 4326)
),
(
  2,
  'Orange County Substation Expansion',
  'Substations',
  'Substation Expansion',
  500,
  '2026-08-01',
  '2027-03-31',
  ST_GeomFromText('POINT(-81.3792 28.5383)', 4326)
),
(
  1,
  'Palm Beach Coastal Undergrounding',
  'Grid Hardening & Resilience',
  'Pole & Tower Hardening',
  23,
  '2026-03-01',
  '2026-09-30',
  ST_GeomFromText('LINESTRING(-80.0360 26.7153, -80.0350 26.7500)', 4326)
);
```

Run the schema from VS Code:

```bash
docker exec -i gridlock_db psql -U postgres -d gridlock < database/schema.sql
```

In PowerShell, if input redirection causes trouble, use:

```powershell
Get-Content database/schema.sql | docker exec -i gridlock_db psql -U postgres -d gridlock
```

Verify:

```bash
docker exec -it gridlock_db psql -U postgres -d gridlock
```

Then inside `psql`:

```sql
\dt
SELECT id, title, category FROM projects;
```

Exit with `\q`.

---

## STEP 3 — Backend foundation

From the project root:

```bash
cd backend
npm init -y
npm install express cors dotenv pg bcrypt jsonwebtoken
npm install -D nodemon
```

Update `backend/package.json` scripts:

```json
"scripts": {
  "start": "node src/server.js",
  "dev": "nodemon src/server.js"
}
```

Create `backend/.env`:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gridlock
DB_USER=postgres
DB_PASSWORD=postgrespassword
JWT_SECRET=replace_this_with_a_long_random_dev_secret
```

Do **not** commit `.env`.

### `backend/src/db.js`

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

module.exports = pool;
```

### `backend/src/server.js`

```javascript
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const conflictRoutes = require('./routes/conflicts');
const collaborationRoutes = require('./routes/collaborations');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const analyticsRoutes = require('./routes/analytics');

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/conflicts', conflictRoutes);
app.use('/api/collaborations', collaborationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`GridLock API running on http://localhost:${PORT}`));
```

Run:

```bash
npm run dev
```

Test `http://localhost:5000/api/health` and expect:

```json
{ "status": "ok" }
```

---

## STEP 4 — Authentication & user management (SRS 1)

### `backend/src/middleware/auth.js`

```javascript
const jwt = require('jsonwebtoken');

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    req.user = jwt.verify(header.substring(7), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
```

### `backend/src/routes/auth.js`

```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { name, email, password, utilityId } = req.body;

  if (!name || !email || !password || !utilityId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (utility_id, name, email, password_hash)
       VALUES ($1, $2, LOWER($3), $4)
       RETURNING id, utility_id, name, email, role`,
      [utilityId, name, email, passwordHash]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query(
    'SELECT * FROM users WHERE email = LOWER($1)',
    [email]
  );

  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    {
      id: user.id,
      utilityId: user.utility_id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      utilityId: user.utility_id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

router.get('/me', auth, async (req, res) => {
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.utility_id,
            ut.name AS utility_name
     FROM users u
     JOIN utilities ut ON ut.id = u.utility_id
     WHERE u.id = $1`,
    [req.user.id]
  );

  res.json(result.rows[0]);
});

module.exports = router;
```

### Corporate verification scope

The SRS says corporate credentials must be verified. For the hackathon MVP, do **not** claim enterprise-grade verification unless you actually build it. A reasonable demo implementation is:

- User chooses an existing utility.
- Email/password are required.
- Optionally validate that the email domain matches a configured utility domain.
- Explain in the pitch that production would use corporate SSO/domain verification.

---

## STEP 5 — Project classification + project APIs (SRS 3, 5, 7, 8, 9)

Use one canonical taxonomy everywhere:

```javascript
const TAXONOMY = {
  Transmission: [
    'Greenfield Line',
    'Reconductoring / Upgrade',
    'Intertie',
    'HVDC Line',
  ],
  Substations: [
    'Greenfield Substation',
    'Substation Expansion',
    'Breaker & Switchgear Replacement',
    'GIS (Gas Insulated Switchgear)',
  ],
  Distribution: [
    'Undergrounding',
    'Feeder Reconductoring',
    'Distribution Extension',
  ],
  'Generation & Storage Integration': [
    'BESS (Battery Energy Storage System)',
    'Gen-Tie Line',
    'Synchronous Condensers',
  ],
  'Grid Hardening & Resilience': [
    'Covered Conductors / Fire Hardening',
    'Pole & Tower Hardening',
    'Vegetation Management Infrastructure',
  ],
  'Grid Enhancing Technologies (GETs)': [
    'DLR (Dynamic Line Rating)',
    'FLISR / Smart Grid Automation',
    'Power Flow Controllers',
  ],
};
```

### Required endpoints

```text
GET  /api/projects
GET  /api/projects/:id
POST /api/projects           authenticated
```

`GET /api/projects` should accept optional query parameters:

```text
?search=
&category=
&subtype=
&minVoltage=
&maxVoltage=
&status=
&startDate=
&endDate=
```

The response used by the map should remain a GeoJSON `FeatureCollection`.

For `POST /api/projects`, accept GeoJSON geometry and convert it with PostGIS:

```sql
ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)
```

The backend must:

1. Authenticate the caller.
2. Use `req.user.utilityId` as the owner instead of trusting a utility ID supplied by the browser.
3. Validate category/subtype against the SRS taxonomy.
4. Validate `end_date >= start_date`.
5. Validate geometry.
6. Insert the project.
7. Run overlap detection for the new project.
8. Create notifications for affected utilities when conflicts are found.

### Privacy (SRS 2 and 8)

When returning project ownership/contact information:

- `public`: visible to everyone.
- `authenticated`: visible only when a valid JWT is supplied.
- `private`: visible only to users from the owning utility.
- `internal_notes`: never include in the public map endpoint; expose only to the owning utility.

---

## STEP 6 — Spatial + temporal overlap detection (SRS 12)

Create `GET /api/conflicts?radius=15`.

Core query:

```sql
SELECT
    p1.id AS project1_id,
    p1.title AS project1_title,
    u1.id AS utility1_id,
    u1.name AS utility1,
    p1.category AS category1,
    p2.id AS project2_id,
    p2.title AS project2_title,
    u2.id AS utility2_id,
    u2.name AS utility2,
    p2.category AS category2,
    ROUND(
      (ST_Distance(p1.geom::geography, p2.geom::geography) / 1000.0)::numeric,
      2
    ) AS distance_km,
    GREATEST(p1.start_date, p2.start_date) AS overlap_start,
    LEAST(p1.end_date, p2.end_date) AS overlap_end
FROM projects p1
JOIN projects p2
  ON p1.utility_id <> p2.utility_id
 AND p1.id < p2.id
JOIN utilities u1 ON u1.id = p1.utility_id
JOIN utilities u2 ON u2.id = p2.utility_id
WHERE ST_DWithin(
    p1.geom::geography,
    p2.geom::geography,
    $1 * 1000
)
AND p1.start_date <= p2.end_date
AND p1.end_date >= p2.start_date;
```

The radius is configurable in kilometers.

For a hackathon MVP, this date-range overlap satisfies the temporal-overlap requirement and is easier to demonstrate than a separate quarter engine.

---

## STEP 7 — Conflict notifications (SRS 13)

When a new project creates a conflict:

1. Find users belonging to both affected utilities.
2. Insert a notification for those users.
3. Show unread notifications in the frontend.

Endpoints:

```text
GET   /api/notifications
PATCH /api/notifications/:id/read
```

Example notification:

```json
{
  "type": "PROJECT_OVERLAP",
  "message": "A nearby project overlaps your construction window.",
  "project_id": 2,
  "is_read": false
}
```

---

## STEP 8 — Collaboration requests (SRS 15)

Replace the original frontend-only `alert()` with a real request.

Endpoints:

```text
POST  /api/collaborations
GET   /api/collaborations
PATCH /api/collaborations/:id
```

Create request body:

```json
{
  "receiverUtilityId": 2,
  "project1Id": 1,
  "project2Id": 2,
  "message": "Our projects overlap. Would you like to coordinate equipment procurement?"
}
```

The backend gets `senderUtilityId` from the authenticated user. Never trust a sender utility supplied by the browser.

Allowed status transitions for the MVP:

```text
pending → accepted
pending → declined
```

When accepted, create or enable a conversation between the utilities.

---

## STEP 9 — Direct messaging (SRS 14)

Endpoints:

```text
GET  /api/messages/conversations
POST /api/messages/conversations
GET  /api/messages/conversations/:id
POST /api/messages/conversations/:id
```

Security rule: a user may only read/write a conversation if their `utility_id` matches one of the two utilities attached to that conversation.

For ShellHacks, normal HTTP polling is enough. WebSockets are optional, not necessary for the MVP.

---

# ROLE 2 — FRONTEND & MAP ENGINEER

## STEP 10 — Create React/Vite frontend

From the project root:

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install leaflet react-leaflet @types/leaflet react-router-dom
```

If Tailwind is part of the selected frontend setup, install/configure the version the team chooses and keep the styling consistent with the original dark GridLock design.

Run:

```bash
npm run dev
```

---

## STEP 11 — API helper + authentication UI

### `frontend/src/api.ts`

```typescript
export const API_URL = 'http://localhost:5000/api';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}
```

### Login page

Create fields for:

- Corporate email
- Password
- Login button
- Link to Register

On submit:

```typescript
const data = await apiFetch('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});

localStorage.setItem('token', data.token);
```

For a hackathon demo, local storage is simple. For a production deployment, prefer a more robust session design such as secure HttpOnly cookies.

### Registration page

Fields:

- Name
- Utility/company
- Corporate email
- Password

Call `POST /api/auth/register`, then redirect to login.

---

## STEP 12 — Interactive map (SRS 6–8)

Install Leaflet dependencies if not already installed:

```bash
npm install leaflet react-leaflet @types/leaflet
```

`GridMap.tsx` should:

1. Fetch `/api/projects`.
2. Render returned GeoJSON.
3. Display normal projects in cyan.
4. Display conflict projects in red.
5. Open a popup with title, utility, category, subtype, voltage, status and timeline.
6. Respect privacy-filtered metadata returned by the backend.
7. Re-fetch when filters change.

Example tile layer:

```tsx
<TileLayer
  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
  attribution='&copy; OpenStreetMap contributors &copy; CARTO'
/>
```

Do not hard-code secret Mapbox tokens into committed frontend files.

---

## STEP 13 — Complete filters (SRS 9)

The original blueprint only filtered category. Add:

- Text search
- Category
- Subtype
- Minimum/maximum voltage
- Status
- Start date
- Completion date

Build the API query dynamically, for example:

```text
/api/projects?category=Transmission&minVoltage=115&status=Planned
```

Filtering on the backend avoids downloading every project once the dataset grows.

---

## STEP 14 — Manual project submission form (SRS 3)

Create `ProjectForm.tsx` with:

- Title
- Category
- Subtype (changes according to category)
- Voltage (kV)
- Start date
- Completion date
- Status
- Geometry
- Ownership visibility
- Internal notes

For the hackathon, geometry can be entered in one of these MVP-friendly ways:

1. Click a location on the map → GeoJSON `Point`.
2. Draw a line if the team has time.
3. Paste valid GeoJSON as a fallback.

Send the resulting object to:

```text
POST /api/projects
```

After successful creation, refresh the map and conflicts.

---

# ROLE 3 — FULL-STACK INTEGRATOR & PITCH LEAD

## STEP 15 — Dashboard layout

Recommended dashboard:

```text
┌───────────────────────┬──────────────────────────────────────┐
│ GRIDLOCK              │                                      │
│                       │                                      │
│ Search                │              MAP                     │
│ Filters               │                                      │
│                       │                                      │
│ Overlap Alerts        │                                      │
│                       │                                      │
│ Notifications         │                                      │
│                       │                                      │
│ + Add Project         │                                      │
├───────────────────────┴──────────────────────────────────────┤
│ Analytics / Messages / Profile                              │
└──────────────────────────────────────────────────────────────┘
```

Navigation should expose:

```text
Dashboard
Projects
Messages
Notifications
Profile
Logout
```

---

## STEP 16 — Regional analytics (SRS 10)

Create:

```text
GET /api/analytics/categories
```

Optional query parameters:

```text
?state=FL
```

Example SQL:

```sql
SELECT category, COUNT(*)::int AS count
FROM projects
GROUP BY category
ORDER BY count DESC;
```

Frontend can display a bar or doughnut chart. Keep this feature simple for the MVP: the important part is that the graphic is derived from real database data.

---

## STEP 17 — Underdeveloped-sector identification (SRS 11)

For the hackathon, define the calculation explicitly instead of claiming an industry-standard deficit model.

Simple MVP rule:

1. Count projects in each of the six required categories for the selected region.
2. Compute each category's share of regional projects.
3. Mark categories with zero projects or a share below a documented demo threshold as `underrepresented`.

Endpoint:

```text
GET /api/analytics/gaps?state=FL
```

Example response:

```json
[
  {
    "category": "Grid Enhancing Technologies (GETs)",
    "count": 0,
    "share": 0,
    "underrepresented": true
  }
]
```

Label this as a **GridLock planning indicator**, not proof that a real region objectively lacks infrastructure.

---

## STEP 18 — Profile & privacy controls (SRS 2)

Profile screen should allow the authenticated entity to change:

- Utility contact visibility
- Project ownership visibility when permitted
- Internal notes for its own projects

Suggested endpoint:

```text
PATCH /api/profile/privacy
```

Authorization matters: one utility must never be able to modify another utility's privacy settings or internal notes.

---

## STEP 19 — AI web/PDF ingestion MVP (SRS 4)

This is the largest requirement. For ShellHacks, build a narrow proof of concept instead of pretending to support the entire web.

### MVP pipeline

```text
Official URL or uploaded/public PDF
              ↓
       Fetch/extract text
              ↓
        AI structured extraction
              ↓
      Validate required fields
              ↓
      Normalize to SRS taxonomy
              ↓
         Human review
              ↓
        Insert into projects
```

Suggested normalized object:

```json
{
  "title": "Example Transmission Upgrade",
  "owner": "Example Utility",
  "category": "Transmission",
  "subtype": "Reconductoring / Upgrade",
  "voltage_kv": 230,
  "start_date": "2027-01-01",
  "end_date": "2027-12-31",
  "geometry": null,
  "source_url": "..."
}
```

### Important validation

Do not automatically trust AI output. Before inserting:

- Require source URL/document reference.
- Validate category/subtype.
- Validate dates and voltage types.
- Reject/flag missing geometry instead of inventing coordinates.
- Present extracted data for human confirmation.

For the demo, successfully parsing **one official source or one representative PDF** is enough to demonstrate the architecture.

---

# INTEGRATION CHECKLIST

## STEP 20 — End-to-end test

Run these in order.

### Terminal 1 — database

```bash
docker compose up -d
```

### Terminal 2 — backend

```bash
cd backend
npm run dev
```

### Terminal 3 — frontend

```bash
cd frontend
npm run dev
```

Then verify:

- [ ] `GET /api/health` returns OK.
- [ ] A user can register.
- [ ] A user can log in and receive a token.
- [ ] `/api/auth/me` identifies the logged-in utility.
- [ ] Public projects appear on the map.
- [ ] Category/subtype/voltage/status/date filters work.
- [ ] A logged-in user can create a project for their own utility.
- [ ] A project from another utility is visible when public.
- [ ] Internal notes are not exposed publicly.
- [ ] The two demo transmission projects trigger a conflict.
- [ ] Conflict projects render differently on the map.
- [ ] A conflict creates/appears as a notification.
- [ ] `Send Collaboration Request` creates a database record rather than an alert only.
- [ ] Receiver can accept/decline a collaboration request.
- [ ] Authorized utilities can exchange messages.
- [ ] Regional category analytics load from the database.
- [ ] Underrepresented sectors are clearly labeled as GridLock's heuristic.
- [ ] AI ingestion demo extracts one real/representative source and requires review before insertion.

---

# GIT WORKFLOW FOR THE TEAM

Before working:

```bash
git pull origin main
```

Check changes:

```bash
git status
```

Commit:

```bash
git add .
git commit -m "Describe the change"
git push
```

For simultaneous development, preferably use feature branches:

```bash
git checkout -b feature/auth
git push -u origin feature/auth
```

Other examples:

```text
feature/backend-api
feature/map
feature/auth
feature/collaboration
feature/analytics
```

Merge through GitHub after testing rather than having everyone edit `main` at the same time.

Remember: Git does not track empty folders. Add a `.gitkeep` when an empty directory must exist in the repository.

---

# `.gitignore`

Recommended root `.gitignore`:

```gitignore
# Environment / secrets
.env
.env.*
!.env.example

# Node
node_modules/
frontend/node_modules/
backend/node_modules/

# Python / optional AI tooling
venv/
.venv/
env/
__pycache__/
*.py[cod]

# Builds
frontend/dist/
dist/
build/
.next/
out/
*.egg-info/

# IDE / OS
.DS_Store
Thumbs.db
.vscode/
.idea/

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
logs/
*.log
```

Commit an `.env.example` without real secrets if teammates need configuration guidance:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gridlock
DB_USER=postgres
DB_PASSWORD=YOUR_LOCAL_PASSWORD
JWT_SECRET=YOUR_DEV_SECRET
```

---

# DEMO FLOW

A strong end-to-end demo now follows the SRS rather than only showing the map:

```text
1. FPL user logs in
        ↓
2. Dashboard shows Florida projects
        ↓
3. User filters infrastructure categories
        ↓
4. User submits a new planned project
        ↓
5. PostGIS detects geographic + schedule overlap
        ↓
6. GridLock generates a conflict notification
        ↓
7. Conflicting corridor turns red on the map
        ↓
8. FPL sends Duke a collaboration request
        ↓
9. Duke accepts
        ↓
10. Utilities communicate in project-linked messaging
        ↓
11. Regional analytics show category distribution/gaps
        ↓
12. AI ingestion proof-of-concept imports a public project for review
```

---

# REQUIREMENTS TRACEABILITY / DEFINITION OF DONE

| Req. | Done when... |
|---|---|
| 1 | Register/login works and authenticated user is tied to a utility |
| 2 | Privacy values are persisted and enforced by API responses |
| 3 | Project form creates a spatial project in PostgreSQL |
| 4 | At least one public source can be parsed into a reviewable structured project |
| 5 | Only the six approved categories and their valid subtypes are accepted |
| 6 | Projects render interactively on a GIS map |
| 7 | Public projects owned by other utilities can be viewed |
| 8 | Owner/contact metadata is displayed according to privacy settings |
| 9 | Search, category, subtype, voltage, status and timeframe filters work |
| 10 | Regional category distribution is rendered graphically |
| 11 | GridLock identifies low/zero-representation categories using a documented heuristic |
| 12 | Spatial + temporal overlap query returns conflicting projects |
| 13 | A detected conflict produces persistent notification data |
| 14 | Authorized users from collaborating utilities can exchange project-linked messages |
| 15 | Collaboration requests persist and can be accepted/declined |

---

# FINAL MVP PRIORITY

If time becomes critical, protect this vertical slice first:

```text
Authentication
     ↓
Map
     ↓
Project submission
     ↓
PostGIS overlap detection
     ↓
Notification
     ↓
Collaboration request
     ↓
Basic messaging
```

Then add filters/analytics and finally the AI-ingestion proof of concept. This produces a coherent product flow even if every advanced feature cannot receive production-level depth during the hackathon.
