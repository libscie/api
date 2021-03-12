/**
 * Validates the url for a (complete or incomplete) set of module metadata
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
  _validateUrlRequired(indexMetadata)
  _validateUrlType(indexMetadata)
  _validateUrlProtocol(indexMetadata)
  _validateUrlFormat(indexMetadata)
  _validateUrlKey(indexMetadata, key)
}

const _validateUrlRequired = indexMetadata => {
  assert(
    indexMetadata.url !== undefined,
    ValidationError,
    'URL is required',
    'url_required',
    'url'
  )
}

const _validateUrlType = indexMetadata => {
  assert(
    typeof indexMetadata.url === 'string',
    ValidationError,
    'URL must be a string',
    'url_type',
    'url'
  )
}

const _validateUrlProtocol = indexMetadata => {
  const regex = /^(hyper:\/\/)/
  assert(
    indexMetadata.url.match(regex),
    ValidationError,
    'URL must start with hyper:// protocol',
    'url_protocol',
    'url'
  )
}

const _validateUrlFormat = indexMetadata => {
  const regex = /^(hyper:\/\/)([a-f0-9]{64})$/i
  assert(
    indexMetadata.url.match(regex),
    ValidationError,
    'URL must contain a valid non-versioned Hyperdrive key',
    'url_format',
    'url'
  )
}

const _validateUrlKey = (indexMetadata, key) => {
  const { host: unversionedKey } = parse(key)
  assert(
    indexMetadata.url === `hyper://${unversionedKey}`,
    ValidationError,
    "URL must refer to the module's own Hyperdrive key",
    'url_key',
    'url'
  )
}
