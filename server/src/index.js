require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./db/pool');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const projectsRoutes = require('./routes/projects.routes');
const tasksRoutes = require('./routes/tasks.routes');
const rcaRoutes = require('./routes/rca.routes');
const commentsRoutes = require('./routes/comments.routes');
const attachmentsRoutes = require('./routes/attachments.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const exportRoutes = require('./routes/export.routes');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes(pool));
app.use('/api/users', usersRoutes(pool));
app.use('/api/projects', projectsRoutes(pool));
app.use('/api/tasks', tasksRoutes(pool));
app.use('/api/rca', rcaRoutes(pool));

// Comments and attachments are shared entities, mounted under both parents.
app.use('/api/tasks/:taskId/comments', commentsRoutes(pool, { parentField: 'task_id' }));
app.use('/api/rca/:rcaId/comments', commentsRoutes(pool, { parentField: 'rca_id' }));
app.use('/api/tasks/:taskId/attachments', attachmentsRoutes(pool, { parentField: 'task_id' }));
app.use('/api/rca/:rcaId/attachments', attachmentsRoutes(pool, { parentField: 'rca_id' }));

app.use('/api/notifications', notificationsRoutes(pool));
app.use('/api/projects/:projectId/analytics', analyticsRoutes(pool));
app.use('/api/projects/:projectId/export', exportRoutes(pool));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`TeamFlow API listening on :${port}`));
