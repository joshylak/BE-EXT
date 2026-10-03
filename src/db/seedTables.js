const { pool } = require('./pool')

function sideName(side) {
  return side === 'B' ? "Bride's" : "Groom's"
}

function buildSide(side, guestNumbers) {
  let order = side === 'B' ? 0 : 1000
  const rows = []

  rows.push({
    id: `${side}1`,
    side,
    shortLabel: 'VIP',
    title: `${sideName(side)} VIP Table (${side}1)`,
    kind: 'vip',
    capacity: 10,
    sortOrder: order++,
  })

  for (const n of guestNumbers) {
    rows.push({
      id: `${side}${n}`,
      side,
      shortLabel: `${n}`,
      title: `${sideName(side)} Table ${n}`,
      kind: 'guest',
      capacity: 10,
      sortOrder: order++,
    })
  }

  rows.push({
    id: `${side}-COUCH`,
    side,
    shortLabel: 'Couch',
    title: `${sideName(side)} Parents Couch`,
    kind: 'couch',
    capacity: 6,
    sortOrder: order++,
  })

  return rows
}

const TABLES = [
  ...buildSide('B', [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]),
  ...buildSide('G', [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]),
]

async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const t of TABLES) {
      await client.query(
        `INSERT INTO tables (id, side, short_label, title, kind, capacity, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           side = EXCLUDED.side,
           short_label = EXCLUDED.short_label,
           title = EXCLUDED.title,
           kind = EXCLUDED.kind,
           capacity = EXCLUDED.capacity,
           sort_order = EXCLUDED.sort_order`,
        [t.id, t.side, t.shortLabel, t.title, t.kind, t.capacity, t.sortOrder],
      )
    }
    await client.query('COMMIT')
    console.log(`Seeded ${TABLES.length} tables.`)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

seed().catch((err) => {
  console.error('Seeding failed', err)
  process.exit(1)
})
