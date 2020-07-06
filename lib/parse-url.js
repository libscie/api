const urlParse = require('url-parse')
const hexTo32 = require('hex-to-32')

const BASE_32_KEY_LENGTH = 52

/**
 * parse a dat url
 * code based on https://github.com/RangerMauve/dat-archive-web/blob/main/DatArchive.js#L469
 *
 * @param {string} url
 * @returns {{
 *   host: string,
 *   version: number
 * }}
 */
const parse = url => {
  let host = null
  let version = null

  if (url) {
    if (
      !url.startsWith('dat://') &&
      !url.startsWith('http://') &&
      !url.startsWith('https://')
    ) {
      url = `dat://${url}`
    }
    const parsed = urlParse(url)
    let hostname = null
    const isDat = parsed.protocol.indexOf('dat') === 0
    const isUndefined = parsed.protocol.indexOf('undefined') === 0
    if (isDat || isUndefined) {
      const hostnameParts = parsed.hostname.split('+')
      hostname = hostnameParts[0]
      version = hostnameParts[1] || null
    } else {
      const hostnameParts = parsed.hostname.split('.')
      const subdomain = hostnameParts[0]
      if (subdomain.length === BASE_32_KEY_LENGTH) {
        hostname = hexTo32.decode(subdomain)
      } else {
        hostname = parsed.hostname
      }
    }
    host = hostname
  }

  return {
    host,
    version
  }
}

module.exports = parse
