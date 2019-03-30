const chmodr = require('chmodr')
const Dat = require('dat-node')
const fs = require('fs-extra')
const path = require('path')
const init = require('./lib/init')
const register = require('./lib/register')
const { hashShort, hashChecker } = require('./lib/utils.js')

let LIBSCIE_DIR = process.env.LIBSCIE_DIR
console.log(LIBSCIE_DIR)

// set options
// function sets the defaults, arguments can be adjusted
// to deviate from those defaults

// clone
// version specific if specified
function clone (x) {
    let info = hashChecker(x)
    let resPath = path.join(LIBSCIE_DIR, info.key)
    if ( !isNaN(info.version) ) resPath = resPath.concat(`+${info.version}`)

    console.log(resPath)
    
    Dat(resPath, {
        key: info.key,
        sparse: false,
        temp: false
    }, (err, dat) => {
        if (err) throw err

        dat.joinNetwork((err, res) => {
            if (err) throw err

            if ( info.version ) dat.archive.checkout(info.version)
                .download()
                
            dat.leaveNetwork()
            console.log(`Replicated to ${resPath}`)
        })
    })
}

// assume it has been cloned already
// async function checkout (key, version) {
//     Dat(path.join(LIBSCIE_DIR, key), (err, dat) => {
//         if (err) throw err

//         let oldDat = dat.archive.checkout(version)

//         console.log(Object.getOwnPropertyNames(oldDat.readdir('.'));
//         return oldDat
//     })
// }


// verify module
async function verify (x) {
    let info = hashChecker(x)
    if ( !info.version ) throw 'Error: verification requires versioned module'

    let mod = await checkout(info.key, info.version)
    let modMeta = await JSON.parse(module.download('./dat.json'))
    console.log(modMeta)
    // REQ versioned module?
    // get metadata
    // REQ 'scholarly-module'
    // get authors
    // for i in authors check whether mentions module
    // iff true for all authors, then true
}

// trawl N degrees of separation from profile

// traceback from module

// compile network data

// visualize network

// export keys

// cache operations
// check size
// clean (how?)


// testing
// can't quite figure this out atm cuz async :(
init('profile', 'CHJ Hartgerink', LIBSCIE_DIR)
init('module', 'Dear Diary', LIBSCIE_DIR)

// register('c28c17ed0a8580f09b29d608b165b6d135b9bdde9decd9fcf8aa8423277ca585',
//          '52782b10068b0d48c9c04b9b8c693fffff4a3874a0d181f4f074d9095aa891dd',
//          LIBSCIE_DIR)

// clone('dat://50025da67776ab531163bf2bba5849db5e8c396dc5144a34db6e85d48f626609+2')
// clone('dat://50025da67776ab531163bf2bba5849db5e8c396dc5144a34db6e85d48f626609+4')

// verify('dat://189b440f86ca228123342b53a695de9bf1fe127014c4795da333136118c8da9f+1')
// cleanup testing

clone('dat://fcdbcb83b4f60d91592d47d7883adb50557b7b02fe8478e50e50c522db4f9903')
clone('dat://b498f694983e482ee9aaf7f03710f582fd8e366b2152517f44879c9dffa37551+10')
