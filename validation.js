const { LogicalType } = require('@avro/types')
const { ValidationError } = require('./lib/errors')

/**
 * string validator
 *
 */

class RequiredString extends LogicalType {
  constructor (attrs, opts) {
    super(attrs, opts)
    this._pattern = new RegExp(/^(?!\s*$).+/)
  }

  _fromValue (val) {
    if (val === undefined || val === null) {
      throw new ValidationError('non empty string', val)
    }
    if (!this._pattern.test(val)) {
      throw new ValidationError('non empty string', val)
    }
    return val
  }

  _toValue (val) {
    if (val === undefined || val === null) {
      throw new ValidationError('non empty string', val)
    }

    if (!this._pattern.test(val)) {
      throw new ValidationError('non empty string', val)
    }
    return val
  }
}

class DatUrl extends LogicalType {
  constructor (attrs, opts) {
    super(attrs, opts)
    this._pattern = new RegExp(/^(dat:\/\/)?(\w{64})$/)
  }

  _fromValue (val) {
    if (val === undefined || val === null) {
      throw new ValidationError('non empty string', val)
    }
    if (!this._pattern.test(val)) {
      throw new ValidationError('valid dat url', val)
    }
    return val
  }

  _toValue (val) {
    if (val === undefined || val === null) {
      throw new ValidationError('non empty string', val)
    }
    if (!this._pattern.test(val)) {
      throw new ValidationError('valid dat url', val)
    }
    return val
  }
}

class DatUrlVersion extends LogicalType {
  constructor (attrs, opts) {
    super(attrs, opts)
    this._pattern = new RegExp(/^(dat:\/\/)?(\w{64})(\+\d+)$/)
  }

  _fromValue (val) {
    if (val === undefined || val === null) {
      throw new ValidationError('non empty string', val)
    }
    if (!this._pattern.test(val)) {
      throw new ValidationError('valid dat url', val)
    }
    return val
  }

  _toValue (val) {
    if (val === undefined || val === null) {
      throw new ValidationError('non empty string', val)
    }
    if (!this._pattern.test(val)) {
      throw new ValidationError('valid dat url', val)
    }
    return val
  }
}

module.exports = {
  RequiredString,
  DatUrl,
  DatUrlVersion
}
