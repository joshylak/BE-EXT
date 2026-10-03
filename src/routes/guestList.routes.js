const express = require('express')
const { pool } = require('../db/pool')
const { requireAuth } = require('../middleware/auth.middleware')
const { broadcast } = require('../events')

const router = express.Router()
router.use(requireAuth)

// GET /api/guest-list -> string[]
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT name FROM guest_list ORDER BY id ASC')
    res.json(rows.map((r) => r.name))
  } catch (err) {
    next(err)
  }
})

// PUT /api/guest-list { names: string[] } -> full replace
router.put('/', async (req, res, next) => {
  const { names } = req.body
  if (!Array.isArray(names) || !names.every((n) => typeof n === 'string')) {
    return res.status(400).json({ error: 'Body must be { "names": string[] }' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM guest_list')
    for (const raw of names) {
      const name = raw.trim()
      if (!name) continue
      await client.query('INSERT INTO guest_list (name) VALUES ($1)', [name])
    }
    await client.query('COMMIT')

    broadcast('guestList')
    const { rows } = await pool.query('SELECT name FROM guest_list ORDER BY id ASC')
    res.json(rows.map((r) => r.name))
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

module.exports = router
