/**
 * Validates the parents for a (complete or incomplete) set of module metadata
 *
 * @public
 * @throws ValidationError
 * @param {object} params - object containing below parameters
 * @param {object} params.indexMetadata - metadata from index.json (=rawJSON)
 * @param {object} params.dbMetadata - metadata from the database (=metadata)
 * @param {string} params.key - versioned or unversioned Hyperdrive key
 * @param {[Boolean]} params._flat - internal option - indicates whether the metadata is flattened
 */
const assert = require('nanocustomassert')
const { _unflattenIndexMetadata } = require('./validate-utils')
const { ValidationError } = require('./errors')
const parse = require('./parse-url')

module.exports = ({ indexMetadata, dbMetadata, key, _flat = true }) => {
  if (_flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  _validateParentsRequired(indexMetadata)
  _validateParentsModuleType(indexMetadata)
  _validateParentsType(indexMetadata)
  _validateParentsUnique(indexMetadata)
  _validateParentsFormat(indexMetadata)
  _validateParentsNoSelfReference(indexMetadata, dbMetadata, key)
}

const _validateParentsRequired = indexMetadata => {
  assert(
    !(
      indexMetadata.p2pcommons.parents === undefined &&
      indexMetadata.p2pcommons.type === 'content'
    ),
    ValidationError,
    'Parents is required for content',
    'parents_required',
    'p2pcommons.parents'
  )
}

const _validateParentsModuleType = indexMetadata => {
  assert(
    indexMetadata.p2pcommons.parents === undefined ||
      indexMetadata.p2pcommons.type === 'content',
    ValidationError,
    'Parents may only exist for content',
    'parents_moduletype',
    'p2pcommons.parents'
  )
}

const _validateParentsType = indexMetadata => {
  assert(
    indexMetadata.p2pcommons.parents === undefined ||
      Array.isArray(indexMetadata.p2pcommons.parents),
    ValidationError,
    'Parents must be an array',
    'parents_type',
    'p2pcommons.parents'
  )
}

const _validateParentsUnique = indexMetadata => {
  const uniqueValues = [...new Set(indexMetadata.p2pcommons.parents)]
  assert(
    indexMetadata.p2pcommons.parents === undefined ||
      uniqueValues.length === indexMetadata.p2pcommons.parents.length,
    ValidationError,
    'Parents must be unique',
    'parents_unique',
    'p2pcommons.parents'
  )
}

const _validateParentsFormat = indexMetadata => {
  const regex = /^[a-f0-9]{64}(\+\d+)$/i
  if (indexMetadata.p2pcommons.parents !== undefined) {
    indexMetadata.p2pcommons.parents.forEach(parent => {
      assert(
        typeof parent === 'string' && parent.match(regex),
        ValidationError,
        'Parents may only contain versioned Hyperdrive keys',
        'parents_format',
        'p2pcommons.parents'
      )
    })
  }
}

const _validateParentsNoSelfReference = (indexMetadata, dbMetadata, key) => {
  if (indexMetadata.p2pcommons.parents !== undefined) {
    indexMetadata.p2pcommons.parents.forEach(parent => {
      const { host: unversionedParentKey, version: parentVersion } = parse(
        parent
      )
      const { host: unversionedChildKey } = parse(key)
      assert(
        unversionedParentKey !== unversionedChildKey ||
          parentVersion <= dbMetadata.version,
        ValidationError,
        'Parents may not refer to current or future versions of itself',
        'parents_noselfreference',
        'p2pcommons.parents'
      )
    })
  }
}
