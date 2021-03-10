module.exports = data => {
  if (typeof data.type === 'string') return data
  const { p2pcommons, ...rest } = data
  return { ...rest, ...p2pcommons }
}
