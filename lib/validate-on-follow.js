/**
 * Validates whether the followed module is a profile.
 * This validation is only relevant at time of updating follows
 * and is not included in any of the other validations
 *
 * @public
 * @throws ValidationError
 * @param {object} params - object containing below parameters
 * @param {object} params.followedIndexMetadata - followed profile's metadata from index.json (=rawJSON)
 * @param {[Boolean]} params._flat - internal option - indicates whether the metadata is flattened
 */
// const assert = require('assert')
const assert = require('nanocustomassert')
const { _unflattenIndexMetadata } = require('./validate-utils')
const { ValidationError } = require('./errors')

module.exports = ({ followedIndexMetadata, _flat = true }) => {
  if (_flat) {
    followedIndexMetadata = _unflattenIndexMetadata(followedIndexMetadata)
  }
  _validateOnFollowModuleType(followedIndexMetadata)
}

const _validateOnFollowModuleType = followedIndexMetadata => {
  assert(
    followedIndexMetadata.p2pcommons.type === 'profile',
    ValidationError,
    'Only profiles may be followed',
    'onfollow_moduletype',
    'p2pcommons.follows'
  )
}
