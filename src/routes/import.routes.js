const express = require('express')
const { pool } = require('../db/pool')
const { requireAuth } = require('../middleware/auth.middleware')
const { broadcast } = require('../events')

const router = express.Router()
router.use(requireAuth)

// POST /api/import/backup { seating, guestList } -> restores both, overwriting current state
router.post('/backup', async (req, res, next) => {
  const { seating, guestList } = req.body || {}

  if (seating !== undefined && (typeof seating !== 'object' || seating === null || Array.isArray(seating))) {
    return res.status(400).json({ error: 'seating must be a { tableId: string[] } object' })
  }
  if (guestList !== undefined && !Array.isArray(guestList)) {
    return res.status(400).json({ error: 'guestList must be a string[]' })
  }

  const client = await pool.connect()
  try {
    const { rows: tables } = await client.query('SELECT id, capacity FROM tables')
    const capacityByTable = {}
    for (const t of tables) capacityByTable[t.id] = t.capacity

    await client.query('BEGIN')

    if (seating) {
      await client.query('DELETE FROM seats')
      for (const [tableId, seats] of Object.entries(seating)) {
        const capacity = capacityByTable[tableId]
        if (capacity === undefined || !Array.isArray(seats)) continue
        for (let i = 0; i < Math.min(seats.length, capacity); i++) {
          const name = typeof seats[i] === 'string' ? seats[i].trim() : ''
          if (!name) continue
          await client.query(
            `INSERT INTO seats (table_id, seat_index, guest_name)
             VALUES ($1, $2, $3)
             ON CONFLICT (table_id, seat_index) DO UPDATE SET guest_name = EXCLUDED.guest_name, updated_at = now()`,
            [tableId, i, name],
          )
        }
      }
    }

    if (guestList) {
      await client.query('DELETE FROM guest_list')
      for (const raw of guestList) {
        const name = typeof raw === 'string' ? raw.trim() : ''
        if (!name) continue
        await client.query('INSERT INTO guest_list (name) VALUES ($1)', [name])
      }
    }

    await client.query('COMMIT')
    broadcast('seating')
    broadcast('guestList')

    const state = {}
    for (const t of tables) state[t.id] = Array(t.capacity).fill('')
    const { rows: seatRows } = await pool.query(
      "SELECT table_id, seat_index, guest_name FROM seats WHERE guest_name <> ''",
    )
    for (const r of seatRows) {
      if (state[r.table_id] && r.seat_index < state[r.table_id].length) {
        state[r.table_id][r.seat_index] = r.guest_name
      }
    }
    const { rows: gl } = await pool.query('SELECT name FROM guest_list ORDER BY id ASC')

    res.json({ seating: state, guestList: gl.map((g) => g.name) })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

module.exports = router
