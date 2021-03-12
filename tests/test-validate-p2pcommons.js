const test = require('tape')
const validateP2Pcommons = require('../lib/validate-p2pcommons')
const {
  exampleKey1,
  exampleKey3,
  exampleKey4,
  exampleKey5V12,
  exampleKey6V4032
} = require('./example-key')

module.exports = () => {
  test('p2pcommons - valid', t => {
    t.doesNotThrow(() => {
      validateP2Pcommons({
        indexMetadata: {
          url: `hyper://${exampleKey1}`,
          p2pcommons: {
            type: 'content',
            subtype: '',
            main: 'test-content.html',
            authors: [exampleKey3, exampleKey4],
            parents: [exampleKey5V12, exampleKey6V4032]
          }
        }
      })
    })
    t.end()
  })

  test('p2pcommons is required - missing', t => {
    t.throws(() => {
      validateP2Pcommons({ indexMetadata: {}, _flat: false })
    }, /p2pcommons_required/)
    t.end()
  })

  test('p2pcommons must be an object - is array', t => {
    t.throws(() => {
      validateP2Pcommons({
        indexMetadata: {
          url: `hyper://${exampleKey1}`,
          p2pcommons: [
            {
              type: 'content',
              subtype: '',
              main: 'test-content.html',
              authors: [exampleKey3, exampleKey4],
              parents: [exampleKey5V12, exampleKey6V4032]
            }
          ]
        }
      })
    }, /p2pcommons_type/)
    t.end()
  })
}
