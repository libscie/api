const fs = require('fs')
const Dat = require('dat-node')
const path = require('path')
const { hashChecker } = require('./utils.js')

module.exports = clone

async function clone (x, env) {
    let info = hashChecker(x)
    let resPath = path.join(env, info.key)
    // if ( !isNaN(info.version) ) resPath = resPath.concat(`+${info.version}`)
    Dat(resPath, {
        key: info.key,
        sparse: false,
        temp: false
    }, (err, dat) => {
        if (err) throw err

        dat.joinNetwork((err, res) => {
            if (err) throw err

            dat.leaveNetwork()
            console.log(`Replicated to ${resPath}`)
        })
    })
}
