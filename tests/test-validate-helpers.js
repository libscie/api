const tempy = require('tempy')

const SDK = require('./..')

exports.doesNotThrowAsync = async (t, fn) => {
  try {
    await fn()
    t.pass('should not throw')
  } catch (err) {
    console.log(err)
    t.fail('should not throw')
  }
}

exports.throwsAsync = async (t, fn, code) => {
  try {
    await fn()
    t.fail('should throw')
  } catch (err) {
    if (err.code.match(code)) {
      t.pass('should throw')
    } else {
      t.fail(`should throw ${code}`)
    }
  }
}

const defaultOpts = () => ({
  swarm: false,
  persist: false,
  watch: false
})

exports.createDb = opts => {
  const finalOpts = { ...defaultOpts(), ...opts }
  return new SDK({
    disableSwarm: !finalOpts.swarm,
    persist: finalOpts.persist,
    swarm: finalOpts.swarmFn,
    baseDir: tempy.directory()
  })
}
