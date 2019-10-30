const P2PCommons = require('.') // liberate science constructor function
const commons = new P2PCommons({ disableSwarm: true, verbose: true })

process.once('SIGINT', () => commons.destroy())
;(async () => {
  // initializes local db first
  await commons.ready()

  // create some content
  const contentMetadata1 = await commons.init({
    type: 'content',
    title: 'intro to lorem ipsum'
  }) // ~/.p2pcommons/hash/dat.json --> type: content
  await commons.init({
    type: 'content',
    title: 'Sample Content 2',
    description: 'lorem ipsum alfa beta'
  })
  await commons.init({
    type: 'content',
    title: 'Reference content',
    description: 'lorem ipsum'
  })

  // create a profile
  await commons.init({ type: 'profile', title: 'Professor X' }) // ~/.p2pcommons/hash/dat.json --> type: profile
  const key = contentMetadata1.url.toString('hex')
  const out = await commons.get(key)
  console.log(`Retrieved type: ${out.type}`)

  const title = 'Sample Content'
  const description = 'This is a short abstract about nothing'

  console.log('Updating content...')
  await commons.set({ url: key, title, description })

  // check out updated value from local db
  const result = await commons.get(key)
  console.log('Content updated:', result)

  // filter content
  const feature = 'description'
  const criteria = 'about nothing'
  const filter = await commons.filter(feature, criteria)

  console.log(`Results with ${feature}: ${criteria}`, filter.length)

  const allContent = await commons.listContent()
  const allProfiles = await commons.listProfiles()
  console.log('Content length', allContent.length)
  console.log('Profiles length', allProfiles.length)
})()
