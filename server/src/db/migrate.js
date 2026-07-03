// Minimal migration runner: applies db/schema.sql then anything in
// db/migrations/*.sql in filename order, tracked in a schema_migrations table.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);

    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.name));

    if (!applied.has('schema.sql')) {
      const schemaPath = path.join(__dirname, '..', '..', 'db', 'schema.sql');
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', ['schema.sql']);
      await client.query('COMMIT');
      console.log('Applied schema.sql');
      
      // Auto-run seed to populate mock data
      const { seed } = require('./seed');
      await seed();
    }

    const migrationsDir = path.join(__dirname, '..', '..', 'db', 'migrations');
    const files = fs.existsSync(migrationsDir)
      ? fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
      : [];

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied ${file}`);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
