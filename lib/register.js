const Dat = require('dat-node')
const fs = require('fs-extra')
const path = require('path')
const chmodr = require('chmodr')

module.exports = register

// register module to profile
// does not itself connect to Datwork
// reg + dest need to be just hash
function register (reg, dest, env) {
    fs.readFile(path.join(env, dest, 'dat.json'), (err, res) => {
        if (err) throw err
        let profMeta = JSON.parse(res)
        if (!profMeta.type === 'scholarly-profile') throw 'Not a profile'

        // make sure profile is theirs
        Dat(path.join(env, dest), (err, prof) => {
            if (err) throw err
            if (!prof.writable) throw 'Error: non-writable profile'
        })
        
        // module operations
        Dat(path.join(env, reg), (err, mod) => {
            if (err) throw err
            // add warning if !mod.writable TODO

            let regURL = `dat://${mod.key.toString('hex')}+${mod.version}`
            let regFolder = path.join(env, reg + `+${mod.version}`)
            fs.copy(path.join(env, reg), regFolder, (err) => {
                if (err) throw err

                // chmod 444
                chmodr(regFolder, 0o444, (err) => {
                    console.log('Created read-only copy of registered module')
                })
            })

            console.log('this happens')
            // add versioned url to profile and write away
            profMeta.modules.push(regURL)
            fs.writeFile(path.join(env, dest, 'dat.json'),
                         JSON.stringify(profMeta), (err) => {
                             if (err) throw err

                             console.log(`${mod.version} registered.`)
                         })
        })


    })
}
