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

/**
 * ValidationError
 * @class
 * @param {string} expected - expected value
 * @param {string} received - received value
 * @param {string} key - property name
 * @returns {boolean}
 */
class ValidationError extends customError(
  'ValidationError',
  'Message: %s | Code: %s | Property: %s'
) {
  constructor (...args) {
    super(...args)
    this.description = this.args[0] // may change across versions
    this.code = this.args[1] // stable across versions
    this.property = this.args[2]
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

class EBUSYError extends customError(
  'EBUSYError',
  'Hyperdrive watch error. Description: %s | Hyperdrive: %s'
) {
  constructor (...args) {
    super(...args)
    this.description = this.args[0]
    this.key = this.args[1]
  }
}

exports.EBUSYError = EBUSYError
