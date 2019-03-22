const Dat = require('dat-node')
const fs = require('fs')
const path = require('path')

let LIBSCIE_DIR = process.env.LIBSCIE
// create the environment directory if not available

function init (type) {
    // create skeleton metadata file
    let datJSON = initSkel(type)
    datJSON.title = title
    datJSON.description = desc
    // put metadata in folder
    // create tmp folder if not existent
    // init dat in folder (don't share yet)
    Dat(path.join(LIBSCIE_DIR, 'tmp'), (err, dat) => {
        if (err) throw err

        dat.importFiles()
        dat.key.toString('hex')
        // rename folder to hash
        fs.rename(path.join(LIBSCIE_DIR, 'tmp'),
                  path.join(LIBSCIE_DIR, hash), (err) => {
                      if (err) throw err
                  })
    })
}

// init skeleton for dat.json
// no more than that
function initSkel (type) {
    let jsonSkel = {}

    jsonSkel.title = ''
    jsonSkel.description = ''
    jsonSkel.url = '' // need to preprocess this
    jsonSkel.parents = []
    jsonSkel.roots = []
    jsonSkel.main = ''

    if (type === 'profile') {
        jsonSkel = initProfile(jsonSkel)
    } else if (type === 'module') {
        jsonSkel = initModule(jsonSkel)
    } else {
        throw "Something went wrong. Error code 001."
    }

    return jsonSkel
}

// add profile skeleton
function initProfile (obj) {
    obj.type = "scholarly-profile"
    obj.follows= []
    obj.modules= []

    return obj
}


// add module skeleton
function initModule (obj) {
    obj.type= "scholarly-module",
    obj.authors= []

    return obj
}

// create module

// share profile/module

// register module to profile
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

console.log(initSkel('profile'))
console.log(initSkel('module'))
