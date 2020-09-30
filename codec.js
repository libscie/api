const debug = require('debug')('p2pcommons:codec')
const assert = require('nanocustomassert')
const { Type } = require('@avro/types')
const GenericType = require('./schemas/generic.json')
const DBItemType = require('./schemas/dbitem.json')
const { DateType } = require('./schemas/validation')
const { MissingParam, TypeError } = require('./lib/errors')

class Codec {
  constructor (registry) {
    assert(registry, MissingParam, 'registry')
    this.genericType = Type.forSchema(GenericType, { registry })
    this.dbItemType = Type.forSchema(DBItemType, {
      registry,
      logicalTypes: {
        date: DateType
      }
    })
    this.registry = registry
    this.buffer = true
    this.type = 'AvroTypes'
  }

  encode (obj) {
    debug('p2pcommons:Codec:encode', obj)
    assert(typeof obj === 'object', TypeError, 'object', obj, 'obj')
    assert(
      typeof obj.rawJSON === 'object',
      TypeError,
      'object',
      obj.rawJSON,
      'rawJSON'
    )
    assert(
      typeof obj.rawJSON.p2pcommons.type === 'string',
      TypeError,
      'string',
      obj.rawJSON.p2pcommons.type,
      'type'
    )

    const newVal = this.registry[obj.avroType].toBuffer(obj.rawJSON)

    const raw = this.registry.Generic.toBuffer({
      type: obj.avroType,
      value: newVal
    })

    return this.registry.DBItem.toBuffer({
      isWritable: obj.isWritable,
      lastModified: obj.lastModified,
      version: obj.version,
      isCheckout: obj.isCheckout,
      rawJSON: raw
    })
  }

  decode (buf) {
    debug('p2pcommons:Codec:decode')
    assert(buf, MissingParam, 'buf')
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
