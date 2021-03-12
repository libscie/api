/**
 * Validates the description for a (complete or incomplete) set of module metadata
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
  _validateDescriptionRequired(indexMetadata)
  _validateDescriptionType(indexMetadata)
}

const _validateDescriptionRequired = indexMetadata => {
  assert(
    indexMetadata.description !== undefined,
    ValidationError,
    'Description is required',
    'description_required',
    'description'
  )
}

const _validateDescriptionType = indexMetadata => {
  assert(
    typeof indexMetadata.description === 'string',
    ValidationError,
    'Description must be a string',
    'description_type',
    'description'
  )
}
