const customError = require('nanoerror')

exports.InvalidKeyError = customError('InvalidKeyError', 'Invalid key: %s')

exports.ValidationError = customError(
  'ValidationError',
  'Expected: %s - Received: %s'
)

exports.MissingParam = customError('MissingParam', 'Missing parameter: %s')
