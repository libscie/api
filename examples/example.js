const P2PCommons = require('..') // liberate science constructor function
const commons = new P2PCommons({ verbose: true, persist: false })

process.once('SIGINT', () => commons.destroy())
;(async () => {
  // initializes local db first
  await commons.ready()

  // create some content
  const { rawJSON: contentMetadata1 } = await commons.init({
    type: 'content',
    title: 'intro to lorem ipsum'
  }) // ~/.p2pcommons/hash/index.json --> type: content

  // create a profile
  const { rawJSON: prof } = await commons.init({
    type: 'profile',
    title: 'Professor X'
  }) // ~/.p2pcommons/hash/index.json --> type: profile

  const externalContentUrl = process.argv[2]
  if (externalContentUrl) {
    console.log('Registering content...', externalContentUrl)
    await commons.register(externalContentUrl, prof.url)
    console.log('content registered successfully')
  }

  const { rawJSON: profileUpdated } = await commons.get(prof.url)
  console.log('Profile Updated', profileUpdated)
  await commons.destroy()
})()
