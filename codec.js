const assert = require('assert')
const debug = require('debug')('p2pcommons:codec')
const { Type } = require('@avro/types')
const GenericType = require('./schemas/generic.json')
const DBItemType = require('./schemas/dbitem.json')

class Codec {
  constructor (registry) {
    assert.ok(registry, 'registry is required')
    Type.forSchema(GenericType, { registry })
    Type.forSchema(DBItemType, { registry })
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
    assert.strictEqual(
      typeof obj.rawJSON,
      'object',
      'Missing property: rawJSON'
    )
    assert.strictEqual(
      typeof obj.rawJSON.type,
      'string',
      'Missing property: rawJSON.type'
    )

    const newVal = this.registry[obj.avroType].toBuffer(obj.rawJSON)

    const raw = this.registry.Generic.toBuffer({
      type: obj.avroType,
      value: newVal
    })

    return this.registry.DBItem.toBuffer({
      isWritable: obj.isWritable,
      lastModified: obj.lastModified,
      rawJSON: raw
    })
  }

  decode (buf) {
    debug('p2pcommons:Codec:decode')
    assert.ok(buf, 'buffer is required')
    const dbitem = this.decodeGeneric(buf)
    debug('p2pcommons:Codec:decode dbitem', dbitem)

    return dbitem
  }

  decodeGeneric (buf) {
    debug('p2pcommons:Codec:decodeGeneric')
    try {
      const tmp = this.registry.DBItem.fromBuffer(buf)
      const { type, value } = this.registry.Generic.fromBuffer(tmp.rawJSON)
      const metadata = this.registry[type].fromBuffer(value)
      tmp.rawJSON = metadata
      return tmp
    } catch (err) {
      // Note(dk): improve error handling here - unknown type...
      console.error('decodeGeneric', err)
      return buf
    }
  }
}

module.exports = Codec
