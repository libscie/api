#!/usr/bin/env node
'use strict'

const P2PCommons = require('../')

const main = async () => {
  const contentDat = process.argv[2]
  const dir = process.argv[3]

  const commons = new P2PCommons({
    disableSwarm: true,
    persist: true,
    baseDir: dir
  })

  await commons.ready()
  await commons.set({ url: contentDat, title: 'UPDATED' })
  await commons.destroy()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
