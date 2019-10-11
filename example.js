const P2PCommons = require('.') // liberate science constructor function
const commons = P2PCommons({ disableSwarm: true })

process.once('SIGINT', () => commons.destroy())
;(async () => {
  await commons.ready() // initializes local db
  const contentMetadata = await commons.init({ type: 'content' }) // ~/.p2pcommons/hash/dat.json --> type: content
  await commons.init({ type: 'profile' }) // ~/.p2pcommons/hash/dat.json --> type: profile
  const contentHash = contentMetadata.url.toString('hex')
  const out = await commons.get(contentHash)
  console.log(`Retrieved type: ${out.type}`)
  out.title = 'Sample Content!'
  console.log('Updating content...')
  await commons.set(contentHash, out)
  // check out updated value from local db
  const result = await commons.get(contentHash)
  console.log('Content updated', result)
})()
