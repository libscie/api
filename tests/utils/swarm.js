const Swarm = require('../../lib/swarm').SwarmNetworker
const HypercoreProtocol = require('hypercore-protocol')
const pump = require('pump')
const datEncoding = require('dat-encoding')

class TestSwarm extends Swarm {
  listen () {
    this._swarm = this.swarmFn({
      ...this.opts,
      queue: { multiplex: true }
    })
    this._swarm.on('error', err => {
      this.emit('error', err)
    })
    this._swarm.on('connection', (socket, info) => {
      const isInitiator = !!info.client
      if (
        socket.remoteAddress === '::ffff:127.0.0.1' ||
        socket.remoteAddress === '127.0.0.1'
      ) {
        return null
      }

      const protocolStream = new HypercoreProtocol(isInitiator, {
        onchannelclose: discoveryKey => {
          const dkeyString = datEncoding.encode(discoveryKey)
          const streams = this._streamsByDiscoveryKey.get(dkeyString)
          if (!streams || !streams.length) return
          streams.splice(streams.indexOf(protocolStream), 1)
          if (!streams.length) this._streamsByDiscoveryKey.delete(dkeyString)
        },
        ondiscoverykey: discoveryKey => {
          this._handleTopic(protocolStream, discoveryKey)
        }
      })
      this._replicationStreams.push(protocolStream)

      return pump(socket, protocolStream, socket, err => {
        if (err) {
          this.emit('replication-error', err)
        }

        const idx = this._replicationStreams.indexOf(protocolStream)
        if (idx === -1) return
        this._replicationStreams.splice(idx, 1)
      })
    })
  }
}

module.exports = (...args) => new TestSwarm(...args)
