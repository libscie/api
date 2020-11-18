const P2PCommons = require('..') // liberate science constructor function
const tempy = require('tempy')
const commons = new P2PCommons({
  verbose: true,
  baseDir: tempy.directory()
})

process.once('SIGINT', () => commons.destroy())
;(async () => {
  console.time('ready')
  await commons.ready()
  console.timeEnd('ready')

  const externalContentUrl = process.argv[2]
  const version = process.argv[3]
  if (!externalContentUrl) {
    throw new Error('missing arg: external module url')
  }
  console.time('clone')
  const { rawJSON } = await commons.clone(externalContentUrl, version)
  console.timeEnd('clone')
  console.log({ rawJSON })
  console.log({ baseDir: commons.baseDir })
  await commons.destroy()
})()
