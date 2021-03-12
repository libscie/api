const { isAbsolute } = require('path')

const p2pcommonsKeys = [
  'type',
  'subtype',
  'main',
  'avatar',
  'authors',
  'parents',
  'follows',
  'contents'
]

module.exports._isRelativeFilePath = path => {
  const regexIsRelativeOutsideModule = /^\.\.[\\/]/
  const regexIsURLOrAbsoluteWindowsPath = /:+/
  const regexIsPathToFolder = /[\\/]$/
  return (
    !isAbsolute(path) &&
    !path.match(regexIsRelativeOutsideModule) &&
    !path.match(regexIsURLOrAbsoluteWindowsPath) &&
    !path.match(regexIsPathToFolder)
  )
}

module.exports._unflattenIndexMetadata = indexMetadata => {
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
