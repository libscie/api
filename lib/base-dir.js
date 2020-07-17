const { join, isAbsolute } = require('path')
const { homedir, tmpdir } = require('os')

const baseDir = (baseDir = '.p2pcommons') => {
    // NOTE(dk): consider switch to envPaths usage
    const home =
      process.env.HOME ||
      homedir() ||
      tmpdir()
    return isAbsolute(baseDir)
      ? baseDir
      : join(home, baseDir)
}

module.exports = baseDir