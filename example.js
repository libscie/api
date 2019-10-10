const P2PCommons = require('.') // liberate science constructor function
const commons = P2PCommons({ disableSwarm: true })

process.once('SIGINT', () => commons.destroy())
;(async () => {
  await commons.ready() // initializes local db
  await commons.init({ type: 'content' }) // ~/.p2pcommons/hash/dat.json --> type: content
  await commons.init({ type: 'profile' }) // ~/.p2pcommons/hash/dat.json --> type: profile
})()
