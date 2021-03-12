/**
 * Validates whether parents are registered.
 * This validation is only relevant at time of updating parents
 * and is not included in any of the other validations
 *
 * @public
 * @throws ValidationError
 * @param {object} params - object containing below parameters
 * @param {object} params.indexMetadata - metadata from index.json (=rawJSON)
 * @param {SDK} params.p2pcommons - active instance of the p2pcommons SDK
 * @param {[Boolean]} params._flat - internal option - indicates whether the metadata is flattened
 */
const assert = require('nanocustomassert')
const { _unflattenIndexMetadata } = require('./validate-utils')
const { ValidationError } = require('./errors')

module.exports = async ({ indexMetadata, p2pcommons, _flat = true }) => {
  if (_flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  await _validateParentsRegistered(indexMetadata, p2pcommons)
}

const _validateParentsRegistered = async (indexMetadata, p2pcommons) => {
  if (indexMetadata.p2pcommons.parents !== undefined) {
    for (const parentKey of indexMetadata.p2pcommons.parents) {
      let isRegistered = false
      const { rawJSON: parent } = await p2pcommons.get(parentKey)
      for (const authorKey of parent.authors) {
        const { rawJSON: author } = await p2pcommons.get(authorKey)
        if (author.contents.includes(parentKey)) {
          isRegistered = true
          break
        }
      }
      assert(
        isRegistered,
        ValidationError,
        'Parents must be registered by at least one author',
        'parents_registered',
        'p2pcommons.parents'
      )
    }
  }
}
