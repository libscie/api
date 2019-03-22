const chmodr = require('chmodr')
const Dat = require('dat-node')
const fs = require('fs-extra')
const path = require('path')
const init = require('./lib/init')
const register = require('./lib/register')

let LIBSCIE_DIR = process.env.LIBSCIE_DIR
console.log(LIBSCIE_DIR)

// share profile/module

// clone module (clean)
function clone (hash) {
    Dat(path.join(LIBSCIE_DIR, hash), {
        key: hash
    }, (err, dat) => {
        if (err) throw err

        dat.joinNetwork((err, res) => {
            if (err) throw err

            dat.leaveNetwork()
            console.log('Finished replicating dat://' + hash)
        })
    })
}

// verify module

// trawl N degrees of separation from profile

// traceback from module

// compile network data

// visualize network

// export keys

// clean cache


// testing
// can't quite figure this out atm cuz async :(
init('profile', 'CHJ Hartgerink', LIBSCIE_DIR)
init('module', 'Dear Diary', LIBSCIE_DIR)

register('c28c17ed0a8580f09b29d608b165b6d135b9bdde9decd9fcf8aa8423277ca585',
         '52782b10068b0d48c9c04b9b8c693fffff4a3874a0d181f4f074d9095aa891dd',
         LIBSCIE_DIR)

// register('',
//          '',
//          LIBSCIE_DIR)

// cleanup testing
