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
// currently assumes it's cloned already?
async function verify (x) {
    let info = hashChecker(x)
    if ( !info.version ) throw 'Error: verification requires versioned module'
    let checkPath = path.join(LIBSCIE_DIR, info.key)
    // let mod = await checkout(info.key, info.version)
    let modRaw = await fs.readFile(path.join(checkPath, 'dat.json'), 'utf-8')
    let modMeta = await JSON.parse(modRaw)
    // REQ versioned module?
    // get metadata
    // REQ 'scholarly-module'
    // get authors
    // for i in authors check whether mentions module
    // iff true for all authors, then true
}

// trawl N degrees of separation from profile

// traceback from module
// regardless whether it's profile or module

// compile network data

// visualize network

// export keys

// cache operations
// check size
// clean (how?)

