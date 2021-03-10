const assert = require('assert')

module.exports = hyperUrl => {
  assert(
    typeof hyperUrl === 'string' || Buffer.isBuffer(hyperUrl),
    TypeError,
    "'string' or Buffer",
    hyperUrl,
    'hyperUrl'
  )
}
