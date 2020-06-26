const test = require('tape')
const { validate, validateOnRegister, validateOnUpdateParents, validateTitle, validateDescription, validateUrl, validateLinks } = require('../lib/validate')

test('Title - valid title', t => {
    t.doesNotThrow(() => {
        validateTitle({ title: "This is a nice title" })
    })
    t.end()
})

test('Title is required - no title', t => {
    t.throws(() => {
        validateTitle({})
    })
    t.end()
})

test('Title must be a string - is number', t => {
    t.throws(() => {
        validateTitle({ title: 5 })
    })
    t.end()
})

test('Title must be between 1 and 300 characters long - is empty', t => {
    t.throws(() => {
        validateTitle({ title: "" })
    })
    t.end()
})

test('Title must be between 1 and 300 characters long - is 301 characters', t => {
    t.throws(() => {
        validateTitle({ title: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" })
    })
    t.end()
})

test('Title may not consist of only whitespace - is a single space', t => {
    t.throws(() => {
        validateTitle({ title: " " })
    })
    t.end()
})

test('Title may not consist of only whitespace - is various whitespace characters', t => {
    t.throws(() => {
        validateTitle({ title: "    　" })
    })
    t.end()
})

test('Description - valid description', t => {
    t.doesNotThrow(() => {
        validateDescription({ description: "This is a nice description" })
    })
    t.end()
})

test('Description is required - no description', t => {
    t.throws(() => {
        validateDescription({})
    })
    t.end()
})

test('Description must be a string - is array', t => {
    t.throws(() => {
        validateDescription({ description: ["string"] })
    })
    t.end()
})

test('URL - valid url', t => {
    t.doesNotThrow(() => {
        validateUrl({ url: "hyper://RSZwR4CdKPqCd3hCVtD2H0lPCozzuYvEMtHkQkCJgvugwXW4YJCAvDwLM5inWfea" })
    })
    t.end()
})

test('URL is required - no url', t => {
    t.throws(() => {
        validateUrl({})
    })
    t.end()
})

test('URL must be a string - is object', t => {
    t.throws(() => {
        validateUrl({ url: {} })
    })
    t.end()
})

test('URL must start with hyper:// protocol - no protocol', t => {
    t.throws(() => {
        validateUrl({ url: "RSZwR4CdKPqCd3hCVtD2H0lPCozzuYvEMtHkQkCJgvugwXW4YJCAvDwLM5inWfea" })
    })
    t.end()
})

test('URL must start with hyper:// protocol - dat protocol', t => {
    t.throws(() => {
        validateUrl({ url: "dat://RSZwR4CdKPqCd3hCVtD2H0lPCozzuYvEMtHkQkCJgvugwXW4YJCAvDwLM5inWfea" })
    })
    t.end()
})

test('URL must contain a valid non-versioned Hyperdrive key - invalid key', t => {
    t.throws(() => {
        validateUrl({ url: "hyper://RSZwR4CdKPqCd3hCVtD2H0lPCozzuYvEMtHkQkCJgvugwXW4YJCAvDwLM5inWfea2" })
    })
    t.end()
})

test('URL must contain a valid non-versioned Hyperdrive key - versioned key', t => {
    t.throws(() => {
        validateUrl({ url: "hyper://RSZwR4CdKPqCd3hCVtD2H0lPCozzuYvEMtHkQkCJgvugwXW4YJCAvDwLM5inWfea+5" })
    })
    t.end()
})

test('Links - valid object', t => {
    t.doesNotThrow(() => {
        validateLinks({ links: {
            license: [{ href: "https://creativecommons.org/publicdomain/zero/1.0/legalcode" }],
            spec: [{ href: "https://p2pcommons.com/specs/module/1.0.0" }]
        }})
    })
    t.end()
})

test('Links is required - no links', t => {
    t.throws(() => {
        validateLinks({})
    })
    t.end()
})

test('Links must be an object - is string', t => {
    t.throws(() => {
        validateLinks({ links: "https://creativecommons.org/publicdomain/zero/1.0/legalcode" })
    })
    t.end()
})

test('Links must be an object with array values - has object values', t => {
    t.throws(() => {
        validateLinks({ links: {
            license: { href: "https://creativecommons.org/publicdomain/zero/1.0/legalcode" },
            spec: { href: "https://p2pcommons.com/specs/module/1.0.0" }
        }})
    })
    t.end()
})

test('License is required - no license', t => {
    t.throws(() => {
        validateLinks({ links: {
            spec: [{ href: "https://p2pcommons.com/specs/module/1.0.0" }]
        }})
    })
    t.end()
})

test('License must contain one object - multiple objects', t => {
    t.throws(() => {
        validateLinks({ links: {
            license: [
                { href: "https://creativecommons.org/publicdomain/zero/1.0/legalcode" },
                { href: "https://creativecommons.org/publicdomain/zero/1.0/legalcode" }
            ],
            spec: [{ href: "https://p2pcommons.com/specs/module/1.0.0" }]
        }})
    })
    t.end()
})

test('License must contain one object - one array', t => {
    t.throws(() => {
        validateLinks({ links: {
            license: [
                ["https://creativecommons.org/publicdomain/zero/1.0/legalcode"],
            ],
            spec: [{ href: "https://p2pcommons.com/specs/module/1.0.0" }]
        }})
    })
    t.end()
})

test('License object must have an href key - link key', t => {
    t.throws(() => {
        validateLinks({ links: {
            license: [{ link: "https://creativecommons.org/publicdomain/zero/1.0/legalcode" }],
            spec: [{ href: "https://p2pcommons.com/specs/module/1.0.0" }]
        }})
    })
    t.end()
})

test('License link must be equal to CC0 - CC4 link', t => {
    t.throws(() => {
        validateLinks({ links: {
            license: [{ href: "https://creativecommons.org/licenses/by/4.0/legalcode" }],
            spec: [{ href: "https://p2pcommons.com/specs/module/1.0.0" }]
        }})
    })
    t.end()
})

test('Spec is required - no spec', t => {
    t.throws(() => {
        validateLinks({ links: {
            license: [{ href: "https://creativecommons.org/publicdomain/zero/1.0/legalcode" }]
        }})
    })
    t.end()
})

test('Spec must contain one object - multiple objects', t => {
    t.throws(() => {
        validateLinks({ links: {
            license: [{ href: "https://creativecommons.org/publicdomain/zero/1.0/legalcode" }],
            spec: [
                { href: "https://p2pcommons.com/specs/module/1.0.0" },
                { href: "https://p2pcommons.com/specs/module/1.0.1" }
            ]
        }})
    })
    t.end()
})

test('Spec must contain one object - one array', t => {
    t.throws(() => {
        validateLinks({ links: {
            license: [{ href: "https://creativecommons.org/publicdomain/zero/1.0/legalcode" }],
            spec: ["https://p2pcommons.com/specs/module/1.0.0"]
        }})
    })
    t.end()
})

test('Spec object must have an href key - link key', t => {
    t.throws(() => {
        validateLinks({ links: {
            license: [{ href: "https://creativecommons.org/publicdomain/zero/1.0/legalcode" }],
            spec: [{ link: "https://p2pcommons.com/specs/module/1.0.0" }]
        }})
    })
    t.end()
})

test('Spec url must refer to a valid p2pcommons module spec - other link', t => {
    t.throws(() => {
        validateLinks({ links: {
            license: [{ href: "https://creativecommons.org/publicdomain/zero/1.0/legalcode" }],
            spec: [{ href: "https://notp2pcommons.fake/specs/module/1.0.0" }]
        }})
    })
    t.end()
})