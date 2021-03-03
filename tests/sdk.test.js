const { EventEmitter } = require('events')
const level = require('level')
const proxyquire = require('proxyquire')
const mirror = require('mirror-folder')
const test = require('tape')
const tempy = require('tempy')
const { join } = require('path')
const execa = require('execa')
const once = require('events.once')
const { encode } = require('dat-encoding')
const { writeFile } = require('fs').promises
const createSdk = require('./utils/create-sdk')
const SDK = require('./..')

test('sdk ready', async t => {
  const p2p = createSdk()
  t.doesNotThrow(async () => {
    await p2p.ready()
    await p2p.destroy()
  }, 'ready method should not throw')
  t.end()
})

test('sdk emit warning', async t => {
  class EBUSYMock extends Error {
    constructor (message) {
      super(message)
      this.code = 'EBUSY'
    }
  }

  const mockDat = {
    './lib/dat-helper.js': {
      importFiles: async (drive, src, opts) => {
        const finalOpts = { ...opts, watch: false }
        await new Promise((resolve, reject) => {
          mirror(src, { name: '/', fs: drive }, finalOpts, err => {
            if (err) {
              return reject(err)
            }
            return resolve()
          })
        })

        const ee = new EventEmitter()

        ee.destroy = () => {}
        setTimeout(() => {
          ee.emit('error', new EBUSYMock('EBUSY mock error'))
        }, 1000)
        return ee
      }
    }
  }

  const SDK = proxyquire('../', mockDat)

  const p2p = new SDK({
    disableSwarm: true,
    baseDir: tempy.directory()
  })
  await p2p.ready()

  const contentData = {
    type: 'content',
    subtype: 'Theory',
    title: 'demo'
  }
  const { rawJSON } = await p2p.init(contentData)

  const [warn] = await once(p2p, 'warn')

  t.ok(
    warn instanceof SDK.errors.EBUSYError,
    'emits expected warning with EBUSYError'
  )
  t.same(rawJSON.title, contentData.title)
  t.same(rawJSON.type, contentData.type)
  t.same(rawJSON.subtype, contentData.subtype)
  await p2p.destroy()
  t.end()
})

test('sdk re-open (child process)', async t => {
  const dir = tempy.directory()

  const commons = new SDK({
    disableSwarm: true,
    watch: false,
    persist: true,
    baseDir: dir
  })

  await commons.ready()

  // create content
  const { rawJSON: contentDat } = await commons.init({
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum'
  })

  await commons.destroy()

  // another sdk instance will update the content
  const code = join(__dirname, 'childProcess.js')
  const { stderr, message, exitCode } = await execa.node(code, [
    contentDat.url,
    dir
  ])

  if (exitCode !== 0) {
    console.log(message)
    t.fail(stderr)
  }

  const commons2 = new SDK({
    disableSwarm: true,
    watch: false,
    persist: true,
    baseDir: dir
  })

  await commons2.ready()

  // finally we check everything is updated correctly
  const { rawJSON: updated } = await commons2.get(contentDat.url)

  t.equal(updated.title, 'UPDATED')
  await commons2.destroy()
  t.end()
})

test('multiple sdks with child process', async t => {
  const dir = tempy.directory()
  const code = join(__dirname, 'childProcess2.js')

  const { stderr: err1, message: m1, exitCode: exit1 } = await execa.node(
    code,
    [dir]
  )

  if (exit1 !== 0) {
    console.log(m1)
    t.fail(err1)
  }

  const { stderr: err2, message: m2, exitCode: exit2 } = await execa.node(
    code,
    [dir]
  )

  if (exit2) {
    console.log(m2)
    t.fail(err2)
  }

  t.pass('all good')
  t.end()
})

test('sdk leveldb open error', async t => {
  const dir = tempy.directory()
  const db = level(`${dir}/db`)
  await db.open()
  const commons = new SDK({
    disableSwarm: true,
    watch: false,
    persist: true,
    baseDir: dir
  })

  let err
  try {
    await commons.ready()
  } catch (_err) {
    err = _err
  }
  t.ok(err)

  t.end()
})

