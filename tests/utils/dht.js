const dht = require('@hyperswarm/dht')
const BOOTSTRAP_PORT = 3100

var bootstrap

const createDHT = async () => {
  if (!bootstrap) {
    bootstrap = dht({
      bootstrap: false
    })
    bootstrap.listen(BOOTSTRAP_PORT)
    return new Promise(resolve => {
      bootstrap.once('listening', () => {
        return resolve({
          url: [`localhost:${BOOTSTRAP_PORT}`],
          node: bootstrap
        })
      })
    })
  }
}

module.exports = createDHT
