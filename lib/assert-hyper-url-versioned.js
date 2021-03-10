const assert = require('assert')
const parse = require('./parse-url')

module.exports = hyperUrl => {
  assert(typeof hyperUrl === 'string', TypeError, 'string', 'hyperUrl')
  const { version } = parse(hyperUrl)
  if (version !== 0 && !version) {
    throw new TypeError('versioned hyper url', hyperUrl, 'hyperUrl')
  }
  return true
}
