const CorestoreSwarmNetworking = require('corestore-swarm-networking')
const datEncoding = require('dat-encoding')

class Swarm extends CorestoreSwarmNetworking {
  constructor (stores, ...args) {
    super(null, ...args)
    this.stores = new Map()
    return this
  }

  addStore (dkeyString, store) {
    this.stores.set(dkeyString, store)
  }

  _handleTopic (protocolStream, discoveryKey) {
    // This is the active replication case -- we're requesting that a particular discovery key be replicated.
    const dkeyString = datEncoding.encode(discoveryKey)
    if (!this._seeding.has(dkeyString)) return
    // The initiator parameter here is ignored, since we're passing in a stream.
    const corestore = this.stores.get(dkeyString)
    debugger
    if (!corestore) {
      console.log('swarm: corestore not found')
      return
    }
    corestore.replicate(false, discoveryKey, {
      ...this._replicationOpts,
      stream: protocolStream
    })
    var discoveryKeyStreams = this._streamsByDiscoveryKey.get(dkeyString)
    if (!discoveryKeyStreams) {
      discoveryKeyStreams = []
      this._streamsByDiscoveryKey.set(dkeyString, discoveryKeyStreams)
    }
    discoveryKeyStreams.push(protocolStream)
  }
}

module.exports = (stores, ...args) => new Swarm(stores, ...args)
