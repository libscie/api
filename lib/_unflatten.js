module.exports = data => {
  if (typeof data.p2pcommons === 'object') return data
  const { title, description, url, links, ...p2pcommons } = data
  return { title, description, url, links, p2pcommons }
}
