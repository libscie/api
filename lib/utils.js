
exports.hashShort = function (x) {
    let p = x.substr(0, 3)
    let q = x.substr(x.length - 3, x.length)
    return `${p}...${q}`
}

exports.hashChecker = function (x) {
    let res = {}
    x = x.split('+')
    // check for dat://
    // doesn't crash if not present
    res.key = x[0].replace('dat://', '')
    res.version = parseInt(x[1])

    return res
}
// hashChecker('dat://123+2')
// hashChecker('123+2')
// hashChecker('dat://123')
// hashChecker('123')
