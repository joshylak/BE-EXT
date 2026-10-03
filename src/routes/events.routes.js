const express = require('express')
const jwt = require('jsonwebtoken')
const { env } = require('../config/env')
const { bus } = require('../events')

const router = express.Router()

// GET /api/events -> SSE stream, emits a message whenever seating/guest-list changes.
// Native EventSource can't set an Authorization header, so the token is also accepted
// as a ?token= query param here (nowhere else).
router.get('/', (req, res) => {
  const header = req.headers.authorization
  const headerToken = header && header.startsWith('Bearer ') ? header.slice(7) : null
  const token = headerToken || (typeof req.query.token === 'string' ? req.query.token : null)

  if (!token) return res.status(401).json({ error: 'Missing bearer token' })
  try {
    jwt.verify(token, env.jwtSecret)
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  res.write('retry: 2000\n\n')

  const onChange = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
  }
  bus.on('change', onChange)

  const keepAlive = setInterval(() => {
    res.write(': ping\n\n')
  }, 25000)

  req.on('close', () => {
    clearInterval(keepAlive)
    bus.off('change', onChange)
  })
})

module.exports = router
