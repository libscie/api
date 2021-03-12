const test = require('tape')
const { writeFile, rename } = require('fs').promises
const { validateOnRegister } = require('../lib/validate')
const {
  createDb,
  doesNotThrowAsync,
  throwsAsync
} = require('./test-validate-helpers')
const { join } = require('path')
const { encode } = require('dat-encoding')

module.exports = () => {
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
      await writeFile(
        join(p2p.baseDir, encode(content.url), 'main.txt'),
        'hello'
      )
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
      await writeFile(
        join(p2p.baseDir, encode(content.url), 'main.txt'),
        'hello'
      )
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
      await writeFile(
        join(p2p.baseDir, encode(content.url), 'main.txt'),
        'hello'
      )
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
}
