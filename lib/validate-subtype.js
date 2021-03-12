/**
 * Validates the subtype for a (complete or incomplete) set of module metadata
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
  _validateSubtypeRequired(indexMetadata)
  _validateSubtypeType(indexMetadata)
  _validateSubtypeFormat(indexMetadata)
}

const _validateSubtypeRequired = indexMetadata => {
  assert(
    indexMetadata.p2pcommons.subtype !== undefined,
    ValidationError,
    'Subtype is required',
    'subtype_required',
    'p2pcommons.subtype'
  )
}

const _validateSubtypeType = indexMetadata => {
  assert(
    typeof indexMetadata.p2pcommons.subtype === 'string',
    ValidationError,
    'Subtype must be a string',
    'subtype_type',
    'p2pcommons.subtype'
  )
}

const _validateSubtypeFormat = indexMetadata => {
  const regex = /^[A-Za-z0-9]*$/
  assert(
    indexMetadata.p2pcommons.subtype.match(regex),
    ValidationError,
    'Subtype may only include standard alphanumeric characters',
    'subtype_format',
    'p2pcommons.subtype'
  )
}
