const Swarm = require('corestore-swarm-networking')
const memorySwarm = require('@wirelineio/hyperswarm-network-memory')
const HypercoreProtocol = require('hypercore-protocol')
const pump = require('pump')

class TestSwarm extends Swarm {
  listen () {
    const self = this
    this._swarm = memorySwarm({
      ...this.opts,
      queue: { multiplex: true }
    })
    this._swarm.on('error', err => this.emit('error', err))
    this._swarm.on('connection', (socket, info) => {
      const isInitiator = !!info.client
      if (
        socket.remoteAddress === '::ffff:127.0.0.1' ||
        socket.remoteAddress === '127.0.0.1'
      ) {
        return null
      }

      const protocolStream = new HypercoreProtocol(isInitiator, {
        ...this._replicationOpts
      })
      protocolStream.on('handshake', () => {
        onhandshake()
      })

      function onhandshake () {
        self._replicate(protocolStream)
        self._replicationStreams.push(protocolStream)
      }

      return pump(socket, protocolStream, socket, err => {
        if (err) this.emit('replication-error', err)
        const idx = this._replicationStreams.indexOf(protocolStream)
        if (idx === -1) return
        this._replicationStreams.splice(idx, 1)
      })
    })
  }

  async close () {
    if (!this._swarm) return null

    this._swarm = null
  }
}

module.exports = (...args) => new TestSwarm(...args)
