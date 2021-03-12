/**
 * Validates the p2pcommons object structure (not its contents) for a (complete or incomplete) set of module metadata
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
  _validateP2PcommonsRequired(indexMetadata)
  _validateP2PcommonsType(indexMetadata)
}

const _validateP2PcommonsRequired = indexMetadata => {
  assert(
    indexMetadata.p2pcommons !== undefined,
    ValidationError,
    'p2pcommons is required',
    'p2pcommons_required',
    'p2pcommons'
  )
}

const _validateP2PcommonsType = indexMetadata => {
  assert(
    typeof indexMetadata.p2pcommons === 'object' &&
      !Array.isArray(indexMetadata.p2pcommons),
    ValidationError,
    'p2pcommons must be an object',
    'p2pcommons_type',
    'p2pcommons'
  )
}
