const express = require('express');
const multer = require('multer');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { saveBuffer, readBuffer } = require('../services/storage');
const { HttpError } = require('../utils/httpError');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (Number(process.env.MAX_UPLOAD_SIZE_MB) || 25) * 1024 * 1024 },
});

module.exports = function attachmentsRoutes(pool, { parentField }) {
  const router = express.Router({ mergeParams: true });
  router.use(requireAuth);
  const parentParam = parentField === 'task_id' ? 'taskId' : 'rcaId';

  router.get('/', asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT id, file_name, content_type, size_bytes, uploaded_by, created_at
         FROM attachments WHERE ${parentField} = $1 ORDER BY created_at DESC`,
      [req.params[parentParam]]
    );
    res.json(rows);
  }));

  router.post('/', upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'file is required (multipart field "file")');
    const storageKey = saveBuffer(req.file.buffer, req.file.originalname);

    const { rows } = await pool.query(
      `INSERT INTO attachments (${parentField}, file_name, content_type, size_bytes, storage_path, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, file_name, content_type, size_bytes, created_at`,
      [req.params[parentParam], req.file.originalname, req.file.mimetype, req.file.size, storageKey, req.user.id]
    );
    res.status(201).json(rows[0]);
  }));

  router.get('/:attachmentId/download', asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM attachments WHERE id = $1', [req.params.attachmentId]);
    if (rows.length === 0) throw new HttpError(404, 'Attachment not found');
    const file = rows[0];
    const buffer = readBuffer(file.storage_path);
    res.setHeader('Content-Type', file.content_type);
    res.setHeader('Content-Disposition', `attachment; filename="${file.file_name}"`);
    res.send(buffer);
  }));

  return router;
};
