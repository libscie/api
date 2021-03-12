const test = require('tape')
const { exampleKey1, exampleKey1V5, exampleKey2 } = require('./example-key')
const validateUrl = require('../lib/validate-url')

module.exports = () => {
  test('URL - valid', t => {
    t.doesNotThrow(() => {
      validateUrl({
        indexMetadata: {
          url: `hyper://${exampleKey1}`
        },
        key: exampleKey1
      })
    })
    t.end()
  })

  test('URL is required - missing', t => {
    t.throws(() => {
      validateUrl({ indexMetadata: {}, key: exampleKey1 })
    }, /url_required/)
    t.end()
  })

  test('URL must be a string - is object', t => {
    t.throws(() => {
      validateUrl({
        indexMetadata: {
          url: {}
        },
        key: exampleKey1
      })
    }, /url_type/)
    t.end()
  })

  test('URL must start with hyper:// protocol - no protocol', t => {
    t.throws(() => {
      validateUrl({
        indexMetadata: {
          url: exampleKey1
        },
        key: exampleKey1
      })
    }, /url_protocol/)
    t.end()
  })

  test('URL must start with hyper:// protocol - dat protocol', t => {
    t.throws(() => {
      validateUrl({
        indexMetadata: {
          url: `dat://${exampleKey1}`
        },
        key: exampleKey1
      })
    }, /url_protocol/)
    t.end()
  })

  test('URL must contain a valid non-versioned Hyperdrive key - invalid key', t => {
    t.throws(() => {
      validateUrl({
        indexMetadata: {
          url: `hyper://${exampleKey1.substr(0, 63)}`
        },
        key: exampleKey1
      })
    }, /url_format/)
    t.end()
  })

  test('URL must contain a valid non-versioned Hyperdrive key - versioned key', t => {
    t.throws(() => {
      validateUrl({
        indexMetadata: {
          url: `hyper://${exampleKey1V5}`
        },
        key: exampleKey1
      })
    }, /url_format/)
    t.end()
  })

  test("URL must refer to the module's own Hyperdrive key - other key", t => {
    t.throws(() => {
      validateUrl({
        indexMetadata: {
          url: `hyper://${exampleKey1}`
        },
        key: exampleKey2
      })
    }, /url_key/)
    t.end()
  })
}
