const Dat = require('dat-node')
const fs = require('fs')
const path = require('path')

// get environment variable
let LIBSCIE_DIR = process.env.LIBSCIE
// create the environment directory if not available


// create profile
	// create Dat (without sharing)
	// create scholarly profile
	// move to environment

// create module

// share profile/module

// register module to profile
// save a checked out version of the module
// put the versioned link in the profile

const Dat = require('dat-node')
const path = require('path')

// clone module (clean)
function clone (hash) {
    Dat(path.join(process.env.LIBSCIE_DIR, hash), {
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
