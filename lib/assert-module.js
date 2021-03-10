const _unflatten = require('./_unflatten')
const _getAvroType = require('./_get-avro-type')

module.exports = (sdk, module) => {
  const unflatten = _unflatten(module)
  const localProfileType = _getAvroType(sdk, unflatten.p2pcommons.type)
  if (!localProfileType.isValid(unflatten)) {
    throw new Error('Invalid local profile module')
  }
}
