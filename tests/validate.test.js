const test = require('tape')
const tempy = require('tempy')
const {
  promises: { writeFile, rename }
} = require('fs')
const { join } = require('path')
const {
  validate,
  validatePartial,
  validateOnRegister,
  validateOnFollow,
  validateTitle,
  validateDescription,
  validateUrl,
  validateLinks,
  validateP2pcommons,
  validateType,
  validateSubtype,
  validateMain,
  validateAvatar,
  validateAuthors,
  validateParents,
  validateParentsOnUpdate,
  validateFollows,
  validateContents
} = require('../lib/validate')
const SDK = require('../')
const parse = require('../lib/parse-url')
const { encode } = require('dat-encoding')

const exampleKey1 =
  '4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f'
const exampleKey1V5 =
  '4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f+5'
const exampleKey1V123 =
  '4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f+123'
const exampleKey2 =
  '8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8'
const exampleKey2V5 =
  '8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8+5'
const exampleKey2V40 =
  '8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8+40'
const exampleKey2V123 =
  '8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8+123'
const exampleKey3 =
  'cca6eb69a3ad6104ca31b9fee7832d74068db16ef2169eaaab5b48096e128342'
const exampleKey3V5 =
  'cca6eb69a3ad6104ca31b9fee7832d74068db16ef2169eaaab5b48096e128342+5'
const exampleKey4 =
  'f7daadc2d624df738abbccc9955714d94cef656406f2a850bfc499c2080627d4'
const exampleKey5V12 =
  'f0abcd6b1c4fc524e2d48da043b3d8399b96d9374d6606fca51182ee230b6b59+12'
const exampleKey6V4032 =
  '527f404aa77756b91cba4e3ba9fe30f72ee3eb5eef0f4da87172745f9389d1e5+4032'

const doesNotThrowAsync = async (t, fn) => {
  try {
    await fn()
    t.pass('should not throw')
  } catch (err) {
    console.log(err)
    t.fail('should not throw')
  }
}

const throwsAsync = async (t, fn, code) => {
  try {
    await fn()
    t.fail('should throw')
  } catch (err) {
    if (err.code.match(code)) {
      t.pass('should throw')
    } else {
      t.fail(`should throw ${code}`)
    }
  }
}

const defaultOpts = () => ({
  swarm: false,
  persist: false,
  watch: false
})

const createDb = opts => {
  const finalOpts = { ...defaultOpts(), ...opts }
  return new SDK({
    disableSwarm: !finalOpts.swarm,
    persist: finalOpts.persist,
    swarm: finalOpts.swarmFn,
    baseDir: tempy.directory()
  })
}

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

test('Description - valid description', t => {
  t.doesNotThrow(() => {
    validateDescription({
      indexMetadata: {
        description: 'This is a nice description'
      }
    })
  })
  t.end()
})

test('Description is required - no description', t => {
  t.throws(() => {
    validateDescription({ indexMetadata: {} })
  }, /description_required/)
  t.end()
})

test('Description must be a string - is array', t => {
  t.throws(() => {
    validateDescription({
      indexMetadata: {
        description: ['string']
      }
    })
  }, /description_type/)
  t.end()
})

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
            href: 'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
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

