const Dat = require('dat-node')
const fs = require('fs-extra')
const path = require('path')

module.exports = { init,
                   readCache,
                   buildCache,
                   reg
                 }

////////////////////////////////////////////////////////////////////////////////

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

async function init (type, env, title, description) {
    let datJSON = initSkel(type, title, description)
    
    let tmp = path.join(env,
                        `tmp${Math.random().toString().replace('\.', '')}`)
    
    await fs.ensureDir(tmp)
    let dat = await Dat(tmp)
    let hash = dat.key.toString('hex')
    datJSON.url = `dat://${hash}`

    await fs.writeFile(path.join(tmp, 'dat.json'),
                       JSON.stringify(datJSON))
    await dat.importFiles('dat.json')
    await fs.rename(
        tmp,
        path.join(env, hash))
    console.log(`Initialized new ${type}, dat://${hash}`)

    cache(hash, env)

    return datJSON

    // add auto cache?
}

////////////////////////////////////////////////////////////////////////////////

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

async function writeCache (obj, env) {
    await fs.writeFile(path.join(env, 'cache.json'),
                     JSON.stringify(obj))
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
    // ensure env exists
    // init cache obj
    let cached = []
    // get all hash based dirs
    let dirs = cacheDirs(env)
    // for each dir
    for ( dir in dirs ) {
        // need to factor this out and use cache()
        let obj = {}
        // read metadata
        let meta = fs.readFileSync(path.join(dirs[dir], 'dat.json')).toString()
        let metaP = JSON.parse(meta)
        // Promises not yet implemented in dat-node
        // https://github.com/datproject/dat-node/issues/221
        // https://github.com/datproject/dat-node/issues/236
        let dat = await Dat(dirs[dir])

        obj.title = metaP.title
        obj.hash = metaP.url.replace('dat://', '')
        obj.type = metaP.type
        obj.isOwner = dat.writable
        // obj.version 
        // obj.verified = false
        // obj.shared = false
        // obj.registered = false

        cached.push(obj)
    }

    await writeCache(cached, env)

    console.log(`Built cache database from ${dirs.length} modules`)
}

// cache a single hash
async function cache (hash, env) {
    let cache = await readCache(env)
    let dat = await Dat(path.join(env, hash))
    // check if already exists
    let index = cache.indexOf(cac => cac.hash === hash)
    if ( index === -1 ) {                  
        let obj = await readMeta(hash, env)
        obj.isOwner = dat.writable
        cache.push(obj)
    } else {
        // maybe add a check for double cached items?
        let obj = cache[index]
        obj.isOwner = dat.writable
        cache[index] = obj
    }

    // obj.version = dat.archive.version
    // obj.verified
    // need to implement verify() first
    // obj.shared
    // 
    // obj.registered
    // replace cached obj
    await writeCache(cache, env)
}


////////////////////////////////////////////////////////////////////////////////

// register
async function reg (register, registerTo, env) {
    let dat = await Dat(path.join(env, register))
    let datV = dat.archive.version
    let regV = `dat://${register}+${datV}`

    // create a version specific copy in env (READ ONLY)
    // read dat.json of registerTo
    let regTo = await readMeta(registerTo, env)
    if ( !regTo.modules.includes(regV) ) {
        regTo.modules.push(regV)
        await writeMeta(registerTo, regTo, env)
        // update cache
        await cache(registerTo, env)

        console.log(`Registered ${regV} to ${registerTo}`)
    } else {
        console.log(`Already registered!`)
    }
}

////////////////////////////////////////////////////////////////////////////////

// utils

async function readMeta (hash, env) {
    let file = path.join(env, hash, 'dat.json')
    let meta = fs.readFileSync(file)

    return JSON.parse(meta)
}

async function writeMeta (hash, obj, env) {
    fs.writeFileSync(path.join(env, hash, 'dat.json'),
                     JSON.stringify(obj))
}
