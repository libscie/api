const collectStream = require('stream-collector')
const assert = require('nanocustomassert')
const { ValidationError } = require('./errors')
const vers = require('./spec')

exports.hashShort = x => {
  const p = x.substr(0, 3)
  const q = x.substr(x.length - 3, x.length)
  return `${p}...${q}`
}

exports.hashChecker = x => {
  const res = {}
  x = x.split('+')
  // check for hyper://
  // doesn't crash if not present
  res.key = x[0].replace('hyper://', '')
  res.version = parseInt(x[1])

  return res
}

const _JSONencode = (value, map) =>
  JSON.stringify(value, (key, value) => {
    if (map[key]) {
      return map[key](value)
    }

    return value
  })

const _JSONdecode = (value, map) =>
  JSON.parse(value, (key, value) => {
    if (map[key]) {
      return map[key](value.data || value)
    }

    return value
  })

const JSONencode = (exports.JSONencode = obj => {
  if (typeof obj === 'string') return JSONencode(JSONdecode(obj))

  const transform = {
    url: value => Buffer.from(value).toString('hex')
  }
  return _JSONencode(obj, transform)
})

const JSONdecode = (exports.JSONdecode = str => {
  if (Buffer.isBuffer(str)) return JSONdecode(JSONencode(str))
  assert(typeof str === 'string', ValidationError, 'string', str)

  const transform = {
    url: value => {
      // looking for an hexa string of 64 or 65 consecutive chars
      var match = /([a-f0-9]{64,65})/i.exec(value)
      // we need exactly 64, so an hexa string with 65 chars (or more) is not allowed
      if (!match || match[1].length !== 64) throw new Error('Invalid key')
      return Buffer.from(match[1], 'hex')
    }
  }
  return _JSONdecode(str, transform)
})

// helper index.json object mould
exports.createIndexJSON = ({
  title,
  description,
  url,
  license = [
    {
      href: 'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
    }
  ],
  spec = [{ href: `https://p2pcommons.com/specs/module/${vers.module}` }],
  authors,
  follows,
  contents,
  parents,
  avatar,
  ...p2pcommons
}) => {
  const mould = {
    title,
    description,
    url,
    links: { license, spec },
    p2pcommons
  }
  // TODO(dk): validate links (license, spec)

  if (mould.p2pcommons.type === 'profile') {
    mould.p2pcommons.follows = follows || []
    mould.p2pcommons.contents = contents || []
    mould.p2pcommons.avatar = avatar || ''
  } else {
    mould.p2pcommons.authors = authors || []
    mould.p2pcommons.parents = parents || []
  }

  return mould
}

exports.collect = (index, opts) => {
  return new Promise((resolve, reject) => {
    collectStream(index.createReadStream(opts), (err, list) => {
      if (err) return reject(err)
      return resolve(list)
    })
  })
}
