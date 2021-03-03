const tempy = require('tempy')
const SDK = require('../..')

const defaultOpts = () => ({
  swarm: false,
  persist: false
})

module.exports = opts => {
  const finalOpts = { ...defaultOpts(), ...opts }
  return new SDK({
    disableSwarm: !finalOpts.swarm,
    persist: finalOpts.persist,
    swarm: finalOpts.swarmFn,
    baseDir: tempy.directory(),
    bootstrap: finalOpts.dhtBootstrap
  })
}
