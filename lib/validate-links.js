/**
 * Validates the links for a (complete or incomplete) set of module metadata
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
  _validateLinksRequired(indexMetadata)
  _validateLinksType(indexMetadata)
  _validateLinksArrayValues(indexMetadata)
  _validateLinksLicense(indexMetadata)
  _validateLinksSpec(indexMetadata)
}

const _validateLinksRequired = indexMetadata => {
  assert(
    indexMetadata.links !== undefined,
    ValidationError,
    'Links object is required',
    'links_required',
    'links'
  )
}

const _validateLinksType = indexMetadata => {
  assert(
    typeof indexMetadata.links === 'object' &&
      !Array.isArray(indexMetadata.links),
    ValidationError,
    'Links must be an object',
    'links_type',
    'links'
  )
}

const _validateLinksArrayValues = indexMetadata => {
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

const _validateLinksLicense = indexMetadata => {
  _validateLinksLicenseRequired(indexMetadata)
  _validateLinksLicenseFormat(indexMetadata)
  _validateLinksLicenseHrefKey(indexMetadata)
  _validateLinksLicenseValue(indexMetadata)
}

const _validateLinksLicenseRequired = indexMetadata => {
  assert(
    indexMetadata.links.license !== undefined,
    ValidationError,
    'License is required',
    'links_license_required',
    'links.license'
  )
}

const _validateLinksLicenseFormat = indexMetadata => {
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

const _validateLinksLicenseHrefKey = indexMetadata => {
  assert(
    indexMetadata.links.license[0].href !== undefined,
    ValidationError,
    'License object must have an href key',
    'links_license_href',
    'links.license'
  )
}

const _validateLinksLicenseValue = indexMetadata => {
  assert(
    indexMetadata.links.license[0].href ===
      'https://creativecommons.org/publicdomain/zero/1.0/legalcode',
    ValidationError,
    "License link must be equal to 'https://creativecommons.org/publicdomain/zero/1.0/legalcode",
    'links_license_value',
    'links.license'
  )
}

const _validateLinksSpec = indexMetadata => {
  _validateLinksSpecRequired(indexMetadata)
  _validateLinksSpecFormat(indexMetadata)
  _validateLinksSpecHrefKey(indexMetadata)
  _validateLinksSpecValidUrl(indexMetadata)
}

const _validateLinksSpecRequired = indexMetadata => {
  assert(
    indexMetadata.links.spec !== undefined,
    ValidationError,
    'Spec is required',
    'links_spec_required',
    'links.spec'
  )
}

const _validateLinksSpecFormat = indexMetadata => {
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

const _validateLinksSpecHrefKey = indexMetadata => {
  assert(
    indexMetadata.links.spec[0].href !== undefined,
    ValidationError,
    'Spec object must have an href key',
    'links_spec_href',
    'links.spec'
  )
}

const _validateLinksSpecValidUrl = indexMetadata => {
  const regex = /^https:\/\/p2pcommons.com\/specs\/module\/[0-9]+\.[0-9]+\.[0-9]+$/
  assert(
    indexMetadata.links.spec[0].href.match(regex),
    ValidationError,
    'Spec url must refer to a valid p2pcommons module spec',
    'links_spec_validurl',
    'links.spec'
  )
}
