const express = require('express')
const { pool } = require('../db/pool')
const { requireAuth } = require('../middleware/auth.middleware')

const router = express.Router()
router.use(requireAuth)

async function buildFullSeatingState() {
  const { rows: tables } = await pool.query('SELECT id, capacity FROM tables')
  const state = {}
  for (const t of tables) state[t.id] = Array(t.capacity).fill('')

  const { rows: seats } = await pool.query(
    "SELECT table_id, seat_index, guest_name FROM seats WHERE guest_name <> ''",
  )
  for (const s of seats) {
    if (state[s.table_id] && s.seat_index >= 0 && s.seat_index < state[s.table_id].length) {
      state[s.table_id][s.seat_index] = s.guest_name
    }
  }
  return state
}

async function getGuestList() {
  const { rows } = await pool.query('SELECT name FROM guest_list ORDER BY id ASC')
  return rows.map((r) => r.name)
}

function csvEscape(value) {
  const str = String(value ?? '')
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// GET /api/export/csv -> Table,Kind,Side,Seat,Guest Name (filled seats only)
router.get('/csv', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.short_label, t.kind, t.side, s.seat_index, s.guest_name
       FROM seats s
       JOIN tables t ON t.id = s.table_id
       WHERE s.guest_name <> ''
       ORDER BY t.sort_order ASC, s.seat_index ASC`,
    )

    const lines = [['Table', 'Kind', 'Side', 'Seat', 'Guest Name'].join(',')]
    for (const r of rows) {
      lines.push(
        [
          csvEscape(r.short_label),
          csvEscape(r.kind),
          csvEscape(r.side),
          csvEscape(r.seat_index + 1),
          csvEscape(r.guest_name),
        ].join(','),
      )
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="seating-chart.csv"')
    res.send(lines.join('\n'))
  } catch (err) {
    next(err)
  }
})

// GET /api/export/backup -> { seating, guestList } full snapshot
router.get('/backup', async (req, res, next) => {
  try {
    const [seating, guestList] = await Promise.all([buildFullSeatingState(), getGuestList()])
    res.setHeader('Content-Disposition', 'attachment; filename="seating-chart-backup.json"')
    res.json({ seating, guestList })
  } catch (err) {
    next(err)
  }
})

module.exports = router
