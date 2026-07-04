# TeamFlow — Engineering OS

TeamFlow is a unified workspace designed for engineering teams. It integrates sprint planning, cross-project task dependencies, and incident governance (Root Cause Analysis with multi-reviewer sign-off chains) in a single, high-performance web application.

Built using **React (TanStack Start)** for the frontend and **Node.js (Express) + PostgreSQL** for the backend database engine.

---

## 1. Project Architecture & Setup

### Prerequisites
* **Node.js** (v18 or higher recommended)
* **PostgreSQL** (running locally on port `5432` or via Docker)

---

### Step 1: Database Setup
Make sure PostgreSQL is running. If you want to use Docker, a `docker-compose.yml` is included in the project root:
```bash
docker-compose up -d
```

1. Navigate to the `server/` directory:
   ```bash
   cd server
   ```
2. Install backend dependencies:
   ```bash
   npm install
   ```
3. Configure the environment variables (see `.env` details below).
4. Run migrations and populate seed data:
   ```bash
   npm run migrate
   ```
   * *Note: This automatically initializes the schema and seeds mock developers (Priya, Ava, Ramesh, etc.) and active tasks.*

---

### Step 2: Start the Backend API Server
Launch the Express API server (listening on port `4000`):
```bash
npm run dev
```

---

### Step 3: Start the Frontend Application
1. Navigate back to the project root directory:
   ```bash
   cd ..
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Launch the TanStack Start development server:
   ```bash
   npm run dev
   ```
4. Open the application in your browser at **[http://localhost:8080](http://localhost:8080)** (or **[http://localhost:8081](http://localhost:8081)** if port 8080 is in use).

---

## 2. Environment Variables

### Backend (`server/.env`)
Create a `.env` file in the `server/` directory containing the following:
```env
PORT=4000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/teamflow
JWT_SECRET=super-secret-developer-key
```

### Frontend (`.env`)
No frontend environment files are required in development as Vite automatically proxies API requests to `http://localhost:4000/api` based on defaults, but you can configure:
```env
VITE_API_URL=http://localhost:4000/api
```

---

## 3. Key Features Implemented

1. **Sprint Planning & Metrics Dashboard**:
   * Real-time telemetry widgets (Active Tasks, Completion Rates, Incident Alerts).
   * Live charts (Weekly Velocity trends and Monthly RCA severity aggregates) calculated dynamically via SQL queries.
2. **Multi-View Board Switcher**:
   * **Kanban view** with drag-and-drop status column sorting.
   * **Calendar view** mapping task deadlines.
   * **List view** with instant CSV Export support.
3. **Advanced Task Drawer**:
   * Rich description updates.
   * Cross-project task dependencies (A task in Project A can be marked as blocked by a task in Project B).
   * Live task comments and multi-tenant attachment uploads (PDFs, images, logs, etc.).
4. **Incident Governance (RCA Workflow)**:
   * Document timeline, contributing factors, corrective plans, and preventive measures.
   * Multi-reviewer sign-off flow: Assign reviewers to sign off. The RCA remains locked until all assigned reviewers approve.
5. **Glassmorphic Security Suite**:
   * Custom manual Sign In / Create Account workflow with bcrypt secure credentials checking.
   * Theme-flash-free Dark Mode setting.
6. **Real-time Notifications**:
   * Deduplicated alert logs for assignments, status changes, and mentions.

---

## 4. Key Assumptions Made

* **Local Network Constraints**: The backend assumes port `4000` for API operations and port `5432` for local PostgreSQL connectivity in default dev configurations.
* **Reviewer Assignments**: It is assumed that any member of the target project can be assigned as a reviewer for an RCA. There is no separate "governance administrator" role.
* **Transition Workflows**: Task progression follows a strict state machine (`backlog -> in_progress -> review -> done`) enforced server-side to guarantee project audit reliability.

---

## 5. Known Limitations

* **Local Storage for Attachments**: Uploads are saved to the local backend filesystem. For horizontal production scaling, this should be replaced with an S3 or Google Cloud Storage client.
* **Single-tier Approvals**: RCA sign-offs are simple binary decisions (Approve/Reject). Configurable multi-tier compliance approval policies can be added in future iterations.
* **No Real Mail server**: The password reset option simulates generating tokens and logging results for sandbox testing. An SMTP service is required for actual outbound mail.
