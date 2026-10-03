function notFound(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` })
}

function errorHandler(err, req, res, next) {
  console.error(err)
  const status = err.status || 500
  res.status(status).json({ error: err.message || 'Internal server error' })
}

module.exports = { notFound, errorHandler }
