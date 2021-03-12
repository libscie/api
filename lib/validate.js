const { ValidationError } = require('./errors')
const assert = require('nanocustomassert')
const validateOnFollow = require('./validate-on-follow')
const validateContents = require('./validate-contents')
const validateSubtype = require('./validate-subtype')
const validateTitle = require('./validate-title')
const validateFollows = require('./validate-follows')
const validateParents = require('./validate-parents')
const validateAvatar = require('./validate-avatar')
const validateMain = require('./validate-main')
const { _unflattenIndexMetadata } = require('./validate-utils')
const parse = require('../lib/parse-url')
const baseDir = require('../lib/base-dir')
const validateDescription = require('./validate-description')
const validateLinks = require('./validate-links')
const validateType = require('./validate-type')
const validateAuthors = require('./validate-authors')
const validateP2Pcommons = require('./validate-p2pcommons')
const validateUrl = require('./validate-url')
const validateParentsOnUpdate = require('./validate-parents-on-update')

/**
 * Fully validates a module against the p2pcommons module specs
 *
 * @public
 * @async
 * @throws ValidationError
 * @param {object} params - object containing below parameters
 * @param {object} params.indexMetadata - metadata from index.json (=rawJSON)
 * @param {object} params.dbMetadata - metadata from the database (=metadata)
 * @param {string} params.key - versioned or unversioned Hyperdrive key
 * @param {[string]} params.p2pcommonsDir - path to p2pcommons directory
 * @param {[Boolean]} params._flat - internal option - indicates whether the metadata is flattened
 */
