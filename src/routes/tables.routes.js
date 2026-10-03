const express = require('express')
const { pool } = require('../db/pool')
const { requireAuth } = require('../middleware/auth.middleware')

const router = express.Router()

function toDTO(row) {
  return {
    id: row.id,
    side: row.side,
    shortLabel: row.short_label,
    title: row.title,
    kind: row.kind,
    capacity: row.capacity,
  }
}

// GET /api/tables -> full venue layout (all 36 tables)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tables ORDER BY sort_order ASC')
    res.json(rows.map(toDTO))
  } catch (err) {
    next(err)
  }
})

// GET /api/tables/:id -> single table
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tables WHERE id = $1', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ error: 'Table not found' })
    res.json(toDTO(rows[0]))
  } catch (err) {
    next(err)
  }
})

module.exports = router
