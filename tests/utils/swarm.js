const Swarm = require('corestore-swarm-networking')
const memorySwarm = require('@wirelineio/hyperswarm-network-memory')
const HypercoreProtocol = require('hypercore-protocol')
const pump = require('pump')
const datEncoding = require('dat-encoding')

class TestSwarm extends Swarm {
  _listen () {
    const self = this
    if (this.swarm) return

    this.swarm = memorySwarm({
      ...this.opts,
      queue: { multiplex: true }
    })

    this.swarm.on('error', err => this.emit('error', err))
    this.swarm.on('connection', (socket, info) => {
      const isInitiator = !!info.client
      if (
        socket.remoteAddress === '::ffff:127.0.0.1' ||
        socket.remoteAddress === '127.0.0.1'
      ) {
        return null
      }

      // We block all the corestore's ifAvailable guards until the connection's handshake has succeeded or the stream closes.
      let handshaking = true
      this.corestore.guard.wait()

      const protocolStream = new HypercoreProtocol(isInitiator, {
        ...this._replicationOpts
      })
      protocolStream.on('handshake', () => {
        onhandshake()
      })
      protocolStream.on('close', () => {
        this.emit('stream-closed', protocolStream)
        ifAvailableContinue()
      })

      pump(socket, protocolStream, socket, err => {
        if (err) this.emit('replication-error', err)
        const idx = this._replicationStreams.indexOf(protocolStream)
        if (idx === -1) return
        this._replicationStreams.splice(idx, 1)
      })

      this.emit('stream-opened', protocolStream)

      function onhandshake () {
        self._replicate(protocolStream)
        self._replicationStreams.push(protocolStream)
        self.emit('handshake', protocolStream)
        ifAvailableContinue()
      }

      function ifAvailableContinue () {
        if (handshaking) {
          handshaking = false
          self.corestore.guard.continue()
        }
      }
    })
  }

  async join (discoveryKey, opts = {}) {
    if (this.swarm && this.swarm.destroyed) return null
    if (!this.swarm) {
      this._listen()
      return this.join(discoveryKey, opts)
    }

    const keyString =
      typeof discoveryKey === 'string'
        ? discoveryKey
        : datEncoding.encode(discoveryKey)
    const keyBuf =
      discoveryKey instanceof Buffer
        ? discoveryKey
        : datEncoding.decode(discoveryKey)

    this._seeding.add(keyString)
    return new Promise((resolve, reject) => {
      this.swarm.join(keyBuf, {
        announce: opts.announce !== false,
        lookup: opts.lookup !== false
      })
      return resolve(null)
    })
  }

  async close () {
    if (!this._swarm) return null
  }
}

module.exports = (...args) => new TestSwarm(...args)
