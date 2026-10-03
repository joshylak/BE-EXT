const { EventEmitter } = require('events')

const bus = new EventEmitter()

function broadcast(type) {
  bus.emit('change', { type, at: new Date().toISOString() })
}

module.exports = { bus, broadcast }
