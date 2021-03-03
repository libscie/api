const test = require('tape')
const createSdk = require('./utils/create-sdk')

module.exports = () => {
  test('get: retrieve a value from the sdk', async t => {
    const p2p = createSdk()
    const sampleData = {
      type: 'profile',
      title: 'demo',
      description: 'lorem ipsum'
    }
    const { rawJSON: init } = await p2p.init(sampleData)
    const key = init.url

    const { rawJSON: get } = await p2p.get(key)

    t.deepLooseEqual(get, init)
    await p2p.destroy()
    t.end()
  })
}
