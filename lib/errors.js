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
 * @param {string} description - may change across versions
 * @param {string} code - stable across versions
 * @param {string} property - property name
 * @returns {boolean}
 */
class ValidationError extends customError(
  'ValidationError',
  'Message: %s | Code: %s | Property: %s'
) {
  constructor (...args) {
    super(...args)
    this.description = this.args[0]
    this.code = this.args[1]
    this.property = this.args[2]
  }
}

exports.ValidationError = ValidationError

/**
 * TypeError
 * @class
 * @param {string} expected - expected value
 * @param {string} received - received value
 * @param {string} key - property name
 * @returns {boolean}
 */
class TypeError extends customError(
  'TypeError',
  'Expected: %s - Received: %s | Property: %s'
) {
  constructor (...args) {
    super(...args)
    this.expected = this.args[0]
    this.received = this.args[1]
    this.key = this.args[2]
  }
}

exports.TypeError = TypeError

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
