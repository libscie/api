/**
 * Validates the module type for a (complete or incomplete) set of module metadata
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
  _validateTypeRequired(indexMetadata)
  _validateTypeType(indexMetadata)
  _validateTypeValue(indexMetadata)
}

const _validateTypeRequired = indexMetadata => {
  assert(
    indexMetadata.p2pcommons.type !== undefined,
    ValidationError,
    'Type is required',
    'type_required',
    'p2pcommons.type'
  )
}

const _validateTypeType = indexMetadata => {
  assert(
    typeof indexMetadata.p2pcommons.type === 'string',
    ValidationError,
    'Type must be a string',
    'type_type',
    'p2pcommons.type'
  )
}

const _validateTypeValue = indexMetadata => {
  assert(
    indexMetadata.p2pcommons.type === 'profile' ||
      indexMetadata.p2pcommons.type === 'content',
    ValidationError,
    "Type must be equal to 'profile' or 'content'",
    'type_value',
    'p2pcommons.type'
  )
}
