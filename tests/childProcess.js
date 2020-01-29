#!/usr/bin/env node
'use strict'

const P2PCommons = require('../')

;(async () => {
  const contentDat = process.argv[2]
  const dir = process.argv[3]

  const commons = new P2PCommons({
    disableSwarm: true,
    verbose: false,
    persist: true,
    baseDir: dir
  })

  await commons.ready()

  await commons.set({ url: contentDat, title: 'UPDATED' })
  const { rawJSON: updated } = await commons.get(contentDat)
  console.log({ updated })
  await commons.destroy()
})()