test('check lastModified on ready (refreshMTimes)', async t => {
  const dir = tempy.directory()

  const p2p = new SDK({
    disableSwarm: true,
    baseDir: dir
  })

  const profileData = {
    type: 'profile',
    title: 'Professor X'
  }
  const contentData = {
    type: 'content',
    title: 'test',
    description: 'sample content'
  }

  const { rawJSON: content, metadata: cMetadataInitial } = await p2p.init(
    contentData
  )

  await p2p.init(profileData)

  const contentPath = encode(content.url)

  // write main.txt
  await writeFile(join(dir, contentPath, 'main.txt'), 'hello')
  await p2p.refreshDrive(contentPath)

  await writeFile(join(dir, contentPath, 'main2.txt'), 'hello 2')
  await p2p.set({ url: content.url, main: 'main.txt' })
  const { rawJSON, metadata: cMetadataUpdate } = await p2p.get(content.url)

  t.ok(
    cMetadataInitial.lastModified.getTime() <
      cMetadataUpdate.lastModified.getTime(),
    'content metadata lastModified is updated'
  )
  await p2p.destroy()

  await new Promise(resolve => {
    setTimeout(() => {
      return resolve()
    }, 100)
  })
  // update main.txt while sdk is off...
  await writeFile(join(dir, contentPath, 'main.txt'), 'hello world')
  rawJSON.description = 'what is this??'
  await writeFile(join(dir, contentPath, 'index.json'), JSON.stringify(rawJSON))

  await new Promise(resolve => {
    setTimeout(() => {
      return resolve()
    }, 200)
  })

  const p2p2 = new SDK({
    disableSwarm: true,
    baseDir: dir
  })

  const { rawJSON: final, metadata: cMetadataFinal } = await p2p2.get(
    content.url
  )

  const all = await p2p2.list()

  t.same(all.length, 2, 'total number of modules is 2')
  t.same(final.description, 'what is this??', 'content is updated accordingly')

  t.ok(
    cMetadataFinal.lastModified.getTime() >
      cMetadataUpdate.lastModified.getTime(),
    'latest content metadata (lastModified) should be bigger than previous one (offline update)'
  )

  await p2p2.destroy()
  t.end()
})

test('edit content outside SDK, while SDK is running', async t => {
  const dir = tempy.directory()

  const commons = new SDK({
    disableSwarm: true,
    baseDir: dir
  })

  // create content
  const { rawJSON: contentDat } = await commons.init({
    type: 'content',
    title: 'demo',
    description: 'lorem ipsum'
  })
  // manually writing a file
  await writeFile(
    join(commons.baseDir, encode(contentDat.url), 'file.txt'),
    'hola mundo'
  )
  // set main file
  const { metadata: metadataInitial } = await commons.set({
    url: contentDat.url,
    main: 'file.txt'
  })

  // edit content externally
  const code = join(__dirname, 'childProcessEdit.js')
  const { stderr, message, exitCode } = await execa.node(code, [
    encode(contentDat.url),
    dir,
    'file.txt'
  ])

  if (exitCode !== 0) {
    console.log(message)
    t.fail(stderr)
  }

  // sync manually
  await commons.refreshDrive(contentDat.url)

  // finally we check everything is updated correctly
  const { metadata: metadataFinal } = await commons.get(contentDat.url)

  if (metadataFinal.version > metadataInitial.version) {
    t.pass('latest metadata version is bigger than initial')
  } else {
    if (
      metadataFinal.lastModified.getTime() >
      metadataInitial.lastModified.getTime()
    ) {
      t.pass('latest metadata lastModified is newer than initial metadata')
    } else {
      t.fail('metadata did not update correctly')
    }
  }
  await commons.destroy()
  t.end()
})

test('sdk multiple writes with persistance', async t => {
  try {
    const dir = tempy.directory()

    const p2p1 = new SDK({
      disableSwarm: true,
      watch: false,
      baseDir: dir
    })

    const { rawJSON } = await p2p1.init({ type: 'content', title: 'title' })
    t.same(typeof rawJSON.url, 'string')
    await p2p1.destroy()

    // create a new instance with same basedir
    const p2p2 = new SDK({
      watch: false,
      disableSwarm: true,
      baseDir: dir
    })

    await p2p2.set({ url: rawJSON.url, title: 'beep' })
    await p2p2.set({ url: rawJSON.url, description: 'boop' })
    const { rawJSON: updated } = await p2p2.get(rawJSON.url)

    t.same(updated.title, 'beep')
    t.same(updated.description, 'boop')
    await p2p2.destroy()

    t.end()
  } catch (err) {
    t.fail(err)
  }
})
