const test = require('tape')
const tempy = require('tempy')
const { promises: { writeFile } } = require('fs')
const { join } = require('path')
const { validate, validateOnRegister, validateOnUpdateParents, validateTitle, validateDescription, validateUrl, validateLinks, validateP2pcommons, validateType, validateSubtype, validateMain, validateMainExists, validateAvatar, validateAuthors, validateParents, validateParentsRegistered, validateFollows, validateContents } = require('../lib/validate')
const SDK = require('../')
const { ValidationError } = require('../lib/errors')
const { createCipher } = require('crypto')

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

test('Title - valid', t => {
    t.doesNotThrow(() => {
        validateTitle({ title: "This is a nice title" })
    })
    t.end()
})

test('Title is required - missing', t => {
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

test('URL - valid', t => {
    t.doesNotThrow(() => {
        validateUrl({ url: "hyper://RSZwR4CdKPqCd3hCVtD2H0lPCozzuYvEMtHkQkCJgvugwXW4YJCAvDwLM5inWfea" })
    })
    t.end()
})

test('URL is required - missing', t => {
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

test('Links - valid', t => {
    t.doesNotThrow(() => {
        validateLinks({ links: {
            license: [{ href: "https://creativecommons.org/publicdomain/zero/1.0/legalcode" }],
            spec: [{ href: "https://p2pcommons.com/specs/module/1.0.0" }]
        }})
    })
    t.end()
})

test('Links is required - missing', t => {
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

test('License is required - missing', t => {
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

test('Spec is required - missing', t => {
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

test('p2pcommons - valid', t => {
    t.doesNotThrow(() => {
        validateP2pcommons({
            url: "dat://4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f",
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

test('p2pcommons is required - missing', t => {
    t.throws(() => {
        validateP2pcommons({})
    })
    t.end()
})

test('p2pcommons must be an object - is array', t => {
    t.throws(() => {
        validateP2pcommons({
            url: "dat://4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f",
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

test('Type - valid', t => {
    t.doesNotThrow(() => {
        validateType({ 
            p2pcommons: { 
                type: "content"
            }
        })
    })
    t.end()
})

test('Type is required - missing', t => {
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

test('Subtype - valid', t => {
    t.doesNotThrow(() => {
        validateSubtype({ 
            p2pcommons: { 
                subtype: "Q123"
            }
        })
    })
    t.end()
})

test('Subtype - empty', t => {
    t.doesNotThrow(() => {
        validateSubtype({ 
            p2pcommons: { 
                subtype: ""
            }
        })
    })
    t.end()
})

test('Subtype is required - missing', t => {
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

test('Main - valid', t => {
    t.doesNotThrow(() => {
        validateMain({ 
            p2pcommons: { 
                main: "folder1/test-content.html"
            }
        })
    })
    t.end()
})

test('Main - empty', t => {
    t.doesNotThrow(() => {
        validateMain({ 
            p2pcommons: { 
                main: ""
            }
        })
    })
    t.end()
})

test('Main is required - missing', t => {
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

test('Main file must exist upon registration - empty', t => {
    t.throws(() => {
        validateMainExists({
            url: content.url,
            p2pcommons: { 
                main: ""
            }
        }, p2p.baseDir)
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
        await writeFile(join(p2p.baseDir, content.url.replace("dat://", ""), 'main.txt'), 'hello')
    } catch(err) {
        console.log(err)
    }

    t.doesNotThrow(() => {
        validateMainExists({
            url: content.url,
            p2pcommons: { 
                main: "main.txt"
            }
        }, p2p.baseDir)
    })
    await p2p.destroy()
    t.end()
})

test('Main file must exist upon registration - does not exist', async t => {
    const p2p = createDb()
    const { rawJSON: content } = await p2p.init({
        type: "content",
        title: "Test main file - exists"
    })

    await p2p.set({
        url: content.url
    })

    try {
        await writeFile(join(p2p.baseDir, content.url.replace("dat://", ""), 'main2.txt'), 'hello')
    } catch(err) {
        console.log(err)
    }

    t.throws(() => {
        try {
            validateMainExists({
                url: content.url,
                p2pcommons: { 
                    main: "main.txt"
                }
            }, p2p.baseDir)
        } catch (err) {
            throw new Error(err)
        }
    })
    await p2p.destroy()
    t.end()
})

test('Avatar - valid', t => {
    t.doesNotThrow(() => {
        validateAvatar({
            p2pcommons: {
                type: "profile",
                avatar: "avatar.png"
            }
        })
    })
    t.end()
})

test('Avatar - empty', t => {
    t.doesNotThrow(() => {
        validateAvatar({
            p2pcommons: {
                type: "profile",
                avatar: ""
            }
        })
    })
    t.end()
})

test('Avatar - missing', t => {
    t.doesNotThrow(() => {
        validateAvatar({
            p2pcommons: {
                type: "profile"
            }
        })
    })
    t.end()
})

test('Avatar may only exist for profiles - is content', t => {
    t.throws(() => {
        validateAvatar({
            p2pcommons: {
                type: "content",
                avatar: "avatar.png"
            }
        })
    })
    t.end()
})

test('Avatar must be a string - is array', t => {
    t.throws(() => {
        validateAvatar({
            p2pcommons: {
                type: "profile",
                avatar: ["avatar.png", "images/profilepic.jpg"]
            }
        })
    })
    t.end()
})

test('Avatar may only contain a relative path within the module - URL', t => {
    t.throws(() => {
        validateAvatar({
            p2pcommons: {
                type: "profile",
                avatar: "https://www.lovelywebsite.com/avatar.png"
            }
        })
    })
    t.end()
})

test('Avatar may only contain a relative path within the module - windows absolute path', t => {
    t.throws(() => {
        validateAvatar({
            p2pcommons: {
                type: "profile",
                avatar: "C:\avatar.png"
            }
        })
    })
    t.end()
})

test('Avatar may only contain a relative path within the module - mac absolute path', t => {
    t.throws(() => {
        validateAvatar({
            p2pcommons: {
                type: "profile",
                avatar: "/home/user/module/avatar.png"
            }
        })
    })
    t.end()
})

test('Avatar may only contain a relative path within the module - relative path outside module', t => {
    t.throws(() => {
        validateAvatar({
            p2pcommons: {
                type: "profile",
                avatar: "../avatar.png"
            }
        })
    })
    t.end()
})

test('Authors - valid', t => {
    t.doesNotThrow(() => {
        validateAuthors({
            p2pcommons: {
                type: "content",
                authors: [
                    "4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f",
                    "8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8"
                ]
            }
        })
    })
    t.end()
})

test('Authors is only required for content - missing for profile', t => {
    t.doesNotThrow(() => {
        validateAuthors({
            p2pcommons: {
                type: "profile"
            }
        })
    })
    t.end()
})

test('Authors is required for content - missing', t => {
    t.throws(() => {
        validateAuthors({
            p2pcommons: {
                type: "content"
            }
        })
    })
    t.end()
})

test('Authors may only exist for content - exists for profile', t => {
    t.throws(() => {
        validateAuthors({
            p2pcommons: {
                type: "profile",
                authors: [
                    "4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f",
                    "8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8"
                ]
            }
        })
    })
    t.end()
})

test('Authors must be an array - is string', t => {
    t.throws(() => {
        validateAuthors({
            p2pcommons: {
                type: "content",
                authors: "8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8"
            }
        })
    })
    t.end()
})

test('Authors must be unique - contains duplicates', t => {
    t.throws(() => {
        validateAuthors({
            p2pcommons: {
                type: "content",
                authors: [
                    "4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f",
                    "8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8",
                    "8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8"
                ]
            }
        })
    })
    t.end()
})

test('Authors may only contain non-versioned Hyperdrive keys - contains versioned keys', t => {
    t.throws(() => {
        validateAuthors({
            p2pcommons: {
                type: "content",
                authors: [
                    "4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f",
                    "8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8+5"
                ]
            }
        })
    })
    t.end()
})

test('Authors may only contain non-versioned Hyperdrive keys - contains names', t => {
    t.throws(() => {
        validateAuthors({
            p2pcommons: {
                type: "content",
                authors: [
                    "4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f",
                    "James Lomas"
                ]
            }
        })
    })
    t.end()
})

test('Parents - valid', t => {
    t.doesNotThrow(() => {
        validateParents({
            url: "dat://4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f",
            p2pcommons: {
                type: "content",
                parents: [
                    "8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8+5",
                    "8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8+123"
                ]
            }
        }, {
            version: 10
        })
    })
    t.end()
})

test('Parents is only required for content - missing for profile', t => {
    t.doesNotThrow(() => {
        validateParents({
            url: "dat://4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f",
            p2pcommons: {
                type: "profile"
            }
        }, {
            version: 10
        })
    })
    t.end()
})

test('Parents is required for content - missing', t => {
    t.throws(() => {
        validateParents({
            url: "dat://4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f",
            p2pcommons: {
                type: "content"
            }
        }, {
            version: 10
        })
    })
    t.end()
})

test('Parents may only exist for content - exists for profile', t => {
    t.throws(() => {
        validateParents({
            url: "dat://4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f",
            p2pcommons: {
                type: "profile",
                parents: [
                    "4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f+5",
                    "8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8+123"
                ]
            }
        }, {
            version: 10
        })
    })
    t.end()
})

test('Parents must be an array - is string', t => {
    t.throws(() => {
        validateParents({
            url: "dat://4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f",
            p2pcommons: {
                type: "content",
                parents: "8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8+5"
            }
        }, {
            version: 10
        })
    })
    t.end()
})


test('Parents must be unique - contains multiple versions of same key', t => {
    t.doesNotThrow(() => {
        validateParents({
            url: "dat://4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f",
            p2pcommons: {
                type: "content",
                parents: [
                    "4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f+5",
                    "8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8+40",
                    "8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8+123"
                ]
            }
        }, {
            version: 10
        })
    })
    t.end()
})

test('Parents must be unique - contains duplicates', t => {
    t.throws(() => {
        validateParents({
            url: "dat://4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f",
            p2pcommons: {
                type: "content",
                parents: [
                    "4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f+5",
                    "8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8+123",
                    "8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8+123"
                ]
            }
        }, {
            version: 10
        })
    })
    t.end()
})

test('Parents may only contain versioned Hyperdrive keys - contains non-versioned keys', t => {
    t.throws(() => {
        validateParents({
            url: "dat://4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f",
            p2pcommons: {
                type: "content",
                parents: [
                    "4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f",
                    "8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8+5"
                ]
            }
        }, {
            version: 10
        })
    })
    t.end()
})

test('Parents may not refer to current or future versions of itself - contains previous version', t => {
    t.doesNotThrow(() => {
        validateParents({
            url: "dat://4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f",
            p2pcommons: {
                type: "content",
                parents: [
                    "4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f+5",
                    "8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8+40",
                    "8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8+123"
                ]
            }
        }, {
            version: 10
        })
    })
    t.end()
})

test('Parents may not refer to current or future versions of itself - contains version at time of editing', t => {
    t.doesNotThrow(() => {
        validateParents({
            url: "dat://4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f",
            p2pcommons: {
                type: "content",
                parents: [
                    "4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f+5",
                    "8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8+40",
                    "8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8+123"
                ]
            }
        }, {
            version: 5
        })
    })
    t.end()
})

test('Parents may not refer to current or future versions of itself - contains future version', t => {
    t.throws(() => {
        validateParents({
            url: "dat://4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f",
            p2pcommons: {
                type: "content",
                parents: [
                    "4e01f6848573dcc0a712bd2482e6a3074310757448cd4a78fe219547fc2e484f+123",
                    "8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8+40",
                    "8af39eb4a3eb3252141718f876d29220b8d6f539a045e833e9556aff2a5eacd8+123"
                ]
            }
        }, {
            version: 10
        })
    })
    t.end()
})

test.only('Parents must be registered by at least one author - 1 parent, 1 author, registered', async t => {
    const p2p = createDb()

    const { rawJSON: profile } = await p2p.init({
        type: "profile",
        title: "Author 1"
    })

    const { rawJSON: parentContent } = await p2p.init({
        type: "content",
        title: "Parent content 1"
    })

    try {
        await writeFile(join(p2p.baseDir, parentContent.url.replace("dat://", ""), 'main.txt'), 'hello')
    } catch(err) {
        console.log(err)
    }

    await p2p.set({
        url: parentContent.url,
        main: "main.txt",
        authors: [ profile.url ]
    })

    await p2p.publish(parentContent.url, profile.url)

    try {
        await validateParentsRegistered({
            p2pcommons: { 
                parents: [ parentContent.url.replace("dat://", "") ]
            }
        }, p2p)
        t.pass()
    } catch(err) {
        t.fail(err)
    }

    await p2p.destroy()
    t.end()
})