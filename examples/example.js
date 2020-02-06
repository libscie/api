const P2PCommons = require('..') // liberate science constructor function
const commons = new P2PCommons({ verbose: true })

process.once('SIGINT', () => commons.destroy())
;(async () => {
  // initializes local db first
  await commons.ready()

  // create some content
  const { rawJSON: contentMetadata1 } = await commons.init({
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

  // get and update a content module
  const key = contentMetadata1.url.toString('hex')
  const { rawJSON: out } = await commons.get(key)
  console.log(`Retrieved type: ${out.type}`)

  const title = 'Sample Content'
  const description = 'This is a short abstract about nothing'

  console.log('Updating content...')
  await commons.set({ url: key, title, description })

  // check out updated value from local db
  const { rawJSON: result } = await commons.get(key)
  console.log('Content updated:', result)

  // filter content
  const feature = 'description'
  const criteria = 'about nothing'
  const filter = await commons.filter(feature, criteria)

  console.log(`Results with ${feature}: "${criteria}"`, filter.length)

  const allContent = await commons.listContent()
  const allProfiles = await commons.listProfiles()
  console.log('Content length', allContent.length)
  console.log('Profiles length', allProfiles.length)

  const prof = allProfiles[0].rawJSON
  // publish external dat to a local profile
  const externalContentUrl = process.argv[2]
  if (externalContentUrl) {
    console.log('Publishing content...', externalContentUrl)
    await commons.publish(externalContentUrl, prof.url)
    console.log('content published successfully')
  }

  const { rawJSON: profileUpdated } = await commons.get(prof.url)
  console.log('Profile Updated', profileUpdated)
  await commons.destroy()
})()
