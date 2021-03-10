module.exports = (sdk, appType) => {
  if (appType === 'content') {
    return sdk.contentType
  }
  if (appType === 'profile') {
    return sdk.profileType
  }
}
