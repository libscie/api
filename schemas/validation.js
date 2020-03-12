const { LogicalType, Type } = require('@avro/types')
const { ValidationError } = require('../lib/errors')

/**
 * string validator
 *
 */

class Title extends LogicalType {
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

    if (val.length > 300) {
      throw new ValidationError('max limit exceeded (300)', val)
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

    if (val.length > 300) {
      throw new ValidationError('max limit exceeded (300)', val)
    }

    return val
  }
}

class Path extends LogicalType {
  constructor (attrs, opts) {
    super(attrs, opts)
    this._pattern = new RegExp(/^((?!\/)|(\.\/))(?!~|\.).*(?<!\/)$/)
    this.required = attrs.strict
  }

  _fromValue (val) {
    if (
      this.required &&
      (val === undefined || val === null || val.length === 0)
    ) {
      throw new ValidationError('path must be defined', val)
    }
    if (!this._pattern.test(val)) {
      throw new ValidationError('invalid path', val)
    }

    return val
  }

  _toValue (val) {
    if (
      this.required &&
      (val === undefined || val === null || val.length === 0)
    ) {
      throw new ValidationError('non empty string', val)
    }

    if (!this._pattern.test(val)) {
      throw new ValidationError('invalid path', val)
    }

    return val
  }
}

class DatUrl extends LogicalType {
  constructor (attrs, opts) {
    super(attrs, opts)
    this._pattern = new RegExp(/^(dat:\/\/)(\w{64})$/)
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
    let pattern = /^(dat:\/\/)(\w{64})(\+\d+)?$/
    if (attrs.strict) {
      pattern = /^(dat:\/\/)(\w{64})(\+\d+)$/
    }
    this._pattern = new RegExp(pattern)
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

class DateType extends LogicalType {
  _fromValue (val) {
    return new Date(val)
  }

  _toValue (date) {
    return date instanceof Date ? date.getTime() : undefined
  }

  _resolve (type) {
    if (Type.isType(type, 'long', 'string', 'logical:timestamp-millis')) {
      return this._fromValue
    }
  }
}

module.exports = {
  Title,
  Path,
  DatUrl,
  DatUrlVersion,
  DateType
}
