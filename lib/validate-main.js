/**
 * Validates the main file (and its existence) for a (complete or incomplete) set of module metadata
 *
 * @public
 * @async
 * @throws ValidationError
 * @param {object} params - object containing below parameters
 * @param {object} params.indexMetadata - metadata from index.json (=rawJSON)
 * @param {string} params.key - versioned or unversioned Hyperdrive key
 * @param {[string]} params.p2pcommonsDir - path to p2pcommons directory
 * @param {[Boolean]} params._flat - internal option - indicates whether the metadata is flattened
 */
const assert = require('nanocustomassert')
const {
  _isRelativeFilePath,
  _unflattenIndexMetadata
} = require('./validate-utils')
const { ValidationError } = require('./errors')
const { join, extname } = require('path')
const { access, readFile } = require('fs').promises
const { isText } = require('istextorbinary')
const baseDir = require('../lib/base-dir')
const openFormats = require('./extensions')

module.exports = async ({
  indexMetadata,
  key,
  p2pcommonsDir = baseDir(),
  _flat = true
}) => {
  if (_flat) {
    indexMetadata = _unflattenIndexMetadata(indexMetadata)
  }
  _validateMainRequired(indexMetadata)
  _validateMainType(indexMetadata)
  _validateMainNoDotfile(indexMetadata)
  _validateMainRelativePath(indexMetadata)
  await _validateMainExists(indexMetadata, key, p2pcommonsDir, _flat)
  await _validateMainContentType(indexMetadata, key, p2pcommonsDir)
}

const _validateMainRequired = indexMetadata => {
  assert(
    indexMetadata.p2pcommons.main !== undefined,
    ValidationError,
    'Main is required',
    'main_required',
    'p2pcommons.main'
  )
}

const _validateMainType = indexMetadata => {
  assert(
    typeof indexMetadata.p2pcommons.main === 'string',
    ValidationError,
    'Main must be a string',
    'main_type',
    'p2pcommons.main'
  )
}

const _validateMainNoDotfile = indexMetadata => {
  const filename = indexMetadata.p2pcommons.main.split('/').pop()
  assert(
    filename.charAt(0) !== '.',
    ValidationError,
    'Main may not be a .dotfile',
    'main_nodotfile',
    'p2pcommons.main'
  )
}

const _validateMainRelativePath = indexMetadata => {
  assert(
    _isRelativeFilePath(indexMetadata.p2pcommons.main),
    ValidationError,
    'Main may only contain a relative path within the module',
    'main_relativepath',
    'p2pcommons.main'
  )
}

const _validateMainContentType = async (indexMetadata, key, p2pcommonsDir) => {
  function getExtension (filename) {
    var ext = extname(filename || '').split('.')
    return ext[ext.length - 1]
  }
  assert(
    indexMetadata.p2pcommons.main.length > 0 ||
      indexMetadata.p2pcommons.type === 'profile',
    ValidationError,
    'Main may only be empty for profiles',
    'main_notempty',
    'p2pcommons.main'
  )
  if (
    !indexMetadata.p2pcommons.main ||
    (indexMetadata.p2pcommons.type === 'profile' &&
      indexMetadata.p2pcommons.main.length === 0)
  ) {
    return
  }

  const ext = getExtension(indexMetadata.p2pcommons.main)
  if (openFormats.includes(ext.toLowerCase())) {
    return
  }

  const mainPath = join(p2pcommonsDir, key, indexMetadata.p2pcommons.main)
  const mainBuffer = await readFile(mainPath)

  assert(
    isText(indexMetadata.p2pcommons.main, mainBuffer),
    ValidationError,
    `Main file should be an open format file or plain text. Received extension: ${ext}`,
    'main_extension',
    'p2pcommons.main'
  )
}

const _validateMainExists = async (
  indexMetadata,
  key,
  p2pcommonsDir,
  _flat = true
) => {
  if (_flat) {
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
