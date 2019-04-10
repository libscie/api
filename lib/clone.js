const fs = require('fs')
const Dat = require('dat-node')
const path = require('path')
const ram = require('random-access-memory')
const hyperdrive = require('hyperdrive')
const discovery = require('hyperdiscovery')
const mirror = require('mirror-folder')
const mkdirp = require('mkdirp')
const { hashChecker } = require('./utils.js')

module.exports = clone

async function clone (x, env) {
    let info = hashChecker(x)
    let resPath = path.join(env, info.key)
    if ( !isNaN(info.version) ) resPath = resPath.concat(`+${info.version}`)

    mkdirp.sync(resPath)

    const archive = hyperdrive(ram, info.key)

    archive.ready((err) => {
        if (err) throw err

        const swarm = discovery(archive)
        swarm.on('connection', (peer, type) => {
            console.log(`Connected to peer ${type.type}`)
        })
    })

    archive.on('content', () => {
        console.log('Archive’s content is ready.')
        console.log('Starting to mirror…')
        const progress = mirror(
            { name: '/',
              fs: archive.checkout(info.version)
            }, resPath, (err) => {
                if (err) throw err

                console.log(`Cloned to ${resPath}`)
            })
        progress.on('put', (source) => {
            console.log(`  Mirrored: ${source.name}`)
        })
        progress.on('skip', (source) => {
            console.log(`  Skipped:  ${source.name}`)
        })
    })
}
