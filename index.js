const Dat = require('dat-node')
const fs = require('fs-extra')
const path = require('path')

module.exports = { init,
                   readCache,
                   buildCache
                 }

// init
function initSkel (type, title, description) {
    let obj = {}

    obj.title = title
    obj.description = description
    obj.url = ''
    obj.parents = []
    obj.roots = []
    obj.main = ''

    if (type === 'profile') {
        obj.type = 'profile'
        obj.follows = []
        obj.modules = []
    } else if (type === 'module') {
        obj.type = 'module'
        obj.authors = []
    } else {
        throw 'Wrongly specified init type (ExAPIx0001).'
    }

    return obj
}

function init (type, env, title, description) {
    let datJSON = initSkel(type, title, description)
    
    let tmp = path.join(env,
                        `tmp${Math.random().toString().replace('\.', '')}`)
    
    fs.ensureDir(tmp, err => {
        Dat(tmp, (err, dat) => {
            if (err) throw err

            let hash = dat.key.toString('hex')
            datJSON.url = `dat://${hash}`

            fs.writeFile(path.join(tmp, 'dat.json'),
                         JSON.stringify(datJSON),
                         (err) => {
                             if (err) throw err                             

                             dat.importFiles('dat.json')

                             fs.rename(
                                 tmp,
                                 path.join(env, hash),
                                 (err) => {
                                     if (err) throw err

                                     console.log(
                                         `Initialized new ${type}, dat://${hash}`
                                     )

                                     return datJSON
                                 })
                         })
        })
    })
    // add auto-cache addition
}

async function cache (env, dir, overwrite = false) {
    // if overwrite = false
    // check if already in cache.json
    // if so, end function
    // if not (or overwrite = true)
    // read metadata
    let meta = await fs.readFile(path.join(env, dir, 'dat.json')).toString()
    let metaP = JSON.parse(meta)
    // create object
    obj = []
    obj.hash = metaP.url.replace('dat://', '')
    obj.type = metaP.type

    // append/replace to/in cache.json
}

// cache
// readCache returns parsed cache if exists
async function readCache (env) {
    let cached = []
    // check if cache exists
    if ( fs.existsSync(path.join(env, 'cache.json')) ) {
        let cache = await fs.readFile(path.join(env, 'cache.json'))
        cached = JSON.parse(cache.toString())
    } else {
        // write out empty cache file
        await fs.writeFile(path.join(env, 'cache.json'),
                           JSON.stringify(cached))
    }

    return cached
}

function cacheDirs (env) {
    // TODO implement async
    const isDirectory = env => fs.lstatSync(env).isDirectory()
    const getDirs = fs.readdirSync(env).map(name => path.join(env, name)).filter(isDirectory)
    let regexp = new RegExp(/\w{64}(\+\d+)?$/)
    let obj = getDirs.filter(val => {
        return regexp.test(val)
    })
    
    return obj
}


// this one starts from scratch ALWAYS
async function buildCache (env) {
    // init cache obj
    let cached = []
    // get all hash based dirs
    let dirs = cacheDirs(env)
    // for each dir
    for ( dir in dirs ) {
        // define object to store things in
        let obj = {}
        // read metadata
        let meta = fs.readFileSync(path.join(dirs[dir], 'dat.json')).toString()
        let metaP = JSON.parse(meta)
        // Promises not yet implemented in dat-node
        // https://github.com/datproject/dat-node/issues/221
        // https://github.com/datproject/dat-node/issues/236
        // let isOwner = await Dat(dirs[dir], (err,
        
        obj.title = metaP.title
        obj.hash = metaP.url.replace('dat://', '')
        obj.type = metaP.type
        // obj.version 
        // obj.verified = false
        // obj.shared = false
        // obj.registered = false

        cached.push(obj)
    }

    // write away cache
    fs.writeFileSync(path.join(env, 'cache.json'),
                     JSON.stringify(cached))

    console.log(`Built cache database from ${dirs.length} modules`)
}

async function cacheRefresh (env) {}

// update
async function update (hash, env) {
    
}


// register

