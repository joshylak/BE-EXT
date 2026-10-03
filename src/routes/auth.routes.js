const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const rateLimit = require('express-rate-limit')
const { env } = require('../config/env')

const router = express.Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again later.' },
})

// POST /api/auth/login { password } -> { token }
router.post('/login', loginLimiter, async (req, res) => {
  const password = typeof req.body.password === 'string' ? req.body.password.trim() : ''

  if (!password) {
    return res.status(400).json({ error: 'password is required' })
  }

  let ok = false
  if (env.seatingPasswordHash) {
    ok = await bcrypt.compare(password, env.seatingPasswordHash)
  } else {
    ok = password.toLowerCase() === env.seatingPassword.trim().toLowerCase()
  }

  if (!ok) {
    return res.status(401).json({ error: 'Incorrect password' })
  }

  const token = jwt.sign({ role: 'planner' }, env.jwtSecret, { expiresIn: env.jwtExpiresIn })
  res.json({ token })
})

// GET /api/auth/session -> { ok: true } if the bearer token is valid, else 401
router.get('/session', (req, res) => {
  const header = req.headers.authorization
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Missing bearer token' })

  try {
    jwt.verify(token, env.jwtSecret)
    res.json({ ok: true })
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
})

module.exports = router
