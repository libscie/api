const { LogicalType, Type } = require('@avro/types')
const { TypeError } = require('../lib/errors')

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
      throw new TypeError('non empty string', val)
    }
    if (!this._pattern.test(val)) {
      throw new TypeError('non empty string', val)
    }

    if (val.length > 300) {
      throw new TypeError('max limit exceeded (300)', val)
    }

    return val
  }

  _toValue (val) {
    if (val === undefined || val === null) {
      throw new TypeError('non empty string', val)
    }

    if (!this._pattern.test(val)) {
      throw new TypeError('non empty string', val)
    }

    if (val.length > 300) {
      throw new TypeError('max limit exceeded (300)', val)
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
      throw new TypeError('path must be defined', val)
    }
    if (!this._pattern.test(val)) {
      throw new TypeError('invalid path', val)
    }

    return val
  }

  _toValue (val) {
    if (
      this.required &&
      (val === undefined || val === null || val.length === 0)
    ) {
      throw new TypeError('non empty string', val)
    }

    if (!this._pattern.test(val)) {
      throw new TypeError('invalid path', val)
    }

    return val
  }
}

class HyperUrl extends LogicalType {
  constructor (attrs, opts) {
    super(attrs, opts)
    this._pattern = /^(hyper:\/\/)([a-f0-9]{64})$/i
  }

  _fromValue (val) {
    if (val === undefined || val === null) {
      throw new TypeError('non empty string', val)
    }
    if (!this._pattern.test(val)) {
      throw new TypeError('valid hyper url', val)
    }
    return val
  }

  _toValue (val) {
    if (val === undefined || val === null) {
      throw new TypeError('non empty string', val)
    }
    if (!this._pattern.test(val)) {
      throw new TypeError('valid hyper url', val)
    }
    return val
  }
}

class HyperUrlVersioned extends LogicalType {
  constructor (attrs, opts) {
    super(attrs, opts)
    this._pattern = /^(hyper:\/\/)([a-f0-9]{64})(\+\d+)?$/i
    if (attrs.strict) {
      this._pattern = /^(hyper:\/\/)([a-f0-9]{64})(\+\d+)$/i
    }
  }

  _fromValue (val) {
    if (val === undefined || val === null) {
      throw new TypeError('non empty string', val)
    }
    if (!this._pattern.test(val)) {
      throw new TypeError('valid hyper url', val)
    }
    return val
  }

  _toValue (val) {
    if (val === undefined || val === null) {
      throw new TypeError('non empty string', val)
    }
    if (!this._pattern.test(val)) {
      throw new TypeError('valid hyper url', val)
    }
    return val
  }
}

class HyperKey extends LogicalType {
  constructor (attrs, opts) {
    super(attrs, opts)
    this._pattern = /^([a-f0-9]{64})$/i
  }

  _fromValue (val) {
    if (val === undefined || val === null) {
      throw new TypeError('non empty string', val)
    }
    if (!this._pattern.test(val)) {
      throw new TypeError('valid hyper url', val)
    }
    return val
  }

  _toValue (val) {
    if (val === undefined || val === null) {
      throw new TypeError('non empty string', val)
    }
    if (!this._pattern.test(val)) {
      throw new TypeError('valid hyper url', val)
    }
    return val
  }
}

class HyperKeyVersioned extends LogicalType {
  constructor (attrs, opts) {
    super(attrs, opts)
    this._pattern = /^([a-f0-9]{64})(\+\d+)?$/i
    if (attrs.strict) {
      this._pattern = /^([a-f0-9]{64})(\+\d+)$/i
    }
  }

  _fromValue (val) {
    if (val === undefined || val === null) {
      throw new TypeError('non empty string', val)
    }
    if (!this._pattern.test(val)) {
      throw new TypeError('valid hyper url', val)
    }
    return val
  }

  _toValue (val) {
    if (val === undefined || val === null) {
      throw new TypeError('non empty string', val)
    }
    if (!this._pattern.test(val)) {
      throw new TypeError('valid hyper url', val)
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
  HyperUrl,
  HyperUrlVersioned,
  HyperKey,
  HyperKeyVersioned,
  DateType
}
