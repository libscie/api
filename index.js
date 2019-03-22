const Dat = require('dat-node')
const fs = require('fs')
const path = require('path')
const init = require('./lib/init')

let LIBSCIE_DIR = process.env.LIBSCIE_DIR
console.log(LIBSCIE_DIR)

// share profile/module

// register module to profile
function register (reg, dest, env) {
    // check whether reg is a module
    // check whether reg isOwned
    // check whether dest is a profile
    // check whether dest isOwned

    // checkout Dat version to new folder
    // do some checks on the module
    // write versioned url to profile
    // make sure version is shared on the network?
}
// save a checked out version of the module
// put the versioned link in the profile

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

console.log(init('profile', 'CHJ Hartgerink', LIBSCIE_DIR))
