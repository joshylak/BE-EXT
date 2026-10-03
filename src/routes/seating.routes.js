const express = require('express')
const { pool } = require('../db/pool')
const { requireAuth } = require('../middleware/auth.middleware')
const { broadcast } = require('../events')

const router = express.Router()
router.use(requireAuth)

async function getTableMeta() {
  const { rows } = await pool.query('SELECT id, capacity FROM tables')
  const map = {}
  for (const r of rows) map[r.id] = r.capacity
  return map
}

async function buildFullSeatingState() {
  const tableCapacity = await getTableMeta()
  const state = {}
  for (const id of Object.keys(tableCapacity)) {
    state[id] = Array(tableCapacity[id]).fill('')
  }

  const { rows } = await pool.query(
    "SELECT table_id, seat_index, guest_name FROM seats WHERE guest_name <> ''",
  )
  for (const r of rows) {
    if (!state[r.table_id]) continue
    if (r.seat_index >= 0 && r.seat_index < state[r.table_id].length) {
      state[r.table_id][r.seat_index] = r.guest_name
    }
  }
  return state
}

async function getTableRow(tableId) {
  const { rows } = await pool.query('SELECT id, capacity FROM tables WHERE id = $1', [tableId])
  return rows[0] || null
}

// GET /api/seating -> { [tableId]: string[] } full chart, length = capacity, '' = open seat
router.get('/', async (req, res, next) => {
  try {
    res.json(await buildFullSeatingState())
  } catch (err) {
    next(err)
  }
})

// PUT /api/seating/:tableId/:seatIndex  { name } -> set/clear one seat, returns full state
router.put('/:tableId/:seatIndex', async (req, res, next) => {
  try {
    const { tableId } = req.params
    const seatIndex = Number(req.params.seatIndex)
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''

    const table = await getTableRow(tableId)
    if (!table) return res.status(400).json({ error: 'Unknown tableId' })
    if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= table.capacity) {
      return res.status(400).json({ error: `seatIndex must be between 0 and ${table.capacity - 1}` })
    }

    if (name) {
      await pool.query(
        `INSERT INTO seats (table_id, seat_index, guest_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (table_id, seat_index) DO UPDATE SET guest_name = EXCLUDED.guest_name, updated_at = now()`,
        [tableId, seatIndex, name],
      )
    } else {
      await pool.query('DELETE FROM seats WHERE table_id = $1 AND seat_index = $2', [
        tableId,
        seatIndex,
      ])
    }

    broadcast('seating')
    res.json(await buildFullSeatingState())
  } catch (err) {
    next(err)
  }
})

// POST /api/seating/move { fromTableId, fromSeatIndex, toTableId }
// Moves a guest to the first open seat at the destination; clears the source seat.
router.post('/move', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { fromTableId, toTableId } = req.body
    const fromSeatIndex = Number(req.body.fromSeatIndex)

    const [fromTable, toTable] = await Promise.all([
      getTableRow(fromTableId),
      getTableRow(toTableId),
    ])
    if (!fromTable) return res.status(400).json({ error: 'Unknown fromTableId' })
    if (!toTable) return res.status(400).json({ error: 'Unknown toTableId' })
    if (
      !Number.isInteger(fromSeatIndex) ||
      fromSeatIndex < 0 ||
      fromSeatIndex >= fromTable.capacity
    ) {
      return res.status(400).json({ error: 'fromSeatIndex out of range' })
    }

    await client.query('BEGIN')

    const { rows: sourceRows } = await client.query(
      'SELECT guest_name FROM seats WHERE table_id = $1 AND seat_index = $2',
      [fromTableId, fromSeatIndex],
    )
    const name = sourceRows[0] ? sourceRows[0].guest_name.trim() : ''
    if (!name) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Source seat is empty' })
    }

    const { rows: occupied } = await client.query(
      "SELECT seat_index FROM seats WHERE table_id = $1 AND guest_name <> ''",
      [toTableId],
    )
    const taken = new Set(occupied.map((r) => r.seat_index))
    let destIndex = -1
    for (let i = 0; i < toTable.capacity; i++) {
      if (!taken.has(i)) {
        destIndex = i
        break
      }
    }

    if (destIndex === -1) {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: 'Destination table is full' })
    }

    await client.query(
      `INSERT INTO seats (table_id, seat_index, guest_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (table_id, seat_index) DO UPDATE SET guest_name = EXCLUDED.guest_name, updated_at = now()`,
      [toTableId, destIndex, name],
    )
    await client.query('DELETE FROM seats WHERE table_id = $1 AND seat_index = $2', [
      fromTableId,
      fromSeatIndex,
    ])

    await client.query('COMMIT')
    broadcast('seating')
    res.json(await buildFullSeatingState())
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

// POST /api/seating/clear/:tableId -> empties every seat at that table
router.post('/clear/:tableId', async (req, res, next) => {
  try {
    const table = await getTableRow(req.params.tableId)
    if (!table) return res.status(400).json({ error: 'Unknown tableId' })

    await pool.query('DELETE FROM seats WHERE table_id = $1', [table.id])
    broadcast('seating')
    res.json(await buildFullSeatingState())
  } catch (err) {
    next(err)
  }
})

module.exports = router
