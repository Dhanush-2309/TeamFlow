const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAuth, requireProjectMember } = require('../middleware/auth');
const { logActivity } = require('../services/activityLogService');
const { notify } = require('../services/notificationService');
const { HttpError } = require('../utils/httpError');

const SECTION_TYPES = ['timeline', 'contributing_factors', 'corrective_actions', 'preventive_measures'];

module.exports = function rcaRoutes(pool) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', asyncHandler(async (req, res) => {
    const { project_id, status } = req.query;
    if (!project_id) throw new HttpError(400, 'project_id query param is required');
    const params = [project_id];
    let where = 'project_id = $1';
    if (status) { params.push(status); where += ` AND status = $${params.length}`; }
    const { rows } = await pool.query(`SELECT * FROM rcas WHERE ${where} ORDER BY created_at DESC`, params);
    res.json(rows);
  }));

  router.post('/', requireProjectMember(pool), asyncHandler(async (req, res) => {
    const { title, severity, task_id } = req.body;
    if (!title) throw new HttpError(400, 'title is required');
    const projectId = req.params.projectId || req.body.project_id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO rcas (project_id, task_id, title, severity, created_by) VALUES ($1,$2,$3,COALESCE($4,'SEV-2')::rca_severity,$5) RETURNING *`,
        [projectId, task_id || null, title, severity || null, req.user.id]
      );
      const rca = rows[0];
      for (const sectionType of SECTION_TYPES) {
        await client.query(
          `INSERT INTO rca_sections (rca_id, section_type, content) VALUES ($1, $2, '')`,
          [rca.id, sectionType]
        );
      }
      await logActivity(client, { entityType: 'rca', entityId: rca.id, actorId: req.user.id, action: 'created' });
      await client.query('COMMIT');
      res.status(201).json(rca);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }));

  router.get('/:rcaId', asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM rcas WHERE id = $1', [req.params.rcaId]);
    if (rows.length === 0) throw new HttpError(404, 'RCA not found');
    const { rows: sections } = await pool.query('SELECT * FROM rca_sections WHERE rca_id = $1 ORDER BY section_type', [req.params.rcaId]);
    const { rows: reviews } = await pool.query(
      `SELECT rv.*, u.name AS reviewer_name, u.email AS reviewer_email, u.theme AS reviewer_theme
         FROM reviews rv JOIN users u ON u.id = rv.reviewer_id WHERE rca_id = $1`,
      [req.params.rcaId]
    );
    res.json({ ...rows[0], sections, reviews });
  }));

  router.patch('/:rcaId/sections/:sectionType', asyncHandler(async (req, res) => {
    const { sectionType } = req.params;
    if (!SECTION_TYPES.includes(sectionType)) throw new HttpError(400, 'Unknown section type');
    const { content } = req.body;
    const { rows } = await pool.query(
      `UPDATE rca_sections SET content = $1, updated_at = now() WHERE rca_id = $2 AND section_type = $3 RETURNING *`,
      [content ?? '', req.params.rcaId, sectionType]
    );
    if (rows.length === 0) throw new HttpError(404, 'Section not found');
    res.json(rows[0]);
  }));

  router.post('/:rcaId/submit', asyncHandler(async (req, res) => {
    const { reviewer_ids } = req.body;
    if (!Array.isArray(reviewer_ids) || reviewer_ids.length === 0) {
      throw new HttpError(400, 'reviewer_ids must be a non-empty array');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: rcaRows } = await client.query('SELECT * FROM rcas WHERE id = $1 FOR UPDATE', [req.params.rcaId]);
      if (rcaRows.length === 0) throw new HttpError(404, 'RCA not found');
      if (!['draft', 'rejected', 'in_review'].includes(rcaRows[0].status)) {
        throw new HttpError(422, `RCA cannot be submitted from status '${rcaRows[0].status}'`);
      }

      await client.query('DELETE FROM reviews WHERE rca_id = $1', [req.params.rcaId]);
      for (const reviewerId of reviewer_ids) {
        await client.query(
          `INSERT INTO reviews (rca_id, reviewer_id) VALUES ($1, $2) ON CONFLICT (rca_id, reviewer_id) DO NOTHING`,
          [req.params.rcaId, reviewerId]
        );
      }

      const { rows } = await client.query(
        `UPDATE rcas SET status = 'in_review', submitted_at = now() WHERE id = $1 RETURNING *`,
        [req.params.rcaId]
      );
      const rca = rows[0];
      await logActivity(client, {
        entityType: 'rca', entityId: rca.id, actorId: req.user.id, action: 'submitted',
        context: { reviewer_ids },
      });
      await client.query('COMMIT');

      for (const reviewerId of reviewer_ids) {
        const { rows: reviewer } = await pool.query('SELECT email_opt_out FROM users WHERE id = $1', [reviewerId]);
        await notify(pool, {
          userId: reviewerId, eventType: 'rca_submitted', entityType: 'rca', entityId: rca.id,
          message: `"${rca.title}" was submitted for your review`,
          emailOptedOut: reviewer[0]?.email_opt_out,
        });
      }

      res.json(rca);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }));

  router.post('/:rcaId/reviews/:reviewId/decide', asyncHandler(async (req, res) => {
    const { decision, comment } = req.body;
    if (!['approved', 'rejected'].includes(decision)) throw new HttpError(400, "decision must be 'approved' or 'rejected'");
    if (!comment || !comment.trim()) throw new HttpError(400, 'A review comment is mandatory');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: reviewRows } = await client.query('SELECT * FROM reviews WHERE id = $1 FOR UPDATE', [req.params.reviewId]);
      if (reviewRows.length === 0) throw new HttpError(404, 'Review assignment not found');
      const review = reviewRows[0];
      if (review.reviewer_id !== req.user.id) throw new HttpError(403, 'Only the assigned reviewer can decide');
      if (review.decision !== null) throw new HttpError(409, 'This review has already been decided');

      await client.query(
        `UPDATE reviews SET decision = $1, comment = $2, decided_at = now() WHERE id = $3`,
        [decision, comment.trim(), req.params.reviewId]
      );

      const { rows: allReviews } = await client.query('SELECT decision FROM reviews WHERE rca_id = $1', [review.rca_id]);
      const allDecided = allReviews.every((r) => r.decision !== null);
      let newStatus = null;
      if (allDecided) {
        const anyRejected = allReviews.some((r) => r.decision === 'rejected');
        newStatus = anyRejected ? 'rejected' : 'approved';
        await client.query('UPDATE rcas SET status = $1 WHERE id = $2', [newStatus, review.rca_id]);
      }

      await logActivity(client, {
        entityType: 'rca', entityId: review.rca_id, actorId: req.user.id, action: 'review_decided',
        context: { decision, all_decided: allDecided, resulting_status: newStatus },
      });
      await client.query('COMMIT');

      const { rows: rcaRows } = await pool.query('SELECT * FROM rcas WHERE id = $1', [review.rca_id]);
      const rca = rcaRows[0];

      if (allDecided) {
        const { rows: author } = await pool.query('SELECT email_opt_out FROM users WHERE id = $1', [rca.created_by]);
        await notify(pool, {
          userId: rca.created_by, eventType: 'rca_review_decision', entityType: 'rca', entityId: rca.id,
          message: `"${rca.title}" is now ${newStatus} -- all reviewers have decided`,
          emailOptedOut: author[0]?.email_opt_out,
        });
      }

      res.json({ rca, all_decided: allDecided });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }));

  router.post('/:rcaId/close', asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM rcas WHERE id = $1', [req.params.rcaId]);
    if (rows.length === 0) throw new HttpError(404, 'RCA not found');
    if (rows[0].status !== 'approved') throw new HttpError(422, 'Only an approved RCA can be closed');

    const { rows: updated } = await pool.query(
      `UPDATE rcas SET status = 'closed', closed_at = now() WHERE id = $1 RETURNING *`,
      [req.params.rcaId]
    );
    res.json(updated[0]);
  }));

  return router;
};
