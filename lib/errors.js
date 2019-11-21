const customError = require('nanoerror')

class InvalidKeyError extends customError(
  'InvalidKeyError',
  'Invalid key: %s'
) {
  constructor (...args) {
    super(...args)
    this.invalid = this.args[0]
  }
}

exports.InvalidKeyError = InvalidKeyError

class ValidationError extends customError(
  'ValidationError',
  'Expected: %s - Received: %s | Property: %s'
) {
  constructor (...args) {
    super(...args)
    this.expected = this.args[0]
    this.received = this.args[1]
    this.key = this.args[2]
  }
}

exports.ValidationError = ValidationError

class MissingParam extends customError(
  'MissingParam',
  'Missing parameter: %s'
) {
  constructor (...args) {
    super(...args)
    this.key = this.args[0]
  }
}

exports.MissingParam = MissingParam
