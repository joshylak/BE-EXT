const jwt = require('jsonwebtoken')
const { env } = require('../config/env')

function requireAuth(req, res, next) {
  const header = req.headers.authorization
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' })
  }

  try {
    jwt.verify(token, env.jwtSecret)
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

module.exports = { requireAuth }
