#!/usr/bin/env node
'use strict'

const { join } = require('path')
const { writeFile } = require('fs').promises

const main = async () => {
  const contentUrl = process.argv[2]
  const dir = process.argv[3]
  const fileName = process.argv[4]

  // add some delay
  await new Promise(resolve => {
    setTimeout(resolve, 200)
  })

  // update main file
  await writeFile(join(dir, contentUrl, fileName), 'lorem ipsum 1 2 3...')

  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
