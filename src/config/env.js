require('dotenv').config()

function required(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  databaseUrl: required('DATABASE_URL'),
  pgSsl: process.env.PG_SSL === 'true',
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  seatingPassword: process.env.SEATING_PASSWORD || '',
  seatingPasswordHash: process.env.SEATING_PASSWORD_HASH || '',
  corsOrigin: (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim()),
}

if (!env.seatingPassword && !env.seatingPasswordHash) {
  throw new Error('Set SEATING_PASSWORD or SEATING_PASSWORD_HASH in the environment')
}

module.exports = { env }
