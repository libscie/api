#!/usr/bin/env node
'use strict'

const SDK = require('../')

const main = async () => {
  const contentDat = process.argv[2]
  const dir = process.argv[3]

  const p2p = new SDK({
    disableSwarm: true,
    persist: true,
    baseDir: dir,
    watch: false
  })

  await p2p.ready()
  await p2p.set({ url: contentDat, title: 'UPDATED' })
  await p2p.destroy()
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
