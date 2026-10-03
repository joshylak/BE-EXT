const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { env } = require('./config/env')
const { notFound, errorHandler } = require('./middleware/error.middleware')

const authRoutes = require('./routes/auth.routes')
const tablesRoutes = require('./routes/tables.routes')
const seatingRoutes = require('./routes/seating.routes')
const guestListRoutes = require('./routes/guestList.routes')
const exportRoutes = require('./routes/export.routes')
const importRoutes = require('./routes/import.routes')
const eventsRoutes = require('./routes/events.routes')

const app = express()

app.use(helmet())
app.use(
  cors({
    origin: env.corsOrigin.includes('*') ? true : env.corsOrigin,
  }),
)
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

app.use('/api/auth', authRoutes)
app.use('/api/tables', tablesRoutes)
app.use('/api/seating', seatingRoutes)
app.use('/api/guest-list', guestListRoutes)
app.use('/api/export', exportRoutes)
app.use('/api/import', importRoutes)
app.use('/api/events', eventsRoutes)

app.use(notFound)
app.use(errorHandler)

module.exports = app
