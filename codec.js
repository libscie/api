const assert = require('assert')
const debug = require('debug')('p2pcommons')
const { Type } = require('@avro/types')
const GenericType = require('./schemas/generic.json')

class Codec {
  constructor (registry) {
    assert.ok(registry, 'registry is required')
    Type.forSchema(GenericType, { registry })
    this.registry = registry
    this.buffer = true
    this.type = 'AvroTypes'
  }

  encode (obj) {
    debug('p2pcommons:Codec:encode', obj)
    assert.strictEqual(
      typeof obj,
      'object',
      `Expected an object. Received: ${obj}`
    )
    assert.strictEqual(typeof obj.type, 'string', 'Missing property: type')
    assert.ok(obj.value, 'Missing property: value')
    const newVal = this.registry[obj.type].toBuffer(obj.value)
    // return a new generic
    return this.registry.Generic.toBuffer({ type: obj.type, value: newVal })
  }

  decode (buf) {
    debug('p2pcommons:Codec:decode')
    assert.ok(buf, 'buffer is required')
    const { type, value } = this.decodeGeneric(buf)
    debug('p2pcommons:Codec:decode type', type)
    return this.registry[type].fromBuffer(value)
  }

  decodeGeneric (buf) {
    try {
      const obj = this.registry.Generic.fromBuffer(buf)
      return obj
    } catch (err) {
      // Note(dk): improve error handling here - unknown type...
      console.error(err)
      return buf
    }
  }
}

module.exports = Codec