test('p2pcommons - valid', t => {
  t.doesNotThrow(() => {
    validateP2pcommons({
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
    validateP2pcommons({ indexMetadata: {}, _flat: false })
  }, /p2pcommons_required/)
  t.end()
})

test('p2pcommons must be an object - is array', t => {
  t.throws(() => {
    validateP2pcommons({
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

test('Type - valid', t => {
  t.doesNotThrow(() => {
    validateType({
      indexMetadata: {
        p2pcommons: {
          type: 'content'
        }
      }
    })
  })
  t.end()
})

test('Type is required - missing', t => {
  t.throws(() => {
    validateType({
      indexMetadata: {
        p2pcommons: {
          subtype: 'Q123'
        }
      }
    })
  }, /type_required/)
  t.end()
})

test('Type must be a string - is number', t => {
  t.throws(() => {
    validateType({
      indexMetadata: {
        p2pcommons: {
          type: 1
        }
      }
    })
  }, /type_type/)
  t.end()
})

test("Type must be equal to 'profile' or 'content' - other value", t => {
  t.throws(() => {
    validateType({
      indexMetadata: {
        p2pcommons: {
          type: 'Q123'
        }
      }
    })
  }, /type_value/)
  t.end()
})

test('Subtype - valid', t => {
  t.doesNotThrow(() => {
    validateSubtype({
      indexMetadata: {
        p2pcommons: {
          subtype: 'Q123'
        }
      }
    })
  })
  t.end()
})

test('Subtype - empty', t => {
  t.doesNotThrow(() => {
    validateSubtype({
      indexMetadata: {
        p2pcommons: {
          subtype: ''
        }
      }
    })
  })
  t.end()
})

test('Subtype is required - missing', t => {
  t.throws(() => {
    validateSubtype({
      indexMetadata: {
        p2pcommons: {
          type: 'content'
        }
      }
    })
  }, /subtype_required/)
  t.end()
})

test('Subtype must be a string - is number', t => {
  t.throws(() => {
    validateSubtype({
      indexMetadata: {
        p2pcommons: {
          subtype: 123
        }
      }
    })
  }, /subtype_type/)
  t.end()
})

test('Subtype may only include standard alphanumeric characters - contains spaces', t => {
  t.throws(() => {
    validateSubtype({
      indexMetadata: {
        p2pcommons: {
          subtype: 'Literature review'
        }
      }
    })
  }, /subtype_format/)
  t.end()
})

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
    t.same(err.code, 'main_exists', 'should throw error with code main_exists')
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

test('Authors - valid', t => {
  t.doesNotThrow(() => {
    validateAuthors({
      indexMetadata: {
        p2pcommons: {
          type: 'content',
          authors: [exampleKey1, exampleKey2]
        }
      }
    })
  })
  t.end()
})

test('Authors is only required for content - missing for profile', t => {
  t.doesNotThrow(() => {
    validateAuthors({
      indexMetadata: {
        p2pcommons: {
          type: 'profile'
        }
      }
    })
  })
  t.end()
})

test('Authors is required for content - missing', t => {
  t.throws(() => {
    validateAuthors({
      indexMetadata: {
        p2pcommons: {
          type: 'content'
        }
      }
    })
  }, /authors_required/)
  t.end()
})

test('Authors may only exist for content - exists for profile', t => {
  t.throws(() => {
    validateAuthors({
      indexMetadata: {
        p2pcommons: {
          type: 'profile',
          authors: [exampleKey1, exampleKey2]
        }
      }
    })
  }, /authors_moduletype/)
  t.end()
})

test('Authors must be an array - is string', t => {
  t.throws(() => {
    validateAuthors({
      indexMetadata: {
        p2pcommons: {
          type: 'content',
          authors: exampleKey2
        }
      }
    })
  }, /authors_type/)
  t.end()
})

test('Authors must be unique - contains duplicates', t => {
  t.throws(() => {
    validateAuthors({
      indexMetadata: {
        p2pcommons: {
          type: 'content',
          authors: [exampleKey1, exampleKey2, exampleKey2]
        }
      }
    })
  }, /authors_unique/)
  t.end()
})

test('Authors may only contain non-versioned Hyperdrive keys - contains versioned keys', t => {
  t.throws(() => {
    validateAuthors({
      indexMetadata: {
        p2pcommons: {
          type: 'content',
          authors: [exampleKey1, exampleKey2V5]
        }
      }
    })
  }, /authors_format/)
  t.end()
})

test('Authors may only contain non-versioned Hyperdrive keys - contains names', t => {
  t.throws(() => {
    validateAuthors({
      indexMetadata: {
        p2pcommons: {
          type: 'content',
          authors: [exampleKey1, 'James Lomas']
        }
      }
    })
  }, /authors_format/)
  t.end()
})

test('Parents - valid', t => {
  t.doesNotThrow(() => {
    validateParents({
      indexMetadata: {
        p2pcommons: {
          type: 'content',
          parents: [exampleKey2V5, exampleKey2V123]
        }
      },
      dbMetadata: {
        version: 10
      },
      key: exampleKey1
    })
  })
  t.end()
})

test('Parents is only required for content - missing for profile', t => {
  t.doesNotThrow(() => {
    validateParents({
      indexMetadata: {
        p2pcommons: {
          type: 'profile'
        }
      },
      dbMetadata: {
        version: 10
      },
      key: exampleKey1
    })
  })
  t.end()
})

test('Parents is required for content - missing', t => {
  t.throws(() => {
    validateParents({
      indexMetadata: {
        p2pcommons: {
          type: 'content'
        }
      },
      dbMetadata: {
        version: 10
      },
      key: exampleKey1
    })
  }, /parents_required/)
  t.end()
})

test('Parents may only exist for content - exists for profile', t => {
  t.throws(() => {
    validateParents({
      indexMetadata: {
        p2pcommons: {
          type: 'profile',
          parents: [exampleKey1V5, exampleKey2V123]
        }
      },
      dbMetadata: {
        version: 10
      },
      key: exampleKey1
    })
  }, /parents_moduletype/)
  t.end()
})

test('Parents must be an array - is string', t => {
  t.throws(() => {
    validateParents({
      indexMetadata: {
        p2pcommons: {
          type: 'content',
          parents: exampleKey2V5
        }
      },
      dbMetadata: {
        version: 10
      },
      key: exampleKey1
    })
  }, /parents_type/)
  t.end()
})

test('Parents must be unique - contains multiple versions of same key', t => {
  t.doesNotThrow(() => {
    validateParents({
      indexMetadata: {
        p2pcommons: {
          type: 'content',
          parents: [exampleKey1V5, exampleKey2V40, exampleKey2V123]
        }
      },
      dbMetadata: {
        version: 10
      },
      key: exampleKey1
    })
  })
  t.end()
})

test('Parents must be unique - contains duplicates', t => {
  t.throws(() => {
    validateParents({
      indexMetadata: {
        p2pcommons: {
          type: 'content',
          parents: [exampleKey1V5, exampleKey2V123, exampleKey2V123]
        }
      },
      dbMetadata: {
        version: 10
      },
      key: exampleKey1
    })
  }, /parents_unique/)
  t.end()
})

test('Parents may only contain versioned Hyperdrive keys - contains non-versioned keys', t => {
  t.throws(() => {
    validateParents({
      indexMetadata: {
        p2pcommons: {
          type: 'content',
          parents: [exampleKey1, exampleKey2V5]
        }
      },
      dbMetadata: {
        version: 10
      },
      key: exampleKey1
    })
  }, /parents_format/)
  t.end()
})

test('Parents may not refer to current or future versions of itself - contains previous version', t => {
  t.doesNotThrow(() => {
    validateParents({
      indexMetadata: {
        p2pcommons: {
          type: 'content',
          parents: [exampleKey1V5, exampleKey2V40, exampleKey2V123]
        }
      },
      dbMetadata: {
        version: 10
      },
      key: exampleKey1
    })
  })
  t.end()
})

test('Parents may not refer to current or future versions of itself - contains version at time of editing', t => {
  t.doesNotThrow(() => {
    validateParents({
      indexMetadata: {
        p2pcommons: {
          type: 'content',
          parents: [exampleKey1V5, exampleKey2V40, exampleKey2V123]
        }
      },
      dbMetadata: {
        version: 5
      },
      key: exampleKey1
    })
  })
  t.end()
})

test('Parents may not refer to current or future versions of itself - contains future version', t => {
  t.throws(() => {
    validateParents({
      indexMetadata: {
        p2pcommons: {
          type: 'content',
          parents: [exampleKey1V123, exampleKey2V40, exampleKey2V123]
        }
      },
      dbMetadata: {
        version: 10
      },
      key: exampleKey1
    })
  }, /parents_noselfreference/)
  t.end()
})

test('Parents must be registered by at least one author - 1 parent, 1 author, registered', async t => {
  const p2p = createDb()

  const { rawJSON: profile } = await p2p.init({
    type: 'profile',
    title: 'Author 1'
  })

  let { rawJSON: parent, metadata: parentMetadata } = await p2p.init({
    type: 'content',
    title: 'Parent content 1'
  })
  const { host: parentKey } = parse(parent.url)

  try {
    await writeFile(join(p2p.baseDir, parentKey, 'main.txt'), 'hello')
  } catch (err) {
    t.fail(err.message)
  }

  ;({ rawJSON: parent, metadata: parentMetadata } = await p2p.set({
    url: parent.url,
    main: 'main.txt',
    authors: [encode(profile.url)]
  }))

  try {
    await p2p.register(
      `${encode(parent.url)}+${parentMetadata.version}`,
      encode(profile.url)
    )
  } catch (err) {
    t.fail(err.message)
  }

  await doesNotThrowAsync(t, async () => {
    await validateParentsOnUpdate({
      indexMetadata: {
        p2pcommons: {
          parents: [`${parentKey}+${parentMetadata.version}`]
        }
      },
      p2pcommons: p2p
    })
  })

  await p2p.destroy()
  t.end()
})

test('Parents must be registered by at least one author - 2 parents, 2 authors, registered', async t => {
  const p2p = createDb()

  const { rawJSON: profile1 } = await p2p.init({
    type: 'profile',
    title: 'Author 1'
  })

  const { rawJSON: profile2 } = await p2p.init({
    type: 'profile',
    title: 'Author 2'
  })

  let { rawJSON: parent1, metadata: parent1Metadata } = await p2p.init({
    type: 'content',
    title: 'Parent content 1'
  })
  const { host: parent1Key } = parse(parent1.url)

  let { rawJSON: parent2, metadata: parent2Metadata } = await p2p.init({
    type: 'content',
    title: 'Parent content 2'
  })
  const { host: parent2Key } = parse(parent2.url)

  try {
    await writeFile(join(p2p.baseDir, parent1Key, 'main.txt'), 'hello')
    await writeFile(join(p2p.baseDir, parent2Key, 'main.txt'), 'hello')
  } catch (err) {
    t.fail(err.message)
  }

  ;({ rawJSON: parent1, metadata: parent1Metadata } = await p2p.set({
    url: parent1.url,
    main: 'main.txt',
    authors: [encode(profile1.url), encode(profile2.url)]
  }))
  ;({ rawJSON: parent2, metadata: parent2Metadata } = await p2p.set({
    url: parent2.url,
    main: 'main.txt',
    authors: [encode(profile2.url)]
  }))

  try {
    await p2p.register(
      `${encode(parent1.url)}+${parent1Metadata.version}`,
      encode(profile2.url)
    )
  } catch (err) {
    t.fail(err.message)
  }
  try {
    await p2p.register(
      `${encode(parent2.url)}+${parent2Metadata.version}`,
      encode(profile2.url)
    )
  } catch (err) {
    t.fail(err.message)
  }

  await doesNotThrowAsync(t, async () => {
    await validateParentsOnUpdate({
      indexMetadata: {
        p2pcommons: {
          parents: [
            `${parent1Key}+${parent1Metadata.version}`,
            `${parent2Key}+${parent2Metadata.version}`
          ]
        }
      },
      p2pcommons: p2p
    })
  })

  await p2p.destroy()
  t.end()
})

test('Parents must be registered by at least one author - 1 parent, 1 author, not registered', async t => {
  const p2p = createDb()

  const { rawJSON: profile1 } = await p2p.init({
    type: 'profile',
    title: 'Author 1'
  })

  let { rawJSON: parent1, metadata: parent1Metadata } = await p2p.init({
    type: 'content',
    title: 'Parent content 1'
  })
  const { host: parent1Key } = parse(parent1.url)

  try {
    await writeFile(join(p2p.baseDir, parent1Key, 'main.txt'), 'hello')
  } catch (err) {
    t.fail(err.message)
  }

  ;({ rawJSON: parent1, metadata: parent1Metadata } = await p2p.set({
    url: parent1.url,
    main: 'main.txt',
    authors: [encode(profile1.url)]
  }))

  await throwsAsync(
    t,
    async () => {
      await validateParentsOnUpdate({
        indexMetadata: {
          p2pcommons: {
            parents: [`${parent1Key}+${parent1Metadata.version}`]
          }
        },
        p2pcommons: p2p
      })
    },
    'parents_registered'
  )

  await p2p.destroy()
  t.end()
})

test('Parents must be registered by at least one author - 2 parents, 2 authors, 1 not registered', async t => {
  const p2p = createDb()

  const { rawJSON: profile1 } = await p2p.init({
    type: 'profile',
    title: 'Author 1'
  })

  const { rawJSON: profile2 } = await p2p.init({
    type: 'profile',
    title: 'Author 2'
  })

  let { rawJSON: parent1, metadata: parent1Metadata } = await p2p.init({
    type: 'content',
    title: 'Parent content 1'
  })
  const { host: parent1Key } = parse(parent1.url)

  let { rawJSON: parent2, metadata: parent2Metadata } = await p2p.init({
    type: 'content',
    title: 'Parent content 2'
  })
  const { host: parent2Key } = parse(parent2.url)

  try {
    await writeFile(join(p2p.baseDir, parent1Key, 'main.txt'), 'hello')
    await writeFile(join(p2p.baseDir, parent2Key, 'main.txt'), 'hello')
  } catch (err) {
    t.fail(err.message)
  }

  ;({ rawJSON: parent1, metadata: parent1Metadata } = await p2p.set({
    url: parent1.url,
    main: 'main.txt',
    authors: [encode(profile1.url), encode(profile2.url)]
  }))
  ;({ rawJSON: parent2, metadata: parent2Metadata } = await p2p.set({
    url: parent2.url,
    main: 'main.txt',
    authors: [encode(profile2.url)]
  }))

  try {
    await p2p.register(
      `${encode(parent1.url)}+${parent1Metadata.version}`,
      encode(profile1.url)
    )
  } catch (err) {
    t.fail(err.message)
  }

  await throwsAsync(
    t,
    async () => {
      await validateParentsOnUpdate({
        indexMetadata: {
          p2pcommons: {
            parents: [
              `${parent1Key}+${parent1Metadata.version}`,
              `${parent2Key}+${parent2Metadata.version}`
            ]
          }
        },
        p2pcommons: p2p
      })
    },
    'parents_registered'
  )

  await p2p.destroy()
  t.end()
})

test('Follows - valid', t => {
  t.doesNotThrow(() => {
    validateFollows({
      indexMetadata: {
        p2pcommons: {
          type: 'profile',
          follows: [exampleKey2, exampleKey2V123, exampleKey3]
        }
      },
      key: exampleKey1
    })
  })
  t.end()
})

test('Follows is only required for profiles - missing for content', t => {
  t.doesNotThrow(() => {
    validateFollows({
      indexMetadata: {
        p2pcommons: {
          type: 'content'
        }
      },
      key: exampleKey1
    })
  })
  t.end()
})

test('Follows is required for profiles - missing', t => {
  t.throws(() => {
    validateFollows({
      indexMetadata: {
        p2pcommons: {
          type: 'profile'
        }
      },
      key: exampleKey1
    })
  }, /follows_required/)
  t.end()
})

test('Follows may only exist for profiles - exists for content', t => {
  t.throws(() => {
    validateFollows({
      indexMetadata: {
        p2pcommons: {
          type: 'content',
          follows: [exampleKey3V5, exampleKey2V123]
        }
      },
      key: exampleKey1
    })
  }, /follows_moduletype/)
  t.end()
})

test('Follows must be an array - is string', t => {
  t.throws(() => {
    validateFollows({
      indexMetadata: {
        p2pcommons: {
          type: 'profile',
          follows: exampleKey2V5
        }
      },
      key: exampleKey1
    })
  }, /follows_type/)
  t.end()
})

test('Follows must be unique - contains multiple versions of same key', t => {
  t.doesNotThrow(() => {
    validateFollows({
      indexMetadata: {
        p2pcommons: {
          type: 'profile',
          follows: [exampleKey3V5, exampleKey2, exampleKey2V123]
        }
      },
      key: exampleKey1
    })
  })
  t.end()
})

test('Follows must be unique - contains duplicates', t => {
  t.throws(() => {
    validateFollows({
      indexMetadata: {
        p2pcommons: {
          type: 'profile',
          follows: [exampleKey3V5, exampleKey2, exampleKey2]
        }
      },
      key: exampleKey1
    })
  }, /follows_unique/)
  t.end()
})

test('Follows may only contain Hyperdrive keys (versioned or non-versioned) - contains URL', t => {
  t.throws(() => {
    validateFollows({
      indexMetadata: {
        p2pcommons: {
          type: 'profile',
          follows: [exampleKey3, `hyper://${exampleKey2V5}`]
        }
      },
      key: exampleKey1
    })
  }, /follows_format/)
  t.end()
})

test("Follows may not refer to the profile's own Hyperdrive key - contains unversioned key", t => {
  t.throws(() => {
    validateFollows({
      indexMetadata: {
        p2pcommons: {
          type: 'profile',
          follows: [exampleKey1, exampleKey2V40, exampleKey2V123]
        }
      },
      key: exampleKey1
    })
  }, /follows_noselfreference/)
  t.end()
})

test("Follows may not refer to the profile's own Hyperdrive key - contains versioned key", t => {
  t.throws(() => {
    validateFollows({
      indexMetadata: {
        p2pcommons: {
          type: 'profile',
          follows: [exampleKey1V5, exampleKey2, exampleKey2V123]
        }
      },
      key: exampleKey1
    })
  }, /follows_noselfreference/)
  t.end()
})

test('Contents - valid', t => {
  t.doesNotThrow(() => {
    validateContents({
      indexMetadata: {
        p2pcommons: {
          type: 'profile',
          contents: [exampleKey2, exampleKey2V123, exampleKey3]
        }
      },
      key: exampleKey1
    })
  })
  t.end()
})

test('Contents is only required for profiles - missing for content', t => {
  t.doesNotThrow(() => {
    validateContents({
      indexMetadata: {
        p2pcommons: {
          type: 'content'
        }
      },
      key: exampleKey1
    })
  })
  t.end()
})

test('Contents is required for profiles - missing', t => {
  t.throws(() => {
    validateContents({
      indexMetadata: {
        p2pcommons: {
          type: 'profile'
        }
      },
      key: exampleKey1
    })
  }, /contents_required/)
  t.end()
})

test('Contents may only exist for profiles - exists for content', t => {
  t.throws(() => {
    validateContents({
      indexMetadata: {
        p2pcommons: {
          type: 'content',
          contents: [exampleKey3V5, exampleKey2V123]
        }
      },
      key: exampleKey1
    })
  }, /contents_moduletype/)
  t.end()
})

test('Contents must be an array - is string', t => {
  t.throws(() => {
    validateContents({
      indexMetadata: {
        p2pcommons: {
          type: 'profile',
          contents: exampleKey2V5
        }
      },
      key: exampleKey1
    })
  }, /contents_type/)
  t.end()
})

test('Contents must be unique - contains multiple versions of same key', t => {
  t.doesNotThrow(() => {
    validateContents({
      indexMetadata: {
        p2pcommons: {
          type: 'profile',
          contents: [exampleKey3V5, exampleKey2, exampleKey2V123]
        }
      },
      key: exampleKey1
    })
  })
  t.end()
})

test('Contents must be unique - contains duplicates', t => {
  t.throws(() => {
    validateContents({
      indexMetadata: {
        p2pcommons: {
          type: 'profile',
          contents: [exampleKey3V5, exampleKey2, exampleKey2]
        }
      },
      key: exampleKey1
    })
  }, /contents_unique/)
  t.end()
})

test('Contents may only contain Hyperdrive keys (versioned or non-versioned) - contains URL', t => {
  t.throws(() => {
    validateContents({
      indexMetadata: {
        p2pcommons: {
          type: 'profile',
          contents: [
            exampleKey3,
            'hyper://8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8+5'
          ]
        }
      },
      key: exampleKey1
    })
  }, /contents_format/)
  t.end()
})

test('Validate draft - valid content', async t => {
  await throwsAsync(
    t,
    async () => {
      await validatePartial({
        indexMetadata: {
          title: 'Content example',
          description: '',
          url: `hyper://${exampleKey1}`,
          links: {
            license: [
              {
                href:
                  'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
              }
            ],
            spec: [{ href: 'https://p2pcommons.com/specs/module/1.0.0' }]
          },
          p2pcommons: {
            type: 'content',
            subtype: '',
            main: 'test-content.html',
            authors: [exampleKey3, exampleKey4],
            parents: [exampleKey5V12, exampleKey6V4032]
          }
        },
        dbMetadata: {
          version: 50
        },
        key: exampleKey1
      })
    },
    /main_exists/
  )
  t.end()
})

test('Validate draft - invalid content (future self-reference parent)', async t => {
  await throwsAsync(
    t,
    async () => {
      await validatePartial({
        indexMetadata: {
          title: 'Content example',
          description: '',
          url: `hyper://${exampleKey1}`,
          links: {
            license: [
              {
                href:
                  'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
              }
            ],
            spec: [{ href: 'https://p2pcommons.com/specs/module/1.0.0' }]
          },
          p2pcommons: {
            type: 'content',
            subtype: '',
            main: 'test-content.html',
            authors: [exampleKey3, exampleKey4],
            parents: [exampleKey5V12, exampleKey1V123]
          }
        },
        dbMetadata: {
          version: 5
        },
        key: exampleKey1
      })
    },
    /parents_noselfreference/
  )
  t.end()
})

test('Validate draft - valid profile', async t => {
  await doesNotThrowAsync(t, async () => {
    await validatePartial({
      indexMetadata: {
        title: 'Profile example',
        description: '',
        url: `hyper://${exampleKey3}`,
        links: {
          license: [
            {
              href:
                'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
            }
          ],
          spec: [{ href: 'https://p2pcommons.com/specs/module/1.0.0' }]
        },
        p2pcommons: {
          type: 'profile',
          subtype: '',
          main: '',
          avatar: './test.png',
          follows: [exampleKey4],
          contents: [
            '00a4f2f18bb6cb4e9ba7c2c047c8560d34047457500e415d535de0526c6b4f23+12'
          ]
        }
      },
      dbMetadata: {
        version: 50
      },
      key: exampleKey3
    })
  })
  t.end()
})

test('Validate - flattened index.json', async t => {
  await throwsAsync(
    t,
    async () => {
      await validate({
        indexMetadata: {
          title: 'Content example',
          description: '',
          url: `hyper://${exampleKey1}`,
          links: {
            license: [
              {
                href:
                  'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
              }
            ],
            spec: [{ href: 'https://p2pcommons.com/specs/module/1.0.0' }]
          },
          type: 'content',
          subtype: '',
          main: 'test-content.html',
          authors: [exampleKey3, exampleKey4],
          parents: [exampleKey5V12, exampleKey6V4032]
        },
        dbMetadata: {
          version: 50
        },
        key: exampleKey1,
        _flat: false
      })
    },
    /p2pcommons_required/
  )
  t.end()
})

test('Validate before init - only type content, flattened', async t => {
  await doesNotThrowAsync(t, async () => {
    await validatePartial({
      indexMetadata: {
        type: 'content'
      }
    })
  })
  t.end()
})

test('Validate before init - only type profile, flattened', async t => {
  await doesNotThrowAsync(t, async () => {
    await validatePartial({
      indexMetadata: {
        type: 'profile'
      }
    })
  })
  t.end()
})

test('Validate before init - type missing', async t => {
  await throwsAsync(
    t,
    async () => {
      await validatePartial({
        indexMetadata: {
          title: 'Profile example'
        }
      })
    },
    /type_required/
  )
  t.end()
})

test('Validate before init - main path empty', async t => {
  await doesNotThrowAsync(t, async () => {
    await validatePartial({
      indexMetadata: {
        type: 'content',
        main: './'
      }
    })
  })
  t.end()
})

test('Registration - valid', async t => {
  const p2p = createDb()

  const { rawJSON: profile, metadata: profileMetadata } = await p2p.init({
    type: 'profile',
    title: 'Author'
  })

  let { rawJSON: content, metadata: contentMetadata } = await p2p.init({
    type: 'content',
    title: 'Valid content',
    authors: [encode(profile.url)]
  })

  try {
    await writeFile(join(p2p.baseDir, encode(content.url), 'main.txt'), 'hello')
  } catch (err) {
    t.fail(err.message)
  }

  ;({ rawJSON: content, metadata: contentMetadata } = await p2p.set({
    url: content.url,
    main: 'main.txt'
  }))

  await doesNotThrowAsync(t, async () => {
    await validateOnRegister({
      contentIndexMetadata: content,
      contentDbMetadata: contentMetadata,
      contentKey: encode(content.url),
      profileIndexMetadata: profile,
      profileDbMetadata: profileMetadata,
      profileKey: encode(profile.url),
      p2pcommonsDir: p2p.baseDir
    })
  })
  await p2p.destroy()

  t.end()
})

test('Registration - no main file', async t => {
  const p2p = createDb()

  const { rawJSON: profile, metadata: profileMetadata } = await p2p.init({
    type: 'profile',
    title: 'Author'
  })

  let { rawJSON: content, metadata: contentMetadata } = await p2p.init({
    type: 'content',
    title: 'No main file',
    authors: [encode(profile.url)]
  })

  try {
    await writeFile(join(p2p.baseDir, encode(content.url), 'main.txt'), 'hello')
  } catch (err) {
    t.fail(err.message)
  }

  ;({ rawJSON: content, metadata: contentMetadata } = await p2p.set({
    url: content.url,
    main: 'main.txt'
  }))

  try {
    await rename(
      join(p2p.baseDir, encode(content.url), 'main.txt'),
      join(p2p.baseDir, encode(content.url), 'main_renamed.txt')
    )
  } catch (err) {
    t.fail(err.message)
  }

  await throwsAsync(
    t,
    async () => {
      await validateOnRegister({
        contentIndexMetadata: content,
        contentDbMetadata: contentMetadata,
        contentKey: encode(content.url),
        profileIndexMetadata: profile,
        profileDbMetadata: profileMetadata,
        profileKey: encode(profile.url),
        p2pcommonsDir: p2p.baseDir
      })
    },
    /main_exists/
  )
  await p2p.destroy()

  t.end()
})

test('Only content may be registered to a profile - register profile', async t => {
  const p2p = createDb()

  const { rawJSON: profile, metadata: profileMetadata } = await p2p.init({
    type: 'profile',
    title: 'Author'
  })

  let { rawJSON: profile2, metadata: profile2Metadata } = await p2p.init({
    type: 'profile',
    title: 'Author 2',
    follows: [encode(profile.url)]
  })

  try {
    await writeFile(
      join(p2p.baseDir, encode(profile2.url), 'main.txt'),
      'hello'
    )
  } catch (err) {
    t.fail(err.message)
  }

  ;({ rawJSON: profile2, metadata: profile2Metadata } = await p2p.set({
    url: profile2.url,
    main: 'main.txt'
  }))

  await throwsAsync(
    t,
    async () => {
      await validateOnRegister({
        contentIndexMetadata: profile2,
        contentDbMetadata: profile2Metadata,
        contentKey: encode(profile2.url),
        profileIndexMetadata: profile,
        profileDbMetadata: profileMetadata,
        profileKey: encode(profile.url),
        p2pcommonsDir: p2p.baseDir
      })
    },
    /onregister_moduletype/
  )
  await p2p.destroy()

  t.end()
})

test('Authors must contain profile key upon registration - does not contain author', async t => {
  const p2p = createDb()

  const { rawJSON: profile, metadata: profileMetadata } = await p2p.init({
    type: 'profile',
    title: 'Author'
  })

  let { rawJSON: content, metadata: contentMetadata } = await p2p.init({
    type: 'content',
    title: 'Valid content'
  })

  try {
    await writeFile(join(p2p.baseDir, encode(content.url), 'main.txt'), 'hello')
  } catch (err) {
    t.fail(err.message)
  }

  ;({ rawJSON: content, metadata: contentMetadata } = await p2p.set({
    url: content.url,
    main: 'main.txt'
  }))

  await throwsAsync(
    t,
    async () => {
      await validateOnRegister({
        contentIndexMetadata: content,
        contentDbMetadata: contentMetadata,
        contentKey: encode(content.url),
        profileIndexMetadata: profile,
        profileDbMetadata: profileMetadata,
        profileKey: encode(profile.url),
        p2pcommonsDir: p2p.baseDir
      })
    },
    /onregister_authorscontainsprofilekey/
  )
  await p2p.destroy()

  t.end()
})

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

test('Validate (full) - valid', async t => {
  const p2p = createDb()

  const { rawJSON: profile } = await p2p.init({
    type: 'profile',
    title: 'Author'
  })

  let { rawJSON: content, metadata } = await p2p.init({
    type: 'content',
    title: 'Validate (full) - valid',
    authors: [encode(profile.url)]
  })
  const { host: key } = parse(content.url)

  try {
    await writeFile(join(p2p.baseDir, key, 'main.txt'), 'hello')
  } catch (err) {
    t.fail(err.message)
  }

  ;({ rawJSON: content, metadata } = await p2p.set({
    url: content.url,
    main: 'main.txt'
  }))

  await doesNotThrowAsync(t, async () => {
    await validate({
      indexMetadata: content,
      dbMetadata: metadata,
      key,
      p2pcommonsDir: p2p.baseDir
    })
  })
  await p2p.destroy()
  t.end()
})

test("Validate (full) - invalid (main file doesn't exist)", async t => {
  const p2p = createDb()

  const { rawJSON: profile } = await p2p.init({
    type: 'profile',
    title: 'Author'
  })

  let { rawJSON: content, metadata } = await p2p.init({
    type: 'content',
    title: 'Validate (full) - valid'
  })
  const { host: key } = parse(content.url)

  try {
    await writeFile(join(p2p.baseDir, key, 'main2.txt'), 'hello')
  } catch (err) {
    t.fail(err.message)
  }

  ;({ rawJSON: content, metadata } = await p2p.set({
    url: content.url,
    authors: [encode(profile.url)]
  }))

  content.main = 'main.txt'

  await throwsAsync(
    t,
    async () => {
      await validate({
        indexMetadata: content,
        dbMetadata: metadata,
        key,
        p2pcommonsDir: p2p.baseDir
      })
    },
    /main_exists/
  )
  await p2p.destroy()
  t.end()
})
