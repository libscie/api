const libsdk = require('.')({ disableSwarm: true }) // liberate science constructor function

process.once('SIGINT', () => libsdk.destroy())
;(async () => {
  await libsdk.init({ type: 'content' }) // ~/.p2pcommons/hash/dat.json --> type: content
  await libsdk.init({ type: 'profile' }) // ~/.p2pcommons/hash/dat.json --> type: profile
})()
