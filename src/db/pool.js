const { Pool } = require('pg')
const { env } = require('../config/env')

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.pgSsl ? { rejectUnauthorized: false } : undefined,
})

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error', err)
})

module.exports = { pool }
