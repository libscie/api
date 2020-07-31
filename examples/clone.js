const P2PCommons = require('..') // liberate science constructor function
const tempy = require('tempy')
const commons = new P2PCommons({
  verbose: true,
  persist: false
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
  const { rawJSON } = await commons.clone(externalContentUrl, version, false)
  console.timeEnd('clone')
  console.log({ rawJSON })
  await commons.destroy()
})()
