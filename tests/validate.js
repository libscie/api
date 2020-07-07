const test = require('tape')
const tempy = require('tempy')
const { promises: { writeFile } } = require('fs')
const { join } = require('path')
const { validate, validateOnRegister, validateOnUpdateParents, validateTitle, validateDescription, validateUrl, validateLinks, validateP2pcommons, validateType, validateSubtype, validateMain, validateMainExists, validateAvatar, validateAuthors, validateParents, validateParentsRegistered, validateFollows, validateContents } = require('../lib/validate')
const SDK = require('../')

const defaultOpts = () => ({
    swarm: false,
    persist: false,
    watch: false
})
  
const createDb = opts => {
    const finalOpts = { ...defaultOpts(), ...opts }
    return new SDK({
        disableSwarm: !finalOpts.swarm,
        persist: finalOpts.persist,
        swarm: finalOpts.swarmFn,
        baseDir: tempy.directory()
    })
}

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

test('p2pcommons - valid object', t => {
    t.doesNotThrow(() => {
        validateP2pcommons({ 
            p2pcommons: {
                "type": "content",
                "subtype": "",
                "main": "test-content.html",
                "authors": [
                    "cca6eb69a3ad6104ca31b9fee7832d74068db16ef2169eaaab5b48096e128342",
                    "f7daadc2d624df738abbccc9955714d94cef656406f2a850bfc499c2080627d4"
                ],
                "parents": [
                    "f0abcd6b1c4fc524e2d48da043b3d8399b96d9374d6606fca51182ee230b6b59+12",
                    "527f404aa77756b91cba4e3ba9fe30f72ee3eb5eef0f4da87172745f9389d1e5+4032"
                ]
            }
        })
    })
    t.end()
})

test('p2pcommons is required - no p2pcommons', t => {
    t.throws(() => {
        validateP2pcommons({})
    })
    t.end()
})

test('p2pcommons must be an object - is array', t => {
    t.throws(() => {
        validateP2pcommons({ 
            p2pcommons: [{
                "type": "content",
                "subtype": "",
                "main": "test-content.html",
                "authors": [
                    "cca6eb69a3ad6104ca31b9fee7832d74068db16ef2169eaaab5b48096e128342",
                    "f7daadc2d624df738abbccc9955714d94cef656406f2a850bfc499c2080627d4"
                ],
                "parents": [
                    "f0abcd6b1c4fc524e2d48da043b3d8399b96d9374d6606fca51182ee230b6b59+12",
                    "527f404aa77756b91cba4e3ba9fe30f72ee3eb5eef0f4da87172745f9389d1e5+4032"
                ]
            }]
        })
    })
    t.end()
})

test('Type - valid type', t => {
    t.doesNotThrow(() => {
        validateType({ 
            p2pcommons: { 
                type: "content"
            }
        })
    })
    t.end()
})

test('Type is required - no type', t => {
    t.throws(() => {
        validateType({
            p2pcommons: { 
                subtype: "Q123"
            }
        })
    })
    t.end()
})

test('Type must be a string - is number', t => {
    t.throws(() => {
        validateType({
            p2pcommons: { 
                type: 1
            }
        })
    })
    t.end()
})

test('Type must be equal to \'profile\' or \'content\' - other value', t => {
    t.throws(() => {
        validateType({
            p2pcommons: { 
                type: "Q123"
            }
        })
    })
    t.end()
})

test('Subtype - valid subtype', t => {
    t.doesNotThrow(() => {
        validateSubtype({ 
            p2pcommons: { 
                subtype: "Q123"
            }
        })
    })
    t.end()
})

test('Subtype - empty subtype', t => {
    t.doesNotThrow(() => {
        validateSubtype({ 
            p2pcommons: { 
                subtype: ""
            }
        })
    })
    t.end()
})

test('Subtype is required - no type', t => {
    t.throws(() => {
        validateSubtype({
            p2pcommons: { 
                type: "content"
            }
        })
    })
    t.end()
})

test('Subtype must be a string - is number', t => {
    t.throws(() => {
        validateSubtype({
            p2pcommons: { 
                subtype: 123
            }
        })
    })
    t.end()
})

test('Subtype may only include standard alphanumeric characters - contains spaces', t => {
    t.throws(() => {
        validateSubtype({
            p2pcommons: { 
                subtype: "Literature review"
            }
        })
    })
    t.end()
})

test('Main - valid main', t => {
    t.doesNotThrow(() => {
        validateMain({ 
            p2pcommons: { 
                main: "folder1/test-content.html"
            }
        })
    })
    t.end()
})

test('Main - empty main', t => {
    t.doesNotThrow(() => {
        validateMain({ 
            p2pcommons: { 
                main: ""
            }
        })
    })
    t.end()
})

test('Main is required - no main', t => {
    t.throws(() => {
        validateMain({
            p2pcommons: {}
        })
    })
    t.end()
})

test('Main must be a string - is number', t => {
    t.throws(() => {
        validateMain({
            p2pcommons: { 
                main: 123
            }
        })
    })
    t.end()
})

test('Main may only contain a relative path within the module - URL', t => {
    t.throws(() => {
        validateMain({
            p2pcommons: { 
                main: "https://www.lovelywebsite.com/lovelyfile.html"
            }
        })
    })
    t.end()
})

test('Main may only contain a relative path within the module - windows absolute path', t => {
    t.throws(() => {
        validateMain({
            p2pcommons: { 
                main: "C:\lovelyfile.html"
            }
        })
    })
    t.end()
})

test('Main may only contain a relative path within the module - mac absolute path', t => {
    t.throws(() => {
        validateMain({
            p2pcommons: { 
                main: "/home/user/module/lovelyfile.html"
            }
        })
    })
    t.end()
})

test('Main may only contain a relative path within the module - relative path outside module', t => {
    t.throws(() => {
        validateMain({
            p2pcommons: { 
                main: "../lovelyfile.html"
            }
        })
    })
    t.end()
})

test('Main file must exist upon registration - exists', async t => {
    const p2p = createDb()
    const { rawJSON: content } = await p2p.init({
        type: "content",
        title: "Test main file - exists"
    })
    await p2p.set({
        url: content.url
    })

    try {
        await writeFile(join(p2p.baseDir, content.url.substring(8), 'main.txt'), 'hello')
    } catch(err) {
        console.log(err)
    }

    t.doesNotThrow(() => {
        validateMainExists({
            p2pcommons: { 
                main: "main.txt"
            }
        })
    })
    t.end()
})