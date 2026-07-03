const bcrypt = require('bcryptjs');
const { pool } = require('./pool');

const users = [
  { id: '3448f8c4-c09a-4c28-97c0-d3df5ebfca01', name: 'Ava Chen', email: 'ava.chen@teamflow.dev', role: 'Staff Engineer' },
  { id: '3448f8c4-c09a-4c28-97c0-d3df5ebfca02', name: 'Liam Patel', email: 'liam.patel@teamflow.dev', role: 'Backend Engineer' },
  { id: '3448f8c4-c09a-4c28-97c0-d3df5ebfca03', name: 'Nora Kim', email: 'nora.kim@teamflow.dev', role: 'SRE' },
  { id: '3448f8c4-c09a-4c28-97c0-d3df5ebfca04', name: 'Diego Alvarez', email: 'diego.alvarez@teamflow.dev', role: 'Frontend Engineer' },
  { id: '3448f8c4-c09a-4c28-97c0-d3df5ebfca05', name: 'Priya Shah', email: 'priya.shah@teamflow.dev', role: 'Engineering Manager' },
  { id: '3448f8c4-c09a-4c28-97c0-d3df5ebfca06', name: 'Yuki Tanaka', email: 'yuki.tanaka@teamflow.dev', role: 'Platform Engineer' },
];

const projects = [
  { id: 'e1d2c1b0-1111-4444-8888-000000000001', name: 'Identity Platform', description: 'Auth, session, and identity infrastructure.', key: 'IDP' },
  { id: 'e1d2c1b0-2222-4444-8888-000000000002', name: 'Payments Core', description: 'Ledger, billing and reconciliation.', key: 'PAY' },
  { id: 'e1d2c1b0-3333-4444-8888-000000000003', name: 'Data Pipeline v2', description: 'Streaming ETL migration.', key: 'DPX' },
  { id: 'e1d2c1b0-4444-4444-8888-000000000004', name: 'Mobile Experience', description: 'iOS/Android client parity.', key: 'MOB' },
];

const tasks = [
  {
    id: 'f0000000-0000-0000-0000-000000000142',
    projectId: projects[0].id,
    title: 'Migrate Auth to JWT',
    description: 'Replace legacy session cookies with signed JWT access + refresh tokens.',
    status: 'in_progress',
    priority: 'critical',
    assigneeId: users[0].id, // Ava Chen
    dueDateOffset: 2,
  },
  {
    id: 'f0000000-0000-0000-0000-000000000155',
    projectId: projects[0].id,
    title: 'Deprecate legacy /v1/session endpoint',
    description: 'Add sunset headers and update SDKs.',
    status: 'backlog',
    priority: 'high',
    assigneeId: users[1].id, // Liam Patel
    dueDateOffset: 9,
    parentTaskId: 'f0000000-0000-0000-0000-000000000142',
  },
  {
    id: 'f0000000-0000-0000-0000-000000000088',
    projectId: projects[1].id,
    title: 'Fix Redis memory leak in ledger worker',
    description: 'Worker RSS grows 1.2GB/day; suspect connection pool.',
    status: 'review',
    priority: 'critical',
    assigneeId: users[2].id, // Nora Kim
    dueDateOffset: 1,
  },
  {
    id: 'f0000000-0000-0000-0000-000000000091',
    projectId: projects[1].id,
    title: 'Reconciliation dashboard v2',
    description: 'New Grafana board for daily settlement variance.',
    status: 'in_progress',
    priority: 'medium',
    assigneeId: users[3].id, // Diego Alvarez
    dueDateOffset: 5,
  },
  {
    id: 'f0000000-0000-0000-0000-000000000014',
    projectId: projects[2].id,
    title: 'Backfill events into Kafka topic v2',
    description: 'Replay 30 days of change events.',
    status: 'backlog',
    priority: 'high',
    assigneeId: users[5].id, // Yuki Tanaka
    dueDateOffset: 11,
  },
  {
    id: 'f0000000-0000-0000-0000-000000000022',
    projectId: projects[2].id,
    title: 'Cut over analytics consumers to v2',
    description: 'Switch dbt sources; add dual-write validation.',
    status: 'backlog',
    priority: 'medium',
    assigneeId: users[1].id, // Liam Patel
    dueDateOffset: 18,
    parentTaskId: 'f0000000-0000-0000-0000-000000000014',
  },
  {
    id: 'f0000000-0000-0000-0000-000000000031',
    projectId: projects[3].id,
    title: 'Offline mode for task detail',
    description: 'Cache last 50 tasks with IndexedDB.',
    status: 'done',
    priority: 'medium',
    assigneeId: users[3].id, // Diego Alvarez
    dueDateOffset: -3,
  },
  {
    id: 'f0000000-0000-0000-0000-000000000033',
    projectId: projects[3].id,
    title: 'Push notification retry logic',
    description: 'Exponential backoff on APNs 429s.',
    status: 'review',
    priority: 'low',
    assigneeId: users[0].id, // Ava Chen
    dueDateOffset: 4,
  },
  {
    id: 'f0000000-0000-0000-0000-000000000160',
    projectId: projects[0].id,
    title: 'SCIM 2.0 provisioning endpoint',
    description: 'Support okta + Azure AD provisioning.',
    status: 'in_progress',
    priority: 'high',
    assigneeId: users[1].id, // Liam Patel
    dueDateOffset: 7,
  },
  {
    id: 'f0000000-0000-0000-0000-000000000102',
    projectId: projects[1].id,
    title: 'Idempotency keys on refund API',
    description: 'Prevent double refunds under retry storms.',
    status: 'backlog',
    priority: 'high',
    assigneeId: users[0].id, // Ava Chen
    dueDateOffset: 14,
  },
  {
    id: 'f0000000-0000-0000-0000-000000000170',
    projectId: projects[0].id,
    title: 'Rate limit login attempts per IP+account',
    description: 'Sliding window in Redis.',
    status: 'done',
    priority: 'high',
    assigneeId: users[2].id, // Nora Kim
    dueDateOffset: -5,
  },
  {
    id: 'f0000000-0000-0000-0000-000000000040',
    projectId: projects[3].id,
    title: 'Accessibility audit for onboarding',
    description: 'WCAG 2.2 AA sweep.',
    status: 'in_progress',
    priority: 'medium',
    assigneeId: users[3].id, // Diego Alvarez
    dueDateOffset: 6,
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Seeding mock users...');
    const hashed = await bcrypt.hash('password', 10);
    for (const u of users) {
      // Check if user already exists
      const { rows } = await client.query('SELECT 1 FROM users WHERE email = $1', [u.email]);
      if (rows.length === 0) {
        await client.query(
          `INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4)`,
          [u.id, u.name, u.email, hashed]
        );
      }
    }

    console.log('Seeding mock projects...');
    for (const p of projects) {
      const { rows } = await client.query('SELECT 1 FROM projects WHERE id = $1', [p.id]);
      if (rows.length === 0) {
        await client.query(
          `INSERT INTO projects (id, name, description, created_by) VALUES ($1, $2, $3, $4)`,
          [p.id, p.name, p.description, users[4].id] // Created by Priya Shah
        );
      }

      // Ensure membership exists for all mock users
      for (const u of users) {
        const role = u.id === users[4].id ? 'owner' : 'member';
        await client.query(
          `INSERT INTO project_members (project_id, user_id, role) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (project_id, user_id) DO NOTHING`,
          [p.id, u.id, role]
        );
      }
    }

    console.log('Seeding mock tasks...');
    for (const t of tasks) {
      const { rows } = await client.query('SELECT 1 FROM tasks WHERE id = $1', [t.id]);
      if (rows.length === 0) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + t.dueDateOffset);
        await client.query(
          `INSERT INTO tasks (id, project_id, parent_task_id, title, description, status, priority, assignee_id, due_date, created_by)
           VALUES ($1, $2, $3, $4, $5, $6::task_status, $7::task_priority, $8, $9, $10)`,
          [t.id, t.projectId, t.parentTaskId || null, t.title, t.description, t.status, t.priority, t.assigneeId, dueDate, users[4].id]
        );
      }
    }

    console.log('Seeding task relations...');
    // IDP-155 is blocked by IDP-142
    await client.query(
      `INSERT INTO task_relations (task_id, related_task_id, relation_type) 
       VALUES ($1, $2, 'blocked_by') ON CONFLICT DO NOTHING`,
      ['f0000000-0000-0000-0000-000000000155', 'f0000000-0000-0000-0000-000000000142']
    );
    await client.query(
      `INSERT INTO task_relations (task_id, related_task_id, relation_type) 
       VALUES ($1, $2, 'blocks') ON CONFLICT DO NOTHING`,
      ['f0000000-0000-0000-0000-000000000142', 'f0000000-0000-0000-0000-000000000155']
    );

    // DPX-22 is blocked by DPX-14
    await client.query(
      `INSERT INTO task_relations (task_id, related_task_id, relation_type) 
       VALUES ($1, $2, 'blocked_by') ON CONFLICT DO NOTHING`,
      ['f0000000-0000-0000-0000-000000000022', 'f0000000-0000-0000-0000-000000000014']
    );
    await client.query(
      `INSERT INTO task_relations (task_id, related_task_id, relation_type) 
       VALUES ($1, $2, 'blocks') ON CONFLICT DO NOTHING`,
      ['f0000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-000000000022']
    );

    // Seed mock RCAs
    console.log('Seeding mock RCAs...');
    const rcaId1 = 'c0000000-0000-0000-0000-000000000014';
    const { rows: rca1Rows } = await client.query('SELECT 1 FROM rcas WHERE id = $1', [rcaId1]);
    if (rca1Rows.length === 0) {
      await client.query(
        `INSERT INTO rcas (id, project_id, task_id, title, severity, status, created_by, created_at)
         VALUES ($1, $2, $3, $4, 'SEV-1', 'in_review', $5, now() - interval '4 days')`,
        [rcaId1, projects[1].id, 'f0000000-0000-0000-0000-000000000088', 'Payments API 47-minute outage during EU peak', users[2].id]
      );

      await client.query(`INSERT INTO rca_sections (rca_id, section_type, content) VALUES ($1, 'timeline', $2) ON CONFLICT DO NOTHING`, [rcaId1, '14:02 UTC - PagerDuty fires: p99 latency > 8s on /charge.\n14:07 UTC - Incident commander declares SEV-1; war room opened.\n14:24 UTC - Root cause suspected: Redis maxmemory eviction due to unbounded stream buffer.\n14:41 UTC - Failover to warm replica; traffic recovers.\n14:49 UTC - All-clear; monitoring elevated for 2h.']);
      await client.query(`INSERT INTO rca_sections (rca_id, section_type, content) VALUES ($1, 'contributing_factors', $2) ON CONFLICT DO NOTHING`, [rcaId1, 'Unbounded stream buffer in ledger consumer worker.\nRedis maxmemory policy set to noeviction on the primary.\nAlerting threshold on RSS was 5m averaged, delaying detection.']);
      await client.query(`INSERT INTO rca_sections (rca_id, section_type, content) VALUES ($1, 'corrective_actions', $2) ON CONFLICT DO NOTHING`, [rcaId1, 'Cap consumer buffer at 10k messages with backpressure.\nChange maxmemory-policy to allkeys-lru with paging alarms.\nReduce RSS alert window to 60s.']);
      await client.query(`INSERT INTO rca_sections (rca_id, section_type, content) VALUES ($1, 'preventive_measures', $2) ON CONFLICT DO NOTHING`, [rcaId1, 'Add chaos test: kill primary Redis under peak load monthly.\nPublish runbook for Redis failover with automated toggle.\nQuarterly capacity review for ledger workers.']);

      // Reviewers for RCA-014
      await client.query(`INSERT INTO reviews (rca_id, reviewer_id, decision, comment, decided_at) VALUES ($1, $2, 'approved', 'Actions cover the immediate risk. Approving.', now() - interval '2 days') ON CONFLICT DO NOTHING`, [rcaId1, users[4].id]);
      await client.query(`INSERT INTO reviews (rca_id, reviewer_id, decision, comment, decided_at) VALUES ($1, $2, 'rejected', 'Need explicit owner + deadline on each corrective action.', now() - interval '1 day') ON CONFLICT DO NOTHING`, [rcaId1, users[5].id]);
      await client.query(`INSERT INTO reviews (rca_id, reviewer_id, decision, comment) VALUES ($1, $2, null, null) ON CONFLICT DO NOTHING`, [rcaId1, users[0].id]);
    }

    const rcaId2 = 'c0000000-0000-0000-0000-000000000011';
    const { rows: rca2Rows } = await client.query('SELECT 1 FROM rcas WHERE id = $1', [rcaId2]);
    if (rca2Rows.length === 0) {
      await client.query(
        `INSERT INTO rcas (id, project_id, task_id, title, severity, status, created_by, created_at)
         VALUES ($1, $2, $3, $4, 'SEV-2', 'draft', $5, now() - interval '11 days')`,
        [rcaId2, projects[0].id, 'f0000000-0000-0000-0000-000000000142', 'Login latency regression after JWT rollout (canary)', users[0].id]
      );
      await client.query(`INSERT INTO rca_sections (rca_id, section_type, content) VALUES ($1, 'timeline', $2) ON CONFLICT DO NOTHING`, [rcaId2, '09:12 UTC - Canary deployed to 5% traffic.\n09:34 UTC - Latency dashboard shows p95 regression.\n09:41 UTC - Canary rolled back automatically.']);
      await client.query(`INSERT INTO rca_sections (rca_id, section_type, content) VALUES ($1, 'contributing_factors', $2) ON CONFLICT DO NOTHING`, [rcaId2, 'RSA signing key loaded per-request instead of cached.']);
      await client.query(`INSERT INTO rca_sections (rca_id, section_type, content) VALUES ($1, 'corrective_actions', $2) ON CONFLICT DO NOTHING`, [rcaId2, 'Introduce keyring cache with 5m TTL.']);
      await client.query(`INSERT INTO rca_sections (rca_id, section_type, content) VALUES ($1, 'preventive_measures', $2) ON CONFLICT DO NOTHING`, [rcaId2, 'Add load test gate to canary pipeline.']);

      await client.query(`INSERT INTO reviews (rca_id, reviewer_id, decision, comment) VALUES ($1, $2, null, null) ON CONFLICT DO NOTHING`, [rcaId2, users[4].id]);
    }

    // Comments
    await client.query(
      `INSERT INTO comments (task_id, author_id, body) 
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      ['f0000000-0000-0000-0000-000000000142', users[4].id, 'let us ensure rotation lands before EU cutover.']
    );
    await client.query(
      `INSERT INTO comments (task_id, author_id, body) 
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      ['f0000000-0000-0000-0000-000000000142', users[0].id, 'Rotation PR up, waiting on review.']
    );

    await client.query('COMMIT');
    console.log('Seeding completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err.message);
  } finally {
    client.release();
  }
}

module.exports = { seed };
