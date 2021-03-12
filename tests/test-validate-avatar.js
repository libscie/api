const test = require('tape')
const validateAvatar = require('../lib/validate-avatar')

module.exports = () => {
  test('Avatar - valid', t => {
    t.doesNotThrow(() => {
      validateAvatar({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            avatar: 'avatar.png'
          }
        }
      })
    })
    t.end()
  })

  test('Avatar - empty', t => {
    t.doesNotThrow(() => {
      validateAvatar({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            avatar: ''
          }
        }
      })
    })
    t.end()
  })

  test('Avatar - missing', t => {
    t.doesNotThrow(() => {
      validateAvatar({
        indexMetadata: {
          p2pcommons: {
            type: 'profile'
          }
        }
      })
    })
    t.end()
  })

  test('Avatar may only exist for profiles - is content', t => {
    t.throws(() => {
      validateAvatar({
        indexMetadata: {
          p2pcommons: {
            type: 'content',
            avatar: 'avatar.png'
          }
        }
      })
    }, /avatar_moduletype/)
    t.end()
  })

  test('Avatar must be a string - is array', t => {
    t.throws(() => {
      validateAvatar({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            avatar: ['avatar.png', 'images/profilepic.jpg']
          }
        }
      })
    }, /avatar_type/)
    t.end()
  })

  test('Avatar may only contain a relative path within the module - URL', t => {
    t.throws(() => {
      validateAvatar({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            avatar: 'https://www.lovelywebsite.com/avatar.png'
          }
        }
      })
    }, /avatar_relativepath/)
    t.end()
  })

  test('Avatar may only contain a relative path within the module - windows absolute path', t => {
    t.throws(() => {
      validateAvatar({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            avatar: 'C:\\avatar.png'
          }
        }
      })
    }, /avatar_relativepath/)
    t.end()
  })

  test('Avatar may only contain a relative path within the module - mac absolute path', t => {
    t.throws(() => {
      validateAvatar({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            avatar: '/home/user/module/avatar.png'
          }
        }
      })
    }, /avatar_relativepath/)
    t.end()
  })

  test('Avatar may only contain a relative path within the module - relative path outside module', t => {
    t.throws(() => {
      validateAvatar({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            avatar: '../avatar.png'
          }
        }
      })
    }, /avatar_relativepath/)
    t.end()
  })
}
