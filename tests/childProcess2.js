#!/usr/bin/env node
'use strict'

const SDK = require('../')

const main = async () => {
  const dir = process.argv[2]

  const p2p = new SDK({
    disableSwarm: true,
    persist: true,
    baseDir: dir
  })

  await p2p.init({
    type: 'profile',
    title: 'title'
  })

  await p2p.destroy()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
