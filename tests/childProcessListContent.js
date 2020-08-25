#!/usr/bin/env node
'use strict'

const P2PCommons = require('../')

const main = async () => {
  const dir = process.argv[2]

  const commons = new P2PCommons({
    disableSwarm: true,
    persist: true,
    baseDir: dir,
    watch: false
  })

  await commons.ready()
  const list = await commons.listContent()
  console.log(list.length)
  await commons.destroy()
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
