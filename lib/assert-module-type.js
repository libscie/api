const assert = require('assert')
const _unflatten = require('./_unflatten')
const { TypeError } = require('./errors')

module.exports = (module, mType) => {
  const unflatten = _unflatten(module)
  assert(
    unflatten.p2pcommons.type === mType,
    TypeError,
    mType,
    unflatten.p2pcommons.type,
    'type'
  )
}
