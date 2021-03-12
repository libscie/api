/**
 * Validates the avatar for a (complete or incomplete) set of module metadata
 *
 * @public
 * @throws ValidationError
 * @param {object} params - object containing below parameters
 * @param {object} params.indexMetadata - metadata from index.json (=rawJSON)
 * @param {[Boolean]} params._flat - internal option - indicates whether the metadata is flattened
 */
const assert = require('nanocustomassert')
const {
  _isRelativeFilePath,
  _unflattenIndexMetadata
} = require('./validate-utils')
const { ValidationError } = require('./errors')

module.exports = ({ indexMetadata, _flat = true }) => {
  if (_flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  _validateAvatarModuleType(indexMetadata)
  _validateAvatarType(indexMetadata)
  _validateAvatarRelativePath(indexMetadata)
}

const _validateAvatarModuleType = indexMetadata => {
  assert(
    indexMetadata.p2pcommons.avatar === undefined ||
      indexMetadata.p2pcommons.type === 'profile',
    ValidationError,
    'Avatar may only exist for profiles',
    'avatar_moduletype',
    'p2pcommons.avatar'
  )
}

const _validateAvatarType = indexMetadata => {
  assert(
    indexMetadata.p2pcommons.avatar === undefined ||
      typeof indexMetadata.p2pcommons.avatar === 'string',
    ValidationError,
    'Avatar must be a string',
    'avatar_type',
    'p2pcommons.avatar'
  )
}

const _validateAvatarRelativePath = indexMetadata => {
  assert(
    indexMetadata.p2pcommons.avatar === undefined ||
      _isRelativeFilePath(indexMetadata.p2pcommons.avatar),
    ValidationError,
    'Avatar may only contain a relative path within the module',
    'avatar_relativepath',
    'p2pcommons.avatar'
  )
}
