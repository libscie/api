const assert = require('assert')
const _dbItemError = require('./_db-item-error')

module.exports = (sdk, meta) => {
  assert(typeof meta === 'object', 'metadata object expected')
  const dbitem = {
    ...meta,
    rawJSON: Buffer.alloc(0) // we test validity of this property separately
  }

  sdk.dbItemType.isValid(dbitem, {
    errorHook: _dbItemError
  })
}
