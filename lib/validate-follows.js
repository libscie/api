/**
 * Validates the follows for a (complete or incomplete) set of module metadata
 *
 * @public
 * @throws ValidationError
 * @param {object} params - object containing below parameters
 * @param {object} params.indexMetadata - metadata from index.json (=rawJSON)
 * @param {string} params.key - versioned or unversioned Hyperdrive key
 * @param {[Boolean]} params._flat - internal option - indicates whether the metadata is flattened
 */
const assert = require('nanocustomassert')
const { _unflattenIndexMetadata } = require('./validate-utils')
const { ValidationError } = require('./errors')
const parse = require('./parse-url')

module.exports = ({ indexMetadata, key, _flat = true }) => {
  if (_flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  _validateFollowsRequired(indexMetadata)
  _validateFollowsModuleType(indexMetadata)
  _validateFollowsType(indexMetadata)
  _validateFollowsUnique(indexMetadata)
  _validateFollowsFormat(indexMetadata)
  _validateFollowsNoSelfReference(indexMetadata, key)
}

const _validateFollowsRequired = indexMetadata => {
  assert(
    !(
      indexMetadata.p2pcommons.follows === undefined &&
      indexMetadata.p2pcommons.type === 'profile'
    ),
    ValidationError,
    'Follows is required for profiles',
    'follows_required',
    'p2pcommons.follows'
  )
}

const _validateFollowsModuleType = indexMetadata => {
  assert(
    indexMetadata.p2pcommons.follows === undefined ||
      indexMetadata.p2pcommons.type === 'profile',
    ValidationError,
    'Follows may only exist for profiles',
    'follows_moduletype',
    'p2pcommons.follows'
  )
}

const _validateFollowsType = indexMetadata => {
  assert(
    indexMetadata.p2pcommons.follows === undefined ||
      Array.isArray(indexMetadata.p2pcommons.follows),
    ValidationError,
    'Follows must be an array',
    'follows_type',
    'p2pcommons.follows'
  )
}

const _validateFollowsUnique = indexMetadata => {
  const uniqueValues = [...new Set(indexMetadata.p2pcommons.follows)]
  assert(
    indexMetadata.p2pcommons.follows === undefined ||
      uniqueValues.length === indexMetadata.p2pcommons.follows.length,
    ValidationError,
    'Follows must be unique',
    'follows_unique',
    'p2pcommons.follows'
  )
}

const _validateFollowsFormat = indexMetadata => {
  const regex = /^[a-f0-9]{64}(\+\d+)?$/i
  if (indexMetadata.p2pcommons.follows !== undefined) {
    indexMetadata.p2pcommons.follows.forEach(follow => {
      assert(
        typeof follow === 'string' && follow.match(regex),
        ValidationError,
        'Follows may only contain Hyperdrive keys (versioned or non-versioned)',
        'follows_format',
        'p2pcommons.follows'
      )
    })
  }
}

const _validateFollowsNoSelfReference = (indexMetadata, key) => {
  if (indexMetadata.p2pcommons.follows !== undefined) {
    indexMetadata.p2pcommons.follows.forEach(follow => {
      const { host: unversionedFollowedKey } = parse(follow)
      const { host: unversionedFollowerKey } = parse(key)
      assert(
        unversionedFollowedKey !== unversionedFollowerKey,
        ValidationError,
        "Follows may not refer to the profile's own Hyperdrive key",
        'follows_noselfreference',
        'p2pcommons.follows'
      )
    })
  }
}
