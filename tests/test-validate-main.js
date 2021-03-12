const test = require('tape')
const { join } = require('path')

const validateMain = require('../lib/validate-main')
const { exampleKey1 } = require('./example-key')
const parse = require('../lib/parse-url')
const { writeFile } = require('fs').promises
const {
  doesNotThrowAsync,
  createDb,
  throwsAsync
} = require('./test-validate-helpers')

module.exports = () => {
  test('Main - valid', async t => {
    await throwsAsync(
      t,
      async () => {
        await validateMain({
          indexMetadata: {
            p2pcommons: {
              main: 'folder1/test-content.html'
            }
          },
          key: exampleKey1
        })
      },
      'main_exists'
    )
    t.end()
  })

  test('Main - empty for content', async t => {
    await throwsAsync(
      t,
      async () => {
        await validateMain({
          indexMetadata: {
            p2pcommons: {
              type: 'content',
              main: ''
            }
          },
          key: exampleKey1
        })
      },
      'main_notempty'
    )
    t.end()
  })

  test('Main is required - missing', async t => {
    await throwsAsync(
      t,
      async () => {
        await validateMain({
          indexMetadata: {
            p2pcommons: {}
          },
          key: exampleKey1
        })
      },
      'main_required'
    )
    t.end()
  })

  test('Main must be a string - is number', async t => {
    await throwsAsync(
      t,
      async () => {
        await validateMain({
          indexMetadata: {
            p2pcommons: {
              main: 123
            }
          },
          key: exampleKey1
        })
      },
      'main_type'
    )
    t.end()
  })

  test('Main may not be a .dotfile - is dotfile', async t => {
    await throwsAsync(
      t,
      async () => {
        await validateMain({
          indexMetadata: {
            p2pcommons: {
              main: 'folder1/.example.json'
            }
          },
          key: exampleKey1
        })
      },
      'main_nodotfile'
    )
    t.end()
  })

  test('Main may only contain a relative path within the module - URL', async t => {
    await throwsAsync(
      t,
      async () => {
        await validateMain({
          indexMetadata: {
            p2pcommons: {
              main: 'https://www.lovelywebsite.com/lovelyfile.html'
            }
          },
          key: exampleKey1
        })
      },
      'main_relativepath'
    )
    t.end()
  })

  test('Main may only contain a relative path within the module - windows absolute path', async t => {
    await throwsAsync(
      t,
      async () => {
        await validateMain({
          indexMetadata: {
            p2pcommons: {
              main: 'C:\\lovelyfile.html'
            }
          },
          key: exampleKey1
        })
      },
      'main_relativepath'
    )
    t.end()
  })

  test('Main may only contain a relative path within the module - relative path to folder', async t => {
    await throwsAsync(
      t,
      async () => {
        await validateMain({
          indexMetadata: {
            p2pcommons: {
              main: 'path/to/folder/'
            }
          },
          key: exampleKey1
        })
      },
      'main_relativepath'
    )
    t.end()
  })

  test('Main may only contain a relative path within the module - mac absolute path', async t => {
    await throwsAsync(
      t,
      async () => {
        await validateMain({
          indexMetadata: {
            p2pcommons: {
              main: '/home/user/module/lovelyfile.html'
            }
          },
          key: exampleKey1
        })
      },
      'main_relativepath'
    )
    t.end()
  })

  test('Main may only contain a relative path within the module - relative path outside module', async t => {
    await throwsAsync(
      t,
      async () => {
        await validateMain({
          indexMetadata: {
            p2pcommons: {
              main: '../lovelyfile.html'
            }
          },
          key: exampleKey1
        })
      },
      'main_relativepath'
    )
    t.end()
  })

  test('Main may only be empty for profiles - empty for content', async t => {
    await throwsAsync(
      t,
      async () => {
        await validateMain({
          indexMetadata: {
            p2pcommons: {
              type: 'content',
              main: ''
            }
          },
          key: exampleKey1
        })
      },
      'main_notempty'
    )
    t.end()
  })

  test('Main may only be empty for profiles - empty for profile', async t => {
    await doesNotThrowAsync(t, async () => {
      await validateMain({
        indexMetadata: {
          p2pcommons: {
            type: 'profile',
            main: ''
          }
        },
        key: exampleKey1
      })
    })
    t.end()
  })

  test('Main must refer to an existing file - exists', async t => {
    const p2p = createDb()
    const { rawJSON: content } = await p2p.init({
      type: 'content',
      title: 'Test main file - exists'
    })
    const { host: key } = parse(content.url)

    try {
      await writeFile(join(p2p.baseDir, key, 'main.txt'), 'hello')
    } catch (err) {
      t.fail(err.message)
    }

    try {
      await validateMain({
        indexMetadata: {
          p2pcommons: {
            main: 'main.txt'
          }
        },
        key,
        p2pcommonsDir: p2p.baseDir
      })
      t.pass('validate main OK')
    } catch (err) {
      t.fail(err.message)
    }
    await p2p.destroy()
    t.end()
  })

  test('Main must refer to an existing file - does not exist', async t => {
    const p2p = createDb()
    const { rawJSON: content } = await p2p.init({
      type: 'content',
      title: 'Test main file - exists'
    })
    const { host: key } = parse(content.url)

    try {
      await writeFile(join(p2p.baseDir, key, 'main2.txt'), 'hello')
    } catch (err) {
      t.fail(err.message)
    }

    try {
      await validateMain({
        indexMetadata: {
          p2pcommons: {
            main: 'main.txt'
          }
        },
        key,
        p2pcommonsDir: p2p.baseDir
      })
      t.fail('should throw')
    } catch (err) {
      t.same(
        err.code,
        'main_exists',
        'should throw error with code main_exists'
      )
    }

    await p2p.destroy()
    t.end()
  })

  test('Main must have a valid extension even if its not listed', async t => {
    const p2p = createDb()
    const { rawJSON: content } = await p2p.init({
      type: 'content',
      title: 'Test main file - exists'
    })
    const { host: key } = parse(content.url)

    try {
      // valid main file even if its extension is not listed on open formats
      await writeFile(
        join(p2p.baseDir, key, 'main.js'),
        'console.log("hola mundo")'
      )
    } catch (err) {
      t.fail(err.message)
    }

    try {
      await validateMain({
        indexMetadata: {
          p2pcommons: {
            main: 'main.js'
          }
        },
        key,
        p2pcommonsDir: p2p.baseDir
      })
      t.pass('validate main OK')
    } catch (err) {
      t.fail(err.message)
    }

    await p2p.destroy()
    t.end()
  })
}
