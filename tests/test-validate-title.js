const test = require('tape')
const validateTitle = require('../lib/validate-title')

module.exports = () => {
  test('Title - valid', t => {
    t.doesNotThrow(() => {
      validateTitle({
        indexMetadata: {
          title: 'This is a nice title'
        }
      })
    })
    t.end()
  })

  test('Title is required - missing', t => {
    t.throws(() => {
      validateTitle({ indexMetadata: {} })
    }, /title_required/)
    t.end()
  })

  test('Title must be a string - is number', t => {
    t.throws(() => {
      validateTitle({
        indexMetadata: {
          title: 5
        }
      })
    }, /title_type/)
    t.end()
  })

  test('Title must be between 1 and 300 characters long - is empty', t => {
    t.throws(() => {
      validateTitle({
        indexMetadata: {
          title: ''
        }
      })
    }, /title_length/)
    t.end()
  })

  test('Title must be between 1 and 300 characters long - is 301 characters', t => {
    t.throws(() => {
      validateTitle({
        indexMetadata: {
          title:
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        }
      })
    }, /title_length/)
    t.end()
  })

  test('Title may not consist of only whitespace - is a single space', t => {
    t.throws(() => {
      validateTitle({
        indexMetadata: {
          title: ' '
        }
      })
    }, /title_whitespace/)
    t.end()
  })

  test('Title may not consist of only whitespace - is various whitespace characters', t => {
    t.throws(() => {
      validateTitle({
        indexMetadata: {
          title: '    　'
        }
      })
    }, /title_whitespace/)
    t.end()
  })
}
