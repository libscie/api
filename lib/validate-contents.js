/**
 * Validates the contents for a (complete or incomplete) set of module metadata
 *
 * @public
 * @throws ValidationError
 * @param {object} params - object containing below parameters
 * @param {object} params.indexMetadata - metadata from index.json (=rawJSON)
 * @param {[Boolean]} params._flat - internal option - indicates whether the metadata is flattened
 */
const assert = require('nanocustomassert')

const { _unflattenIndexMetadata } = require('./validate-utils')
const { ValidationError } = require('./errors')

module.exports = ({ indexMetadata, _flat = true }) => {
  if (_flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  _validateContentsRequired(indexMetadata)
  _validateContentsModuleType(indexMetadata)
  _validateContentsType(indexMetadata)
  _validateContentsUnique(indexMetadata)
  _validateContentsFormat(indexMetadata)
}

const _validateContentsRequired = indexMetadata => {
  assert(
    !(
      indexMetadata.p2pcommons.contents === undefined &&
      indexMetadata.p2pcommons.type === 'profile'
    ),
    ValidationError,
    'Contents is required for profiles',
    'contents_required',
    'p2pcommons.contents'
  )
}

const _validateContentsModuleType = indexMetadata => {
  assert(
    indexMetadata.p2pcommons.contents === undefined ||
      indexMetadata.p2pcommons.type === 'profile',
    ValidationError,
    'Contents may only exist for profiles',
    'contents_moduletype',
    'p2pcommons.contents'
  )
}

const _validateContentsType = indexMetadata => {
  assert(
    indexMetadata.p2pcommons.contents === undefined ||
      Array.isArray(indexMetadata.p2pcommons.contents),
    ValidationError,
    'Contents must be an array',
    'contents_type',
    'p2pcommons.contents'
  )
}

const _validateContentsUnique = indexMetadata => {
  const uniqueValues = [...new Set(indexMetadata.p2pcommons.contents)]
  assert(
    indexMetadata.p2pcommons.contents === undefined ||
      uniqueValues.length === indexMetadata.p2pcommons.contents.length,
    ValidationError,
    'Contents must be unique',
    'contents_unique',
    'p2pcommons.contents'
  )
}

const _validateContentsFormat = indexMetadata => {
  const regex = /^[a-f0-9]{64}(\+\d+)?$/i
  if (indexMetadata.p2pcommons.contents !== undefined) {
    indexMetadata.p2pcommons.contents.forEach(content => {
      assert(
        typeof content === 'string' && content.match(regex),
        ValidationError,
        'Contents may only contain Hyperdrive keys (versioned or non-versioned)',
        'contents_format',
        'p2pcommons.contents'
      )
    })
  }
}
