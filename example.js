const P2PCommons = require('.') // liberate science constructor function
const commons = P2PCommons({ disableSwarm: true })

process.once('SIGINT', () => commons.destroy())
;(async () => {
  // initializes local db first
  await commons.ready()

  // create some content
  const contentMetadata1 = await commons.init({ type: 'content' }) // ~/.p2pcommons/hash/dat.json --> type: content
  const contentMetadata2 = await commons.init({
    type: 'content',
    title: 'Sample Content 2',
    description: 'lorem ipsum alfa beta'
  }) // ~/.p2pcommons/hash/dat.json --> type: content
  const contentMetadata3 = await commons.init({
    type: 'content',
    title: 'Reference content',
    description: 'lorem ipsum'
  }) // ~/.p2pcommons/hash/dat.json --> type: content

  // create a profile
  await commons.init({ type: 'profile' }) // ~/.p2pcommons/hash/dat.json --> type: profile
  const key = contentMetadata1.url.toString('hex')
  const out = await commons.get('content', key)
  console.log(`Retrieved type: ${out.type}`)
  out.title = 'Sample Content'
  out.description = 'This is a short abstract about nothing'
  console.log('Updating content...')
  await commons.set(out)

  // check out updated value from local db
  const result = await commons.get('content', key)
  console.log('Content updated', result)

  // filter content
  const criteria = 'abstract about nothing'
  const feature = 'description'
  const filter = await commons.filter(feature, criteria)
  console.log(`Results with ${feature}: ${criteria}`, filter.length)

  const allContent = await commons.allContent()
  const allProfiles = await commons.allProfiles()
  console.log('Content length', allContent.length)
  console.log('Profiles length', allProfiles.length)
})()
