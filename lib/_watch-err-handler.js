const { EBUSYError } = require('./errors')

module.exports = (sdk, err, key) => {
  if (err.code === 'EBUSY') {
    const busyErr = new EBUSYError(err.message, key)
    sdk.emit('warn', busyErr)
  }
}
