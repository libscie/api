#!/usr/bin/env node
'use strict'

const P2PCommons = require('../')

const main = async () => {
  const dir = process.argv[2]

  const commons = new P2PCommons({
    disableSwarm: true,
    persist: true,
    baseDir: dir,
    watch: true
  })

  await commons.ready()

  await commons.init({
    type: 'profile',
    title: 'title'
  })

  await commons.destroy()
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
