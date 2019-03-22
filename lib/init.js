const Dat = require('dat-node')
const fs = require('fs')
const path = require('path')

module.exports = init

// function to init module/profile with bare minimum
// only requires title and type
// does not share on the Dat network yet
function init (type, title, env) {
    // create skeleton metadata file
    let datJSON = initSkel(type)
    // init dat in folder (don't share yet)
    Dat(path.join(env, 'tmp'), (err, dat) => {
        if (err) throw err

        let hash = dat.key.toString('hex')
        datJSON.url = `dat://${hash}`
        datJSON.title = title

        // write pretty JSON to file? TODO
        fs.writeFile(path.join(env, 'tmp', 'dat.json'), JSON.stringify(datJSON),
                     (err) => {
                         if (err) throw err                             

                         dat.importFiles('dat.json')

                         fs.rename(path.join(env, 'tmp'),
                                   path.join(env, hash),
                                   (err) => {
                                       if (err) throw err

                                       console.log(`Initialized new ${type}, dat://${hash}`)

                                       return datJSON
                                   })
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
