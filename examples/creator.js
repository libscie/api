const P2PCommons = require('..') // liberate science constructor function
const tempy = require('tempy')
const commons = new P2PCommons({ baseDir: tempy.directory(), verbose: true })

process.once('SIGINT', () => commons.destroy())
;(async () => {
  await commons.ready()
  // create some content
  const { rawJSON } = await commons.init({
    type: 'content',
    title: 'Cool 101',
    description: 'All the cool content you want to know',
    main: 'file.txt'
  })

  await commons.set({
    url: rawJSON.url,
    description: 'All the cool content you want to know and more!!!'
  })
  const { metadata: last } = await commons.get(rawJSON.url)

  console.log({ metadata: last })
  console.log({ rawJSON })
  console.log('P2PCommons swarming listening...')

  commons.destroy(true, false)
})()
