const assert = require('assert')
const path = require('path')
const hyperdrive = require('hyperdrive-promise')

const createDatJSON = (type, title, description) => {
  const obj = {}

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
    throw new Error('Wrongly specified init type (ExAPIx0001).')
  }

  return obj
}

class SDK {
  constructor ({ type, title = '', description = '' }) {
    assert.ok(typeof type === 'string', 'type is required')
    assert.ok(type === 'profile' || type === 'content', "type should be 'content' or 'profile'")
    this.datJSON = createDatJSON(type, title, description)
  }

  async init () {
    const tmp = path.join(env, `tmp${Math.random().toString().replace('\.', '')}`)

    await fs.ensureDir(tmp)
    this.dat = await DatHelper(tmp)

    const hash = dat.key.toString('hex')
    datJSON.url = `dat://${hash}`

    await fs.writeFile(path.join(tmp, 'dat.json'),
      JSON.stringify(datJSON))
    await dat.importFiles('dat.json')
    await fs.rename(
      tmp,
      path.join(env, hash))
    console.log(`Initialized new ${type}, dat://${utils.hashShort(hash)}`)

    cache(hash, env)

    return datJSON
  }
}

module.exports = (...args) => new SDK(...args)
