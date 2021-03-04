#!/usr/bin/env node
'use strict'

const SDK = require('../')

const main = async () => {
  const dir = process.argv[2]

  const p2p = new SDK({
    disableSwarm: true,
    baseDir: dir
  })

  await p2p.ready()
  const list = await p2p.listContent()
  console.log(list.length)
  await p2p.destroy()
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
