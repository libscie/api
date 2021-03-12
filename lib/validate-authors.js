/**
 * Validates the authors for a (complete or incomplete) set of module metadata
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
  _validateAuthorsRequired(indexMetadata)
  _validateAuthorsModuleType(indexMetadata)
  _validateAuthorsType(indexMetadata)
  _validateAuthorsUnique(indexMetadata)
  _validateAuthorsFormat(indexMetadata)
}

const _validateAuthorsRequired = indexMetadata => {
  assert(
    !(
      indexMetadata.p2pcommons.authors === undefined &&
      indexMetadata.p2pcommons.type === 'content'
    ),
    ValidationError,
    'Authors is required for content',
    'authors_required',
    'p2pcommons.authors'
  )
}

const _validateAuthorsModuleType = indexMetadata => {
  assert(
    indexMetadata.p2pcommons.authors === undefined ||
      indexMetadata.p2pcommons.type === 'content',
    ValidationError,
    'Authors may only exist for content',
    'authors_moduletype',
    'p2pcommons.authors'
  )
}

const _validateAuthorsType = indexMetadata => {
  assert(
    indexMetadata.p2pcommons.authors === undefined ||
      Array.isArray(indexMetadata.p2pcommons.authors),
    ValidationError,
    'Authors must be an array',
    'authors_type',
    'p2pcommons.authors'
  )
}

const _validateAuthorsUnique = indexMetadata => {
  const uniqueValues = [...new Set(indexMetadata.p2pcommons.authors)]
  assert(
    indexMetadata.p2pcommons.authors === undefined ||
      uniqueValues.length === indexMetadata.p2pcommons.authors.length,
    ValidationError,
    'Authors must be unique',
    'authors_unique',
    'p2pcommons.authors'
  )
}

const _validateAuthorsFormat = indexMetadata => {
  const regex = /^[a-f0-9]{64}$/i
  if (indexMetadata.p2pcommons.authors !== undefined) {
    indexMetadata.p2pcommons.authors.forEach(author => {
      assert(
        typeof author === 'string' && author.match(regex),
        ValidationError,
        'Authors may only contain non-versioned Hyperdrive keys',
        'authors_format',
        'p2pcommons.authors'
      )
    })
  }
}
