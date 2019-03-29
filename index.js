const chmodr = require('chmodr')
const Dat = require('dat-node')
const fs = require('fs-extra')
const path = require('path')
const init = require('./lib/init')
const register = require('./lib/register')

let LIBSCIE_DIR = process.env.LIBSCIE_DIR
console.log(LIBSCIE_DIR)

// set options
// function sets the defaults, arguments can be adjusted
// to deviate from those defaults

function hashShort (x) {
    let p = x.substr(0, 3)
    let q = x.substr(x.length - 3, x.length)
    return `${p}...${q}`
}

function hashChecker (x) {
    let res = {}
    x = x.split('+')
    // check for dat://
    // doesn't crash if not present
    res.key = x[0].replace('dat://', '')
    res.version = parseInt(x[1])

    return res
}
// hashChecker('dat://123+2')
// hashChecker('123+2')
// hashChecker('dat://123')
// hashChecker('123')

function clone (x) {
    let info = hashChecker(x)
    // check whether dat already cached! TODO
    Dat(path.join(LIBSCIE_DIR, info.key),
        { key: info.key,
          sparse: false,
          temp: false
        }, (err, dat) => {
            if (err) throw err
            
            dat.joinNetwork((err, res) => {
                if (err) throw err

                dat.leaveNetwork()
                console.log(`Finished replicating dat://${hashShort(info.key)}`)
            })
        })
}

function checkout (x) {
    let info = hashChecker(x)

    Dat(path.join(LIBSCIE_DIR, info.key), (err, dat) => {
        if (err) throw err
        
        let oldDat = dat.archive.checkout(info.version)
        
        oldDat.readdir('./', {cached:true}, (err, res) => {
            if (err) throw err

            console.log(res)
        })
        
        return oldDat
    })
}


// verify module
function verify (module) {
    let info = hashChecker(module)
    if ( !info.version ) {
        throw 'Error: verification requires versioned module'
    }

    Dat(path.join(LIBSCIE_DIR, info.key),
        { key: info.key,
          sparse: false,
          temp: false
        }, (err, dat) => {
            if (err) throw err

            dat.joinNetwork((err, res) => {
                if (err) throw err

                res.archive.checkout(info.version)
            })
        })
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

clone('dat://50025da67776ab531163bf2bba5849db5e8c396dc5144a34db6e85d48f626609+2')
clone('dat://50025da67776ab531163bf2bba5849db5e8c396dc5144a34db6e85d48f626609+4')

// register('',
//          '',
//          LIBSCIE_DIR)

// cleanup testing
