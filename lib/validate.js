const { ValidationError } = require('./errors')
const assert = require('nanocustomassert')
const { join, isAbsolute } = require('path')
const { promises: { access } } = require('fs')
const parse = require('../lib/parse-url')
const baseDir = require('../lib/base-dir')

const p2pcommonsKeys = ['type', 'subtype', 'main', 'avatar', 'authors', 'parents', 'follows', 'contents']

/**
 * Fully validates a module against the p2pcommons module specs
 *
 * @public
 * @async
 * @throws ValidationError
 * @param {object} indexMetadata - metadata from index.json (=rawJSON)
 * @param {object} dbMetadata - metadata from the database (=metadata)
 * @param {string} key - versioned or unversioned Hyperdrive key
 * @param {[string]} p2pcommonsDir - path to p2pcommons directory
 * @param {[Boolean]} flat - indicates whether the metadata is flattened - set false to validate non-flattened metadata (i.e. directly read from index.json)
 */
const validate = (exports.validate = async (indexMetadata, dbMetadata, key, p2pcommonsDir = baseDir(), flat = true) => {
  if (flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  validateTitle(indexMetadata, flat)
  validateDescription(indexMetadata, flat)
  validateUrl(indexMetadata, key, flat)
  validateLinks(indexMetadata, flat)
  validateP2pcommons(indexMetadata, flat)
  validateType(indexMetadata, flat)
  validateSubtype(indexMetadata, flat)
  validateAvatar(indexMetadata, flat)
  validateAuthors(indexMetadata, flat)
  validateParents(indexMetadata, dbMetadata, key, flat)
  validateFollows(indexMetadata, key, flat)
  validateContents(indexMetadata, flat)
  await validateMain(indexMetadata, key, p2pcommonsDir, flat)
})

/**
 * Validates all present data against the p2pcommons specs.
 * Can be used for validating unfinished modules.
 * If p2pcommons.main is present, but empty, it will not be validated
 *
 * @public
 * @async
 * @throws ValidationError
 * @param {object} indexMetadata - metadata from index.json (=rawJSON)
 * @param {[string]} dbMetadata - metadata from the database (=metadata)
 * @param {[string]} key - versioned or unversioned Hyperdrive key
 * @param {[string]} p2pcommonsDir - path to p2pcommons directory
 * @param {[Boolean]} flat - indicates whether the metadata is flattened - set false to validate non-flattened metadata (i.e. directly read from index.json)
 */
exports.validatePartial = async (indexMetadata, dbMetadata = { version: 0 }, key = '', p2pcommonsDir = baseDir(), flat = true) => {
  if (flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  if (indexMetadata.title !== undefined) {
    validateTitle(indexMetadata, flat)
  }
  if (indexMetadata.description !== undefined) {
    validateDescription(indexMetadata, flat)
  }
  if (indexMetadata.url !== undefined && key !== '') {
    validateUrl(indexMetadata, key, flat)
  }
  if (indexMetadata.links !== undefined) {
    validateLinks(indexMetadata, flat)
  }
  if (indexMetadata.p2pcommons !== undefined) {
    validateP2pcommons(indexMetadata, flat)
  }
  validateType(indexMetadata, flat)
  if (indexMetadata.p2pcommons.subtype !== undefined) {
    validateSubtype(indexMetadata, flat)
  }
  if (indexMetadata.p2pcommons.avatar !== undefined) {
    validateAvatar(indexMetadata, flat)
  }
  if (indexMetadata.p2pcommons.authors !== undefined) {
    validateAuthors(indexMetadata, flat)
  }
  if (indexMetadata.p2pcommons.parents !== undefined) {
    validateParents(indexMetadata, dbMetadata, key, flat)
  }
  if (indexMetadata.p2pcommons.follows !== undefined) {
    validateFollows(indexMetadata, key, flat)
  }
  if (indexMetadata.p2pcommons.contents !== undefined) {
    validateContents(indexMetadata, flat)
  }
  if (indexMetadata.p2pcommons.main !== undefined &&
        indexMetadata.p2pcommons.main !== '' &&
        !indexMetadata.p2pcommons.main.match(/^\.[\\/]$/)) {
    await validateMain(indexMetadata, key, p2pcommonsDir, flat)
  }
}

/**
 * Validates the title for a (complete or incomplete) set of module metadata
 *
 * @public
 * @throws ValidationError
 * @param {object} indexMetadata - metadata from index.json (=rawJSON)
 * @param {[Boolean]} flat - indicates whether the metadata is flattened - set false to validate non-flattened metadata (i.e. directly read from index.json)
 */
const validateTitle = (exports.validateTitle = (indexMetadata, flat = true) => {
  if (flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  _validateTitleRequired(indexMetadata)
  _validateTitleType(indexMetadata)
  _validateTitleLength(indexMetadata)
  _validateTitleWhitespace(indexMetadata)
})

const _validateTitleRequired = (indexMetadata) => {
  assert(
    indexMetadata.title !== undefined,
    ValidationError,
    'Title is required',
    'title_required',
    'title'
  )
}

const _validateTitleType = (indexMetadata) => {
  assert(
    typeof indexMetadata.title === 'string',
    ValidationError,
    'Title must be a string',
    'title_type',
    'title'
  )
}

const _validateTitleLength = (indexMetadata) => {
  const regex = /^.{1,300}$/
  assert(
    indexMetadata.title.match(regex),
    ValidationError,
    'Title must be between 1 and 300 characters long',
    'title_length',
    'title'
  )
}

const _validateTitleWhitespace = (indexMetadata) => {
  const regex = /[^\s]+/
  assert(
    indexMetadata.title.match(regex),
    ValidationError,
    'Title may not consist of only whitespace',
    'title_whitespace',
    'title'
  )
}

/**
 * Validates the description for a (complete or incomplete) set of module metadata
 *
 * @public
 * @throws ValidationError
 * @param {object} indexMetadata - metadata from index.json (=rawJSON)
 * @param {[Boolean]} flat - indicates whether the metadata is flattened - set false to validate non-flattened metadata (i.e. directly read from index.json)
 */
const validateDescription = (exports.validateDescription = (indexMetadata, flat = true) => {
  if (flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  _validateDescriptionRequired(indexMetadata)
  _validateDescriptionType(indexMetadata)
})

const _validateDescriptionRequired = (indexMetadata) => {
  assert(
    indexMetadata.description !== undefined,
    ValidationError,
    'Description is required',
    'description_required',
    'description'
  )
}

const _validateDescriptionType = (indexMetadata) => {
  assert(
    typeof indexMetadata.description === 'string',
    ValidationError,
    'Description must be a string',
    'description_type',
    'description'
  )
}

/**
 * Validates the url for a (complete or incomplete) set of module metadata
 *
 * @public
 * @throws ValidationError
 * @param {object} indexMetadata - metadata from index.json (=rawJSON)
 * @param {string} key - versioned or unversioned Hyperdrive key
 * @param {[Boolean]} flat - indicates whether the metadata is flattened - set false to validate non-flattened metadata (i.e. directly read from index.json)
 */
const validateUrl = (exports.validateUrl = (indexMetadata, key, flat = true) => {
  if (flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  _validateUrlRequired(indexMetadata)
  _validateUrlType(indexMetadata)
  _validateUrlProtocol(indexMetadata)
  _validateUrlFormat(indexMetadata)
  _validateUrlKey(indexMetadata, key)
})

const _validateUrlRequired = (indexMetadata) => {
  assert(
    indexMetadata.url !== undefined,
    ValidationError,
    'URL is required',
    'url_required',
    'url'
  )
}

const _validateUrlType = (indexMetadata) => {
  assert(
    typeof indexMetadata.url === 'string',
    ValidationError,
    'URL must be a string',
    'url_type',
    'url'
  )
}

const _validateUrlProtocol = (indexMetadata) => {
  const regex = /^(hyper:\/\/)/
  assert(
    indexMetadata.url.match(regex),
    ValidationError,
    'URL must start with hyper:// protocol',
    'url_protocol',
    'url'
  )
}

const _validateUrlFormat = (indexMetadata) => {
  const regex = /^(hyper:\/\/)([a-f0-9]{64})$/
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

/**
 * Validates the links for a (complete or incomplete) set of module metadata
 *
 * @public
 * @throws ValidationError
 * @param {object} indexMetadata - metadata from index.json (=rawJSON)
 * @param {[Boolean]} flat - indicates whether the metadata is flattened - set false to validate non-flattened metadata (i.e. directly read from index.json)
 */
const validateLinks = (exports.validateLinks = (indexMetadata, flat = true) => {
  if (flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  _validateLinksRequired(indexMetadata)
  _validateLinksType(indexMetadata)
  _validateLinksArrayValues(indexMetadata)
  _validateLinksLicense(indexMetadata)
  _validateLinksSpec(indexMetadata)
})

const _validateLinksRequired = (indexMetadata) => {
  assert(
    indexMetadata.links !== undefined,
    ValidationError,
    'Links object is required',
    'links_required',
    'links'
  )
}

const _validateLinksType = (indexMetadata) => {
  assert(
    typeof indexMetadata.links === 'object' &&
        !Array.isArray(indexMetadata.links),
    ValidationError,
    'Links must be an object',
    'links_type',
    'links'
  )
}

const _validateLinksArrayValues = (indexMetadata) => {
  Object.values(indexMetadata.links).forEach(value => {
    assert(
      Array.isArray(value),
      ValidationError,
      'Links must be an object with array values',
      'links_arrayvalues',
      'links'
    )
  })
}

const _validateLinksLicense = (indexMetadata) => {
  _validateLinksLicenseRequired(indexMetadata)
  _validateLinksLicenseFormat(indexMetadata)
  _validateLinksLicenseHrefKey(indexMetadata)
  _validateLinksLicenseValue(indexMetadata)
}

const _validateLinksLicenseRequired = (indexMetadata) => {
  assert(
    indexMetadata.links.license !== undefined,
    ValidationError,
    'License is required',
    'links_license_required',
    'links.license'
  )
}

const _validateLinksLicenseFormat = (indexMetadata) => {
  assert(
    indexMetadata.links.license.length === 1 &&
        typeof indexMetadata.links.license[0] === 'object' &&
        !Array.isArray(indexMetadata.links.license[0]),
    ValidationError,
    'License must contain one object',
    'links_license_format',
    'links.license'
  )
}

const _validateLinksLicenseHrefKey = (indexMetadata) => {
  assert(
    indexMetadata.links.license[0].href !== undefined,
    ValidationError,
    'License object must have an href key',
    'links_license_href',
    'links.license'
  )
}

const _validateLinksLicenseValue = (indexMetadata) => {
  assert(
    indexMetadata.links.license[0].href === 'https://creativecommons.org/publicdomain/zero/1.0/legalcode',
    ValidationError,
    "License link must be equal to 'https://creativecommons.org/publicdomain/zero/1.0/legalcode",
    'links_license_value',
    'links.license'
  )
}

const _validateLinksSpec = (indexMetadata) => {
  _validateLinksSpecRequired(indexMetadata)
  _validateLinksSpecFormat(indexMetadata)
  _validateLinksSpecHrefKey(indexMetadata)
  _validateLinksSpecValidUrl(indexMetadata)
}

const _validateLinksSpecRequired = (indexMetadata) => {
  assert(
    indexMetadata.links.spec !== undefined,
    ValidationError,
    'Spec is required',
    'links_spec_required',
    'links.spec'
  )
}

const _validateLinksSpecFormat = (indexMetadata) => {
  assert(
    indexMetadata.links.spec.length === 1 &&
        typeof indexMetadata.links.spec[0] === 'object' &&
        !Array.isArray(indexMetadata.links.spec[0]),
    ValidationError,
    'Spec must contain one object',
    'links_spec_format',
    'links.spec'
  )
}

const _validateLinksSpecHrefKey = (indexMetadata) => {
  assert(
    indexMetadata.links.spec[0].href !== undefined,
    ValidationError,
    'Spec object must have an href key',
    'links_spec_href',
    'links.spec'
  )
}

const _validateLinksSpecValidUrl = (indexMetadata) => {
  const regex = /^https:\/\/p2pcommons.com\/specs\/module\/[0-9]+\.[0-9]+\.[0-9]+$/
  assert(
    indexMetadata.links.spec[0].href.match(regex),
    ValidationError,
    'Spec url must refer to a valid p2pcommons module spec',
    'links_spec_validurl',
    'links.spec'
  )
}

/**
 * Validates the p2pcommons object structure (not its contents) for a (complete or incomplete) set of module metadata
 *
 * @public
 * @throws ValidationError
 * @param {object} indexMetadata - metadata from index.json (=rawJSON)
 * @param {[Boolean]} flat - indicates whether the metadata is flattened - set false to validate non-flattened metadata (i.e. directly read from index.json)
 */
const validateP2pcommons = (exports.validateP2pcommons = (indexMetadata, flat = true) => {
  if (flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  _validateP2pcommonsRequired(indexMetadata)
  _validateP2pcommonsType(indexMetadata)
})

const _validateP2pcommonsRequired = (indexMetadata) => {
  assert(
    indexMetadata.p2pcommons !== undefined,
    ValidationError,
    'p2pcommons is required',
    'p2pcommons_required',
    'p2pcommons'
  )
}

const _validateP2pcommonsType = (indexMetadata) => {
  assert(
    typeof indexMetadata.p2pcommons === 'object' &&
        !Array.isArray(indexMetadata.p2pcommons),
    ValidationError,
    'p2pcommons must be an object',
    'p2pcommons_type',
    'p2pcommons'
  )
}

/**
 * Validates the module type for a (complete or incomplete) set of module metadata
 *
 * @public
 * @throws ValidationError
 * @param {object} indexMetadata - metadata from index.json (=rawJSON)
 * @param {[Boolean]} flat - indicates whether the metadata is flattened - set false to validate non-flattened metadata (i.e. directly read from index.json)
 */
const validateType = (exports.validateType = (indexMetadata, flat = true) => {
  if (flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  _validateTypeRequired(indexMetadata)
  _validateTypeType(indexMetadata)
  _validateTypeValue(indexMetadata)
})

const _validateTypeRequired = (indexMetadata) => {
  assert(
    indexMetadata.p2pcommons.type !== undefined,
    ValidationError,
    'Type is required',
    'type_required',
    'p2pcommons.type'
  )
}

const _validateTypeType = (indexMetadata) => {
  assert(
    typeof indexMetadata.p2pcommons.type === 'string',
    ValidationError,
    'Type must be a string',
    'type_type',
    'p2pcommons.type'
  )
}

const _validateTypeValue = (indexMetadata) => {
  assert(
    indexMetadata.p2pcommons.type === 'profile' ||
        indexMetadata.p2pcommons.type === 'content',
    ValidationError,
    "Type must be equal to 'profile' or 'content'",
    'type_value',
    'p2pcommons.type'
  )
}

/**
 * Validates the subtype for a (complete or incomplete) set of module metadata
 *
 * @public
 * @throws ValidationError
 * @param {object} indexMetadata - metadata from index.json (=rawJSON)
 * @param {[Boolean]} flat - indicates whether the metadata is flattened - set false to validate non-flattened metadata (i.e. directly read from index.json)
 */
const validateSubtype = (exports.validateSubtype = (indexMetadata, flat = true) => {
  if (flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  _validateSubtypeRequired(indexMetadata)
  _validateSubtypeType(indexMetadata)
  _validateSubtypeFormat(indexMetadata)
})

const _validateSubtypeRequired = (indexMetadata) => {
  assert(
    indexMetadata.p2pcommons.subtype !== undefined,
    ValidationError,
    'Subtype is required',
    'subtype_required',
    'p2pcommons.subtype'
  )
}

const _validateSubtypeType = (indexMetadata) => {
  assert(
    typeof indexMetadata.p2pcommons.subtype === 'string',
    ValidationError,
    'Subtype must be a string',
    'subtype_type',
    'p2pcommons.subtype'
  )
}

const _validateSubtypeFormat = (indexMetadata) => {
  const regex = /^[A-Za-z0-9]*$/
  assert(
    indexMetadata.p2pcommons.subtype.match(regex),
    ValidationError,
    'Subtype may only include standard alphanumeric characters',
    'subtype_format',
    'p2pcommons.subtype'
  )
}

/**
 * Validates the main file (and its existence) for a (complete or incomplete) set of module metadata
 *
 * @public
 * @async
 * @throws ValidationError
 * @param {object} indexMetadata - metadata from index.json (=rawJSON)
 * @param {string} key - versioned or unversioned Hyperdrive key
 * @param {[string]} p2pcommonsDir - path to p2pcommons directory
 * @param {[Boolean]} flat - indicates whether the metadata is flattened - set false to validate non-flattened metadata (i.e. directly read from index.json)
 */
const validateMain = (exports.validateMain = async (indexMetadata, key, p2pcommonsDir = baseDir(), flat = true) => {
  if (flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  _validateMainRequired(indexMetadata)
  _validateMainType(indexMetadata)
  _validateMainNoDotfile(indexMetadata)
  _validateMainRelativePath(indexMetadata)
  await _validateMainExists(indexMetadata, key, p2pcommonsDir, flat)
})

const _validateMainRequired = (indexMetadata) => {
  assert(
    indexMetadata.p2pcommons.main !== undefined,
    ValidationError,
    'Main is required',
    'main_required',
    'p2pcommons.main'
  )
}

const _validateMainType = (indexMetadata) => {
  assert(
    typeof indexMetadata.p2pcommons.main === 'string',
    ValidationError,
    'Main must be a string',
    'main_type',
    'p2pcommons.main'
  )
}

const _validateMainNoDotfile = (indexMetadata) => {
  const filename = indexMetadata.p2pcommons.main.split('/').pop()
  assert(
    filename.charAt(0) !== '.',
    ValidationError,
    'Main may not be a .dotfile',
    'main_nodotfile',
    'p2pcommons.main'
  )
}

const _validateMainRelativePath = (indexMetadata) => {
  assert(
    _isRelativeFilePath(indexMetadata.p2pcommons.main),
    ValidationError,
    'Main may only contain a relative path within the module',
    'main_relativepath',
    'p2pcommons.main'
  )
}

const _validateMainExists = async (indexMetadata, key, p2pcommonsDir, flat = true) => {
  if (flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  assert(
    indexMetadata.p2pcommons.main.length > 0 ||
        indexMetadata.p2pcommons.type === 'profile',
    ValidationError,
    'Main may only be empty for profiles',
    'main_notempty',
    'p2pcommons.main'
  )

  if (indexMetadata.p2pcommons.main.length > 0) {
    const path = join(p2pcommonsDir, key, indexMetadata.p2pcommons.main)

    await access(path).catch(() => {
      throw new ValidationError(
        'Main must refer to an existing file',
        'main_exists',
        'p2pcommons.main'
      )
    })
  }
}

/**
 * Validates the avatar for a (complete or incomplete) set of module metadata
 *
 * @public
 * @throws ValidationError
 * @param {object} indexMetadata - metadata from index.json (=rawJSON)
 * @param {[Boolean]} flat - indicates whether the metadata is flattened - set false to validate non-flattened metadata (i.e. directly read from index.json)
 */
const validateAvatar = (exports.validateAvatar = (indexMetadata, flat = true) => {
  if (flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  _validateAvatarModuleType(indexMetadata)
  _validateAvatarType(indexMetadata)
  _validateAvatarRelativePath(indexMetadata)
})

const _validateAvatarModuleType = (indexMetadata) => {
  assert(
    indexMetadata.p2pcommons.avatar === undefined ||
        indexMetadata.p2pcommons.type === 'profile',
    ValidationError,
    'Avatar may only exist for profiles',
    'avatar_moduletype',
    'p2pcommons.avatar'
  )
}

const _validateAvatarType = (indexMetadata) => {
  assert(
    indexMetadata.p2pcommons.avatar === undefined ||
        typeof indexMetadata.p2pcommons.avatar === 'string',
    ValidationError,
    'Avatar must be a string',
    'avatar_type',
    'p2pcommons.avatar'
  )
}

const _validateAvatarRelativePath = (indexMetadata) => {
  assert(
    indexMetadata.p2pcommons.avatar === undefined ||
        _isRelativeFilePath(indexMetadata.p2pcommons.avatar),
    ValidationError,
    'Avatar may only contain a relative path within the module',
    'avatar_relativepath',
    'p2pcommons.avatar'
  )
}

/**
 * Validates the authors for a (complete or incomplete) set of module metadata
 *
 * @public
 * @throws ValidationError
 * @param {object} indexMetadata - metadata from index.json (=rawJSON)
 * @param {[Boolean]} flat - indicates whether the metadata is flattened - set false to validate non-flattened metadata (i.e. directly read from index.json)
 */
const validateAuthors = (exports.validateAuthors = (indexMetadata, flat = true) => {
  if (flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  _validateAuthorsRequired(indexMetadata)
  _validateAuthorsModuleType(indexMetadata)
  _validateAuthorsType(indexMetadata)
  _validateAuthorsUnique(indexMetadata)
  _validateAuthorsFormat(indexMetadata)
})

const _validateAuthorsRequired = (indexMetadata) => {
  assert(
    !(indexMetadata.p2pcommons.authors === undefined &&
        indexMetadata.p2pcommons.type === 'content'),
    ValidationError,
    'Authors is required for content',
    'authors_required',
    'p2pcommons.authors'
  )
}

const _validateAuthorsModuleType = (indexMetadata) => {
  assert(
    indexMetadata.p2pcommons.authors === undefined ||
        indexMetadata.p2pcommons.type === 'content',
    ValidationError,
    'Authors may only exist for content',
    'authors_moduletype',
    'p2pcommons.authors'
  )
}

const _validateAuthorsType = (indexMetadata) => {
  assert(
    indexMetadata.p2pcommons.authors === undefined ||
        Array.isArray(indexMetadata.p2pcommons.authors),
    ValidationError,
    'Authors must be an array',
    'authors_type',
    'p2pcommons.authors'
  )
}

const _validateAuthorsUnique = (indexMetadata) => {
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

const _validateAuthorsFormat = (indexMetadata) => {
  const regex = /^[a-f0-9]{64}$/
  if (indexMetadata.p2pcommons.authors !== undefined) {
    indexMetadata.p2pcommons.authors.forEach(author => {
      assert(
        typeof author === 'string' &&
                author.match(regex),
        ValidationError,
        'Authors may only contain non-versioned Hyperdrive keys',
        'authors_format',
        'p2pcommons.authors'
      )
    })
  }
}

/**
 * Validates the parents for a (complete or incomplete) set of module metadata
 *
 * @public
 * @throws ValidationError
 * @param {object} indexMetadata - metadata from index.json (=rawJSON)
 * @param {object} dbMetadata - metadata from the database (=metadata)
 * @param {string} key - versioned or unversioned Hyperdrive key
 * @param {[Boolean]} flat - indicates whether the metadata is flattened - set false to validate non-flattened metadata (i.e. directly read from index.json)
 */
const validateParents = (exports.validateParents = (indexMetadata, dbMetadata, key, flat = true) => {
  if (flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  _validateParentsRequired(indexMetadata)
  _validateParentsModuleType(indexMetadata)
  _validateParentsType(indexMetadata)
  _validateParentsUnique(indexMetadata)
  _validateParentsFormat(indexMetadata)
  _validateParentsNoSelfReference(indexMetadata, dbMetadata, key)
})

const _validateParentsRequired = (indexMetadata) => {
  assert(
    !(indexMetadata.p2pcommons.parents === undefined &&
        indexMetadata.p2pcommons.type === 'content'),
    ValidationError,
    'Parents is required for content',
    'parents_required',
    'p2pcommons.parents'
  )
}

const _validateParentsModuleType = (indexMetadata) => {
  assert(
    indexMetadata.p2pcommons.parents === undefined ||
        indexMetadata.p2pcommons.type === 'content',
    ValidationError,
    'Parents may only exist for content',
    'parents_moduletype',
    'p2pcommons.parents'
  )
}

const _validateParentsType = (indexMetadata) => {
  assert(
    indexMetadata.p2pcommons.parents === undefined ||
        Array.isArray(indexMetadata.p2pcommons.parents),
    ValidationError,
    'Parents must be an array',
    'parents_type',
    'p2pcommons.parents'
  )
}

const _validateParentsUnique = (indexMetadata) => {
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

const _validateParentsFormat = (indexMetadata) => {
  const regex = /^[a-f0-9]{64}(\+\d+)$/
  if (indexMetadata.p2pcommons.parents !== undefined) {
    indexMetadata.p2pcommons.parents.forEach(parent => {
      assert(
        typeof parent === 'string' &&
                parent.match(regex),
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
      const { host: unversionedParentKey, version: parentVersion } = parse(parent)
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

/**
 * Validates whether parents are registered.
 * This validation is only relevant at time of updating parents
 * and is not included in any of the other validations
 *
 * @public
 * @throws ValidationError
 * @param {object} indexMetadata - metadata from index.json (=rawJSON)
 * @param {SDK} p2pcommons - active instance of the p2pcommons SDK
 * @param {[Boolean]} flat - indicates whether the metadata is flattened - set false to validate non-flattened metadata (i.e. directly read from index.json)
 */
exports.validateParentsOnUpdate = async (indexMetadata, p2pcommons, flat = true) => {
  if (flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  await _validateParentsRegistered(indexMetadata, p2pcommons)
}

const _validateParentsRegistered = async (indexMetadata, p2pcommons) => {
  if (indexMetadata.p2pcommons.parents !== undefined) {
    for (const parentKey of indexMetadata.p2pcommons.parents) {
      let isRegistered = false
      const { rawJSON: parent } = await p2pcommons.get(parentKey)
      for (const authorKey of parent.authors) {
        const { rawJSON: author } = await p2pcommons.get(authorKey)
        if (author.contents.includes(parentKey)) {
          isRegistered = true
          break
        }
      }
      assert(
        isRegistered,
        ValidationError,
        'Parents must be registered by at least one author',
        'parents_registered',
        'p2pcommons.parents'
      )
    }
  }
}

/**
 * Validates the follows for a (complete or incomplete) set of module metadata
 *
 * @public
 * @throws ValidationError
 * @param {object} indexMetadata - metadata from index.json (=rawJSON)
 * @param {string} key - versioned or unversioned Hyperdrive key
 * @param {[Boolean]} flat - indicates whether the metadata is flattened - set false to validate non-flattened metadata (i.e. directly read from index.json)
 */
const validateFollows = (exports.validateFollows = (indexMetadata, key, flat = true) => {
  if (flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  _validateFollowsRequired(indexMetadata)
  _validateFollowsModuleType(indexMetadata)
  _validateFollowsType(indexMetadata)
  _validateFollowsUnique(indexMetadata)
  _validateFollowsFormat(indexMetadata)
  _validateFollowsNoSelfReference(indexMetadata, key)
})

const _validateFollowsRequired = (indexMetadata) => {
  assert(
    !(indexMetadata.p2pcommons.follows === undefined &&
        indexMetadata.p2pcommons.type === 'profile'),
    ValidationError,
    'Follows is required for profiles',
    'follows_required',
    'p2pcommons.follows'
  )
}

const _validateFollowsModuleType = (indexMetadata) => {
  assert(
    indexMetadata.p2pcommons.follows === undefined ||
        indexMetadata.p2pcommons.type === 'profile',
    ValidationError,
    'Follows may only exist for profiles',
    'follows_moduletype',
    'p2pcommons.follows'
  )
}

const _validateFollowsType = (indexMetadata) => {
  assert(
    indexMetadata.p2pcommons.follows === undefined ||
        Array.isArray(indexMetadata.p2pcommons.follows),
    ValidationError,
    'Follows must be an array',
    'follows_type',
    'p2pcommons.follows'
  )
}

const _validateFollowsUnique = (indexMetadata) => {
  const uniqueValues = [...new Set(indexMetadata.p2pcommons.follows)]
  assert(
    indexMetadata.p2pcommons.follows === undefined ||
        uniqueValues.length === indexMetadata.p2pcommons.follows.length,
    ValidationError,
    'Follows must be unique',
    'follows_unique',
    'p2pcommons.follows'
  )
}

const _validateFollowsFormat = (indexMetadata) => {
  const regex = /^[a-f0-9]{64}(\+\d+)?$/
  if (indexMetadata.p2pcommons.follows !== undefined) {
    indexMetadata.p2pcommons.follows.forEach(follow => {
      assert(
        typeof follow === 'string' &&
                follow.match(regex),
        ValidationError,
        'Follows may only contain Hyperdrive keys (versioned or non-versioned)',
        'follows_format',
        'p2pcommons.follows'
      )
    })
  }
}

const _validateFollowsNoSelfReference = (indexMetadata, key) => {
  if (indexMetadata.p2pcommons.follows !== undefined) {
    indexMetadata.p2pcommons.follows.forEach(follow => {
      const { host: unversionedFollowedKey } = parse(follow)
      const { host: unversionedFollowerKey } = parse(key)
      assert(
        unversionedFollowedKey !== unversionedFollowerKey,
        ValidationError,
        "Follows may not refer to the profile's own Hyperdrive key",
        'follows_noselfreference',
        'p2pcommons.follows'
      )
    })
  }
}

/**
 * Validates the contents for a (complete or incomplete) set of module metadata
 *
 * @public
 * @throws ValidationError
 * @param {object} indexMetadata - metadata from index.json (=rawJSON)
 * @param {[Boolean]} flat - indicates whether the metadata is flattened - set false to validate non-flattened metadata (i.e. directly read from index.json)
 */
const validateContents = (exports.validateContents = (indexMetadata, flat = true) => {
  if (flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  _validateContentsRequired(indexMetadata)
  _validateContentsModuleType(indexMetadata)
  _validateContentsType(indexMetadata)
  _validateContentsUnique(indexMetadata)
  _validateContentsFormat(indexMetadata)
})

const _validateContentsRequired = (indexMetadata) => {
  assert(
    !(indexMetadata.p2pcommons.contents === undefined &&
        indexMetadata.p2pcommons.type === 'profile'),
    ValidationError,
    'Contents is required for profiles',
    'contents_required',
    'p2pcommons.contents'
  )
}

const _validateContentsModuleType = (indexMetadata) => {
  assert(
    indexMetadata.p2pcommons.contents === undefined ||
        indexMetadata.p2pcommons.type === 'profile',
    ValidationError,
    'Contents may only exist for profiles',
    'contents_moduletype',
    'p2pcommons.contents'
  )
}

const _validateContentsType = (indexMetadata) => {
  assert(
    indexMetadata.p2pcommons.contents === undefined ||
        Array.isArray(indexMetadata.p2pcommons.contents),
    ValidationError,
    'Contents must be an array',
    'contents_type',
    'p2pcommons.contents'
  )
}

const _validateContentsUnique = (indexMetadata) => {
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

const _validateContentsFormat = (indexMetadata) => {
  const regex = /^[a-f0-9]{64}(\+\d+)?$/
  if (indexMetadata.p2pcommons.contents !== undefined) {
    indexMetadata.p2pcommons.contents.forEach(content => {
      assert(
        typeof content === 'string' &&
                content.match(regex),
        ValidationError,
        'Contents may only contain Hyperdrive keys (versioned or non-versioned)',
        'contents_format',
        'p2pcommons.contents'
      )
    })
  }
}

/**
 * Fully validates a content module and a profile module upon registration.
 * Includes cross-validation of module types and presence of the author in the content's metadata
 *
 * @public
 * @async
 * @throws ValidationError
 * @param {object} contentIndexMetadata - content's metadata from index.json (=rawJSON)
 * @param {object} contentDbMetadata - content's metadata from the database (=metadata)
 * @param {string} contentKey - content's versioned or unversioned Hyperdrive key
 * @param {object} profileIndexMetadata - profile's metadata from index.json (=rawJSON)
 * @param {object} profileDbMetadata - profile's metadata from the database (=metadata)
 * @param {string} profileKey - profile's versioned or unversioned Hyperdrive key
 * @param {[string]} p2pcommonsDir - path to p2pcommons directory
 * @param {[Boolean]} flat - indicates whether the metadata is flattened - set false to validate non-flattened metadata (i.e. directly read from index.json)
 */
exports.validateOnRegister = async (contentIndexMetadata, contentDbMetadata, contentKey, profileIndexMetadata, profileDbMetadata, profileKey, p2pcommonsDir = baseDir(), flat = true) => {
  if (flat) {
    contentIndexMetadata = _unflattenIndexMetadata(contentIndexMetadata)
    profileIndexMetadata = _unflattenIndexMetadata(profileIndexMetadata)
  }
  _validateOnRegisterModuleType(contentIndexMetadata)
  _validateOnRegisterAuthorsContainsProfileKey(contentIndexMetadata, profileKey)
  await validate(contentIndexMetadata, contentDbMetadata, contentKey, p2pcommonsDir, flat)
  await validate(profileIndexMetadata, profileDbMetadata, profileKey, p2pcommonsDir, flat)
}

const _validateOnRegisterModuleType = (contentIndexMetadata) => {
  assert(
    contentIndexMetadata.p2pcommons.type === 'content',
    ValidationError,
    'Only content may be registered to a profile',
    'onregister_moduletype',
    'p2pcommons.contents'
  )
}

const _validateOnRegisterAuthorsContainsProfileKey = (contentIndexMetadata, profileKey) => {
  const { host: unversionedProfileKey } = parse(profileKey)
  assert(
    contentIndexMetadata.p2pcommons.authors.includes(unversionedProfileKey),
    ValidationError,
    'Authors must contain profile key upon registration',
    'onregister_authorscontainsprofilekey',
    'p2pcommons.authors'
  )
}

/**
 * Validates whether the followed module is a profile.
 * This validation is only relevant at time of updating follows
 * and is not included in any of the other validations
 *
 * @public
 * @throws ValidationError
 * @param {object} followedIndexMetadata - followed profile's metadata from index.json (=rawJSON)
 * @param {[Boolean]} flat - indicates whether the metadata is flattened - set false to validate non-flattened metadata (i.e. directly read from index.json)
 */
exports.validateOnFollow = (followedIndexMetadata, flat = true) => {
  if (flat) {
    followedIndexMetadata = _unflattenIndexMetadata(followedIndexMetadata)
  }
  _validateOnFollowModuleType(followedIndexMetadata)
}

const _validateOnFollowModuleType = (followedIndexMetadata) => {
  assert(
    followedIndexMetadata.p2pcommons.type === 'profile',
    ValidationError,
    'Only profiles may be followed',
    'onfollow_moduletype',
    'p2pcommons.follows'
  )
}

const _isRelativeFilePath = (path) => {
  const regexIsRelativeOutsideModule = /^\.\.[\\/]/
  const regexIsURLOrAbsoluteWindowsPath = /:+/
  const regexIsPathToFolder = /[\\/]$/
  return !isAbsolute(path) &&
        !path.match(regexIsRelativeOutsideModule) &&
        !path.match(regexIsURLOrAbsoluteWindowsPath) &&
        !path.match(regexIsPathToFolder)
}

const _unflattenIndexMetadata = indexMetadata => {
  const unflattened = Object.assign({}, indexMetadata)
  if (indexMetadata.p2pcommons === undefined) {
    unflattened.p2pcommons = {}
    for (const p2pcommonsKey of p2pcommonsKeys) {
      if (indexMetadata[p2pcommonsKey] !== undefined) {
        unflattened.p2pcommons[p2pcommonsKey] = indexMetadata[p2pcommonsKey]
        delete unflattened[p2pcommonsKey]
      }
    }
  }
  return unflattened
}
