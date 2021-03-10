module.exports = (type, val) => {
  return type.isValid(val, { errorHook })

  function errorHook (path, any, type) {
    let msg = `${path.join('.')}`
    if (type.typeName === 'record') {
      if (any !== null && typeof any === 'object') {
        const declared = new Set(type.fields.map(f => f.name))
        const extra = Object.keys(any).filter(n => !declared.has(n))
        msg = `extra fields (${extra.join(', ')})`
        throw new TypeError(msg, extra.join(', '))
      } else {
        msg += `not an object: ${any}`
        throw new Error(msg)
      }
    }
    throw new TypeError(type.name ? type.name : type._logicalTypeName, any, msg)
  }
}
