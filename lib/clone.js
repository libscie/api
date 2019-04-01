const Dat = require('dat-node')
const path = require('path')
const { hashChecker } = require('./lib/utils.js')

function clone (x) {
    let info = hashChecker(x)
    let resPath = path.join(LIBSCIE_DIR, info.key)
    // if ( !isNaN(info.version) ) resPath = resPath.concat(`+${info.version}`)
    Dat(resPath, {
        key: info.key,
        sparse: false,
        temp: false
    }, (err, dat) => {
        if (err) throw err

        dat.joinNetwork((err, res) => {
            if (err) throw err

            // if ( info.version ) {

            //     dat.archive.checkout(info.version)
            //         .readFile('/dat.json', 'utf-8', (err, subres) => {
            //             if (err) throw err

            //             console.log(subres)
            //         })
            // }

            dat.leaveNetwork()
            console.log(`Replicated to ${resPath}`)
        })
    })
}
