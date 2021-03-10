const { ValidationError } = require('./errors')

module.exports = (path, any, type) => {
  throw new ValidationError(
    `Valid Metadata: ${type}`,
    `${any} (${typeof any})`,
    path.join()
  )
}
