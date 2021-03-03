const test = require('tape')
const createSdk = require('./utils/create-sdk')
const SDK = require('./..')

module.exports = () => {
  test('follow: must not self-reference', async t => {
    const p2p = createSdk()

    t.plan(1)

    const sampleProfile = {
      type: 'profile',
      title: 'professorX',
      subtype: '',
      avatar: './test.png',
      follows: [
        'f7daadc2d624df738abbccc9955714d94cef656406f2a850bfc499c2080627d4'
      ],
      contents: [
        '00a4f2f18bb6cb4e9ba7c2c047c8560d34047457500e415d535de0526c6b4f23+12'
      ]
    }

    const { rawJSON: profile } = await p2p.init(sampleProfile)

    try {
      await p2p.follow(profile.url, profile.url)
    } catch (err) {
      t.ok(
        err instanceof SDK.errors.ValidationError,
        'should throw when tries to self-reference'
      )
    }

    await p2p.destroy()
    t.end()
  })
}
