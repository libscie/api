module.exports = (sdk, msg, level = 'log') => {
  if (sdk.verbose) {
    console[level](msg)
  }
}
