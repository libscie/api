const test = require('tape')
const validateLinks = require('../lib/validate-links')

module.exports = () => {
  test('Links - valid', t => {
    t.doesNotThrow(() => {
      validateLinks({
        indexMetadata: {
          links: {
            license: [
              {
                href:
                  'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
              }
            ],
            spec: [{ href: 'https://p2pcommons.com/specs/module/1.0.0' }]
          }
        }
      })
    })
    t.end()
  })

  test('Links is required - missing', t => {
    t.throws(() => {
      validateLinks({ indexMetadata: {} })
    }, /links_required/)
    t.end()
  })

  test('Links must be an object - is string', t => {
    t.throws(() => {
      validateLinks({
        indexMetadata: {
          links: 'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
        }
      })
    }, /links_type/)
    t.end()
  })

  test('Links must be an object with array values - has object values', t => {
    t.throws(() => {
      validateLinks({
        indexMetadata: {
          links: {
            license: {
              href:
                'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
            },
            spec: { href: 'https://p2pcommons.com/specs/module/1.0.0' }
          }
        }
      })
    }, /links_arrayvalues/)
    t.end()
  })

  test('License is required - missing', t => {
    t.throws(() => {
      validateLinks({
        indexMetadata: {
          links: {
            spec: [{ href: 'https://p2pcommons.com/specs/module/1.0.0' }]
          }
        }
      })
    }, /links_license_required/)
    t.end()
  })

  test('License must contain one object - multiple objects', t => {
    t.throws(() => {
      validateLinks({
        indexMetadata: {
          links: {
            license: [
              {
                href:
                  'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
              },
              {
                href:
                  'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
              }
            ],
            spec: [{ href: 'https://p2pcommons.com/specs/module/1.0.0' }]
          }
        }
      })
    }, /links_license_format/)
    t.end()
  })

  test('License must contain one object - one array', t => {
    t.throws(() => {
      validateLinks({
        indexMetadata: {
          links: {
            license: [
              ['https://creativecommons.org/publicdomain/zero/1.0/legalcode']
            ],
            spec: [{ href: 'https://p2pcommons.com/specs/module/1.0.0' }]
          }
        }
      })
    }, /links_license_format/)
    t.end()
  })

  test('License object must have an href key - link key', t => {
    t.throws(() => {
      validateLinks({
        indexMetadata: {
          links: {
            license: [
              {
                link:
                  'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
              }
            ],
            spec: [{ href: 'https://p2pcommons.com/specs/module/1.0.0' }]
          }
        }
      })
    }, /links_license_href/)
    t.end()
  })

  test('License link must be equal to CC0 - CC4 link', t => {
    t.throws(() => {
      validateLinks({
        indexMetadata: {
          links: {
            license: [
              { href: 'https://creativecommons.org/licenses/by/4.0/legalcode' }
            ],
            spec: [{ href: 'https://p2pcommons.com/specs/module/1.0.0' }]
          }
        }
      })
    }, /links_license_value/)
    t.end()
  })

  test('Spec is required - missing', t => {
    t.throws(() => {
      validateLinks({
        indexMetadata: {
          links: {
            license: [
              {
                href:
                  'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
              }
            ]
          }
        }
      })
    }, /links_spec_required/)
    t.end()
  })

  test('Spec must contain one object - multiple objects', t => {
    t.throws(() => {
      validateLinks({
        indexMetadata: {
          links: {
            license: [
              {
                href:
                  'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
              }
            ],
            spec: [
              { href: 'https://p2pcommons.com/specs/module/1.0.0' },
              { href: 'https://p2pcommons.com/specs/module/1.0.1' }
            ]
          }
        }
      })
    }, /links_spec_format/)
    t.end()
  })

  test('Spec must contain one object - one array', t => {
    t.throws(() => {
      validateLinks({
        indexMetadata: {
          links: {
            license: [
              {
                href:
                  'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
              }
            ],
            spec: ['https://p2pcommons.com/specs/module/1.0.0']
          }
        }
      })
    }, /links_spec_format/)
    t.end()
  })

  test('Spec object must have an href key - link key', t => {
    t.throws(() => {
      validateLinks({
        indexMetadata: {
          links: {
            license: [
              {
                href:
                  'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
              }
            ],
            spec: [{ link: 'https://p2pcommons.com/specs/module/1.0.0' }]
          }
        }
      })
    }, /links_spec_href/)
    t.end()
  })

  test('Spec url must refer to a valid p2pcommons module spec - other link', t => {
    t.throws(() => {
      validateLinks({
        indexMetadata: {
          links: {
            license: [
              {
                href:
                  'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
              }
            ],
            spec: [{ href: 'https://notp2pcommons.fake/specs/module/1.0.0' }]
          }
        }
      })
    }, /links_spec_validurl/)
    t.end()
  })
}