const validate = (exports.validate = async ({
  indexMetadata,
  dbMetadata,
  key,
  p2pcommonsDir = baseDir(),
  _flat = true
}) => {
  if (_flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  validateTitle({ indexMetadata, _flat })
  validateDescription({ indexMetadata, _flat })
  validateUrl({ indexMetadata, key, _flat })
  validateLinks({ indexMetadata, _flat })
  validateP2Pcommons({ indexMetadata, _flat })
  validateType({ indexMetadata, _flat })
  validateSubtype({ indexMetadata, _flat })
  validateAvatar({ indexMetadata, _flat })
  validateAuthors({ indexMetadata, _flat })
  validateParents({ indexMetadata, dbMetadata, key, _flat })
  validateFollows({ indexMetadata, key, _flat })
  validateContents({ indexMetadata, _flat })
  await validateMain({ indexMetadata, key, p2pcommonsDir, _flat })
})

/**
 * Validates all present data (not null or undefined) against the p2pcommons specs.
 * Can be used for validating unfinished modules.
 * If p2pcommons.main is present, but empty, it will not be validated
 *
 * @public
 * @async
 * @throws ValidationError
 * @param {object} params - object containing below parameters
 * @param {object} params.indexMetadata - metadata from index.json (=rawJSON)
 * @param {[string]} params.dbMetadata - metadata from the database (=metadata)
 * @param {[string]} params.key - versioned or unversioned Hyperdrive key
 * @param {[string]} params.p2pcommonsDir - path to p2pcommons directory
 * @param {[Boolean]} params._flat - internal option - indicates whether the metadata is flattened
 */
exports.validatePartial = async ({
  indexMetadata,
  dbMetadata = { version: 0 },
  key = '',
  p2pcommonsDir = baseDir(),
  _flat = true
}) => {
  if (_flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  if (indexMetadata.title !== undefined && indexMetadata.title !== null) {
    validateTitle({ indexMetadata, _flat })
  }
  if (
    indexMetadata.description !== undefined &&
    indexMetadata.description !== null
  ) {
    validateDescription({ indexMetadata, _flat })
  }
  if (
    indexMetadata.url !== undefined &&
    indexMetadata.url !== null &&
    key !== ''
  ) {
    validateUrl({ indexMetadata, key, _flat })
  }
  if (indexMetadata.links !== undefined && indexMetadata.links !== null) {
    validateLinks({ indexMetadata, _flat })
  }
  if (
    indexMetadata.p2pcommons !== undefined &&
    indexMetadata.p2pcommons !== null
  ) {
    validateP2Pcommons({ indexMetadata, _flat })
  }
  validateType({ indexMetadata, _flat })
  if (
    indexMetadata.p2pcommons.subtype !== undefined &&
    indexMetadata.p2pcommons.subtype !== null
  ) {
    validateSubtype({ indexMetadata, _flat })
  }
  if (
    indexMetadata.p2pcommons.avatar !== undefined &&
    indexMetadata.p2pcommons.avatar !== null
  ) {
    validateAvatar({ indexMetadata, _flat })
  }
  if (
    indexMetadata.p2pcommons.authors !== undefined &&
    indexMetadata.p2pcommons.authors !== null
  ) {
    validateAuthors({ indexMetadata, _flat })
  }
  if (
    indexMetadata.p2pcommons.parents !== undefined &&
    indexMetadata.p2pcommons.parents !== null
  ) {
    validateParents({ indexMetadata, dbMetadata, key, _flat })
  }
  if (
    indexMetadata.p2pcommons.follows !== undefined &&
    indexMetadata.p2pcommons.follows !== null
  ) {
    validateFollows({ indexMetadata, key, _flat })
  }
  if (
    indexMetadata.p2pcommons.contents !== undefined &&
    indexMetadata.p2pcommons.contents !== null
  ) {
    validateContents({ indexMetadata, _flat })
  }
  if (
    indexMetadata.p2pcommons.main !== undefined &&
    indexMetadata.p2pcommons.main !== null &&
    indexMetadata.p2pcommons.main !== '' &&
    !indexMetadata.p2pcommons.main.match(/^\.[\\/]$/)
  ) {
    await validateMain({ indexMetadata, key, p2pcommonsDir, _flat })
  }
}

/**
 * Fully validates a content module and a profile module upon registration.
 * Includes cross-validation of module types and presence of the author in the content's metadata
 *
 * @public
 * @async
 * @throws ValidationError
 * @param {object} params - object containing below parameters
 * @param {object} params.contentIndexMetadata - content's metadata from index.json (=rawJSON)
 * @param {object} params.contentDbMetadata - content's metadata from the database (=metadata)
 * @param {string} params.contentKey - content's versioned or unversioned Hyperdrive key
 * @param {object} params.profileIndexMetadata - profile's metadata from index.json (=rawJSON)
 * @param {object} params.profileDbMetadata - profile's metadata from the database (=metadata)
 * @param {string} params.profileKey - profile's versioned or unversioned Hyperdrive key
 * @param {[string]} params.p2pcommonsDir - path to p2pcommons directory
 * @param {[Boolean]} params._flat - internal option - indicates whether the metadata is flattened
 */
exports.validateOnRegister = async ({
  contentIndexMetadata,
  contentDbMetadata,
  contentKey,
  profileIndexMetadata,
  profileDbMetadata,
  profileKey,
  p2pcommonsDir = baseDir(),
  _flat = true
}) => {
  if (_flat) {
    contentIndexMetadata = _unflattenIndexMetadata(contentIndexMetadata)
    profileIndexMetadata = _unflattenIndexMetadata(profileIndexMetadata)
  }
  _validateOnRegisterModuleType(contentIndexMetadata)
  _validateOnRegisterAuthorsContainsProfileKey(contentIndexMetadata, profileKey)
  await validate({
    indexMetadata: contentIndexMetadata,
    dbMetadata: contentDbMetadata,
    key: contentKey,
    p2pcommonsDir,
    _flat
  })
  await validate({
    indexMetadata: profileIndexMetadata,
    dbMetadata: profileDbMetadata,
    key: profileKey,
    p2pcommonsDir,
    _flat
  })
}

const _validateOnRegisterModuleType = contentIndexMetadata => {
  assert(
    contentIndexMetadata.p2pcommons.type === 'content',
    ValidationError,
    'Only content may be registered to a profile',
    'onregister_moduletype',
    'p2pcommons.contents'
  )
}

const _validateOnRegisterAuthorsContainsProfileKey = (
  contentIndexMetadata,
  profileKey
) => {
  const { host: unversionedProfileKey } = parse(profileKey)
  assert(
    contentIndexMetadata.p2pcommons.authors.includes(unversionedProfileKey),
    ValidationError,
    'Authors must contain profile key upon registration',
    'onregister_authorscontainsprofilekey',
    'p2pcommons.authors'
  )
}

exports.validateTitle = validateTitle
exports.validateSubtype = validateSubtype
exports.validateContents = validateContents
exports.validateOnFollow = validateOnFollow
exports.validateFollows = validateFollows
exports.validateParents = validateParents
exports.validateAvatar = validateAvatar
exports.validateMain = validateMain
exports.validateDescription = validateDescription
exports.validateLinks = validateLinks
exports.validateType = validateType
exports.validateAuthors = validateAuthors
exports.validateP2Pcommons = validateP2Pcommons
exports.validateUrl = validateUrl
exports.validateParentsOnUpdate = validateParentsOnUpdate
