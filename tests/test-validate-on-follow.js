const test = require('tape')
const validateOnFollow = require('../lib/validate-on-follow')

module.exports = () => {
  test('Follow - valid', t => {
    t.doesNotThrow(() => {
      validateOnFollow({
        followedIndexMetadata: {
          p2pcommons: {
            type: 'profile'
          }
        }
      })
    })
    t.end()
  })

  test('Only profiles may be followed - is content', t => {
    t.throws(() => {
      validateOnFollow({
        followedIndexMetadata: {
          p2pcommons: {
            type: 'content'
          }
        }
      })
    }, /onfollow_moduletype/)
    t.end()
  })
}
