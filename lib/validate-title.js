/**
 * Validates the title for a (complete or incomplete) set of module metadata
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
  _validateTitleRequired(indexMetadata)
  _validateTitleType(indexMetadata)
  _validateTitleLength(indexMetadata)
  _validateTitleWhitespace(indexMetadata)
}

const _validateTitleRequired = indexMetadata => {
  assert(
    indexMetadata.title !== undefined,
    ValidationError,
    'Title is required',
    'title_required',
    'title'
  )
}

const _validateTitleType = indexMetadata => {
  assert(
    typeof indexMetadata.title === 'string',
    ValidationError,
    'Title must be a string',
    'title_type',
    'title'
  )
}

const _validateTitleLength = indexMetadata => {
  const regex = /^.{1,300}$/
  assert(
    indexMetadata.title.match(regex),
    ValidationError,
    'Title must be between 1 and 300 characters long',
    'title_length',
    'title'
  )
}

const _validateTitleWhitespace = indexMetadata => {
  const regex = /[^\s]+/
  assert(
    indexMetadata.title.match(regex),
    ValidationError,
    'Title may not consist of only whitespace',
    'title_whitespace',
    'title'
  )
}
