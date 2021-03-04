const test = require('tape')
const tempy = require('tempy')
const { writeFile, readdir } = require('fs').promises
const { encode } = require('dat-encoding')
const { join } = require('path')
const SDK = require('./..')

module.exports = () => {
  test('delete a module from local db', async t => {
    const dir = tempy.directory()
    const p2p = new SDK({
      disableSwarm: true,
      watch: false,
      baseDir: dir
    })

    const modules = await p2p.list()
    t.equal(modules.length, 0, 'Modules list is empty')
    // create content
    const { rawJSON: content } = await p2p.init({
      type: 'content',
      title: 'demo',
      description: 'lorem ipsum'
    })

    const { rawJSON: content2 } = await p2p.init({
      type: 'content',
      title: 'demo 2',
      description: 'lorem ipsum 2'
    })

    const modules2 = await p2p.list()
    t.equal(modules2.length, 2, 'Modules list contains 2 elements')
    // soft delete content
    await p2p.delete(content.url)

    const modules3 = await p2p.list()
    t.equal(modules3.length, 1, 'Modules list contains 1 element')

    // hard delete
    await p2p.delete(content2.url, true)
    const baseDir = await readdir(join(p2p.baseDir))

    t.notok(
      baseDir.includes(encode(content2.url)),
      'Module folder has been removed'
    )

    const modules4 = await p2p.list()
    t.equal(modules4.length, 0, 'Modules list is empty again')
    await p2p.destroy()
    t.end()
  })

  test('delete versioned module', async t => {
    const dir = tempy.directory()
    const p2p = new SDK({
      disableSwarm: true,
      watch: false,
      baseDir: dir
    })

    const modules = await p2p.list()
    t.equal(modules.length, 0, 'Modules list is empty')

    // create content
    const { rawJSON: content } = await p2p.init({
      type: 'content',
      title: 'demo',
      description: 'lorem ipsum'
    })

    const { rawJSON: profile } = await p2p.init({
      type: 'profile',
      title: 'professor X',
      description: 'd'
    })

    const contentModules = await p2p.listContent()
    t.equal(contentModules.length, 1, '1 content module exists')

    // register
    const authors = [encode(profile.url)]
    // manually writing a dummy file
    await writeFile(join(dir, encode(content.url), 'file.txt'), 'hola mundo')

    const { metadata } = await p2p.set({
      url: content.url,
      authors,
      main: 'file.txt'
    })

    const moduleVersioned = `${encode(content.url)}+${metadata.version}`
    try {
      await p2p.register(moduleVersioned, encode(profile.url))
    } catch (err) {
      t.fail(err.message)
    }
    const { rawJSON: updatedProfile } = await p2p.get(profile.url)
    t.same(updatedProfile.contents.length, 1, 'content registered')

    // hard delete
    try {
      await p2p.delete(moduleVersioned, true)
      t.fail('versioned keys should throw')
    } catch (err) {
      t.ok(
        err.code === 'only_unversioned',
        'only unversioned keys can be deleted'
      )
    }

    const baseDir = await readdir(join(p2p.baseDir))

    const contentModulesFinal = await p2p.listContent()
    t.equal(contentModulesFinal.length, 1, 'content list remains the same')

    t.ok(
      baseDir.includes(moduleVersioned),
      'Module folder has not been removed (deleteFiles)'
    )

    await p2p.destroy()
    t.end()
  })
}
