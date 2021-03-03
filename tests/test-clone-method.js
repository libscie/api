const tempy = require('tempy')
const { encode } = require('dat-encoding')
const {
  writeFile,
  readdir,
  stat,
  copyFile,
  existsSync
} = require('fs').promises
const { join } = require('path')
const test = require('tape')
const once = require('events.once')
const SDK = require('./..')

module.exports = async dht => {
  test('clone a module (auto download main file)', async t => {
    const dir = tempy.directory()
    const dir2 = tempy.directory()

    const p2p = new SDK({
      baseDir: dir,
      bootstrap: dht
    })

    const p2p2 = new SDK({
      baseDir: dir2,
      bootstrap: dht
    })

    await p2p2.ready()

    const content = {
      type: 'content',
      title: 'test'
    }

    const { rawJSON } = await p2p.init(content)
    const rawJSONpath = encode(rawJSON.url)

    // write main.txt
    await writeFile(join(dir, rawJSONpath, 'main.txt'), 'hello')
    const fileStat = await stat(join(dir, `${rawJSONpath}`, 'main.txt'))
    await p2p.set({
      url: rawJSON.url,
      main: 'main.txt'
    })

    const { rawJSON: module } = await p2p2.clone(rawJSON.url)

    t.same(module.title, content.title)

    const clonedFileStat = await stat(
      join(p2p2.baseDir, `${rawJSONpath}`, 'main.txt')
    )
    t.same(clonedFileStat.size, fileStat.size, 'size should be equal')
    const clonedDir = await readdir(join(p2p2.baseDir, `${rawJSONpath}`))
    t.ok(
      clonedDir.includes('main.txt'),
      'clone downloaded content successfully'
    )

    await p2p.destroy()
    await p2p2.destroy()
    t.end()
  })

  test.skip('clone a module (using download handle to wait for download complete of module content, not main)', async t => {
    const dir = tempy.directory()
    const dir2 = tempy.directory()

    const p2p = new SDK({
      baseDir: dir,
      bootstrap: dht
    })

    const p2p2 = new SDK({
      baseDir: dir2,
      bootstrap: dht
    })

    await p2p2.ready()

    const content = {
      type: 'content',
      title: 'test'
    }

    const { rawJSON } = await p2p.init(content)
    const rawJSONpath = encode(rawJSON.url)

    // write main.txt
    const filePath = join(dir, rawJSONpath, 'main.txt')
    await writeFile(filePath, 'hello')

    const { rawJSON: module, dlHandle } = await p2p2.clone(rawJSON.url)

    t.same(module.title, content.title)

    let target
    while (([target] = await once(dlHandle, 'put-end'))) {
      if (target && target.name && target.name.includes('main.txt')) {
        break
      }
    }

    const clonedDir = await readdir(join(p2p2.baseDir, `${rawJSONpath}`))
    t.ok(
      clonedDir.includes('main.txt'),
      'clone downloaded content successfully'
    )

    await p2p.destroy()
    await p2p2.destroy()
    t.end()
  })

  // NOTE(deka): revisit this one
  test.skip('resume download clone', async t => {
    const dir = tempy.directory()
    const dir2 = tempy.directory()

    const p2p = new SDK({
      baseDir: dir,
      bootstrap: dht
    })

    const p2p2 = new SDK({
      baseDir: dir2,
      bootstrap: dht
    })

    await p2p2.ready()

    const content = {
      type: 'content',
      title: 'test'
    }

    const { rawJSON } = await p2p.init(content)
    const keyString = encode(rawJSON.url)

    const fileStat = await stat('./tests/testfile.bin')
    const fileSize = fileStat.size

    // write some file into the module folder
    await copyFile('./tests/testfile.bin', join(dir, keyString, 'testfile.bin'))

    await once(p2p, 'drive-updated')
    // await p2p.addFiles(keyString, './tests/testfile.bin')

    await p2p2.clone(rawJSON.url)

    await p2p2.destroy()

    await new Promise(resolve => setTimeout(resolve, 10))

    // re-start p2p2
    const p2p3 = new SDK({
      baseDir: dir2,
      bootstrap: dht
    })

    // Note(deka): check that download-resume is emitted for key === keyString
    await p2p3.ready()

    // await once(p2p3, 'download-drive-completed')

    const { rawJSON: module } = await p2p3.get(rawJSON.url)

    t.same(module.title, content.title)

    await once(p2p3, 'download-resume-completed')

    // validate file size on disk
    const clonedFileSize = await stat(join(dir2, keyString, 'testfile.bin'))

    t.ok(clonedFileSize.size >= fileSize, 'cloned file size is OK')

    const clonedDir = await readdir(join(p2p3.baseDir, `${keyString}`))

    t.ok(
      clonedDir.includes('testfile.bin'),
      'clone downloaded content successfully'
    )

    await p2p.destroy()
    await p2p3.destroy()
    t.end()
  })

  test('clone a module (multiple calls)', async t => {
    const dir = tempy.directory()
    const dir2 = tempy.directory()

    const p2p = new SDK({
      baseDir: dir,
      bootstrap: dht
    })

    const p2p2 = new SDK({
      baseDir: dir2,
      bootstrap: dht
    })

    await p2p2.ready()

    const content = {
      type: 'content',
      title: 'test'
    }

    const { rawJSON } = await p2p.init(content)
    const rawJSONpath = encode(rawJSON.url)

    // write some files
    const filePath = join(dir, rawJSONpath, 'main.txt')
    await writeFile(filePath, 'hello')

    await p2p.addFiles(rawJSON.url, [filePath, './tests/testfile.bin'])

    const { rawJSON: module, dlInfo } = await p2p2.clone(rawJSON.url)

    if (!dlInfo.complete) {
      dlInfo.resume()
      await once(p2p2, 'download-drive-completed')
    }
    t.same(module.title, content.title)

    const clonedDir = await readdir(join(p2p2.baseDir, rawJSONpath))
    t.ok(
      clonedDir.includes('main.txt'),
      'clone downloaded content successfully'
    )
    t.ok(
      clonedDir.includes('testfile.bin'),
      'clone downloaded content successfully'
    )

    // multiple clone calls
    const { rawJSON: module2 } = await p2p2.clone(rawJSON.url)

    t.ok(
      JSON.stringify(module2) === JSON.stringify(module),
      'clone should return the same value'
    )

    const { rawJSON: module3 } = await p2p2.clone(rawJSON.url)
    t.ok(
      JSON.stringify(module3) === JSON.stringify(module),
      'clone should return the same value'
    )

    await p2p.destroy()
    await p2p2.destroy()
    t.end()
  })

  test.skip('cloned versioned module directory is readonly', async t => {
    const dir = tempy.directory()
    const dir2 = tempy.directory()

    const p2p = new SDK({
      baseDir: dir,
      bootstrap: dht
    })

    const p2p2 = new SDK({
      baseDir: dir2,
      bootstrap: dht
    })

    await p2p2.ready()

    const content = {
      type: 'content',
      title: 'test'
    }

    const { rawJSON } = await p2p.init(content)
    const rawJSONKey = encode(rawJSON.url)

    // write main.txt
    await writeFile(join(dir, rawJSONKey, 'main.txt'), 'hello')

    await p2p.set({
      url: rawJSON.url,
      main: 'main.txt'
    })

    const {
      metadata: { version }
    } = await p2p.get(rawJSON.url)

    const { rawJSON: module } = await p2p2.clone(rawJSONKey, version)

    t.same(module.title, content.title)
    const externalContentPath = join(p2p2.baseDir, `${rawJSONKey}+${version}`)

    await once(p2p2, 'module-readonly')

    const st = await stat(externalContentPath)
    const permString = st.mode & 0o777

    // NOTE(dk): here we are comparing against 0555 (read and exec) and 0444 (pure read only)
    // because on windows exec permissions bits are sometimes lost.
    // See more here: https://github.com/nodejs/node/issues/9380
    if (permString === 0o555 || permString === 0o444) {
      t.pass('cloned module is not writable')
    } else {
      t.fail('cloned module is writable')
    }

    const clonedDir = await readdir(externalContentPath)
    t.ok(
      clonedDir.includes('main.txt'),
      'clone downloaded content successfully'
    )

    await p2p.destroy()
    await p2p2.destroy()
    t.end()
  })

  test.skip('cancel clone', async t => {
    const dir = tempy.directory()
    const dir2 = tempy.directory()

    const p2p = new SDK({
      disableSwarm: false,
      persist: true,
      baseDir: dir,
      bootstrap: dht
    })

    const p2p2 = new SDK({
      disableSwarm: false,
      persist: true,
      baseDir: dir2,
      bootstrap: dht
    })

    const content = {
      type: 'content',
      title: 'test'
    }

    const { rawJSON } = await p2p.init(content)
    const rawJSONpath = rawJSON.url.replace('hyper://', '')

    // write main.txt
    await writeFile(join(dir, rawJSONpath, 'main.txt'), 'hello')

    // clone can be canceled
    const cloning = p2p2.clone(rawJSON.url)
    setImmediate(() => {
      cloning.cancel()
      t.ok(cloning.isCanceled, 'cloning promise is canceled')
    })
    const clonedDir = existsSync(join(p2p2.baseDir, rawJSONpath))
    t.notOk(clonedDir, 'clone dir does not exists')

    await p2p.destroy()
    await p2p2.destroy()

    t.end()
  })

  test('clone updates localdb', async t => {
    const dir = tempy.directory()
    const dir2 = tempy.directory()

    const p2p = new SDK({
      baseDir: dir,
      dht
    })

    const p2p2 = new SDK({
      baseDir: dir2,
      dht
    })

    const profile = {
      type: 'profile',
      title: 'professor'
    }

    const { rawJSON } = await p2p.init(profile)

    // clone
    const { rawJSON: module1 } = await p2p2.clone(rawJSON.url)

    t.same(module1.title, profile.title, '1 st clone works OK (title)')
    t.same(module1.description, '', '1 st clone works OK (empty description)')

    // update original profile
    const description = 'some description'
    await p2p.set({ url: rawJSON.url, description })

    // be notified about updates
    let updatedProfile = await p2p2.get(rawJSON.url)
    if (updatedProfile.description !== description) {
      setImmediate(async () => {
        ;[updatedProfile] = await once(p2p2, 'update-profile')

        if (updatedProfile.description === description) {
          t.pass('2nd clone works OK, localdb is updated')
        } else {
          t.fail('profile does not match')
        }
      })
    }

    await p2p.destroy()
    await p2p2.destroy()
    t.end()
  })
}
