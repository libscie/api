const { ValidationError } = require('./errors')
const assert = require('nanocustomassert')
const { join, isAbsolute } = require('path')
const { existsSync } = require('fs')

const p2pcommonsKeys = ['type', 'subtype', 'main', 'avatar', 'authors', 'parents', 'follows', 'contents']

const validate = (exports.validate = (indexMetadata, dbMetadata, hyperdriveKey, unflatten = true) => {
    if (unflatten) {
        indexMetadata = _unflattenIndexMetadata(indexMetadata)
    }
    validateTitle(indexMetadata, unflatten)
    validateDescription(indexMetadata, unflatten)
    validateUrl(indexMetadata, hyperdriveKey, unflatten)
    validateLinks(indexMetadata, unflatten)
    validateP2pcommons(indexMetadata, dbMetadata, hyperdriveKey, unflatten)
})

exports.validateBeforeInit = (indexMetadata, unflatten = true) => {
    if (unflatten) {
        indexMetadata = _unflattenIndexMetadata(indexMetadata)
    }
    validateTitle(indexMetadata, unflatten)
    validateDescription(indexMetadata, unflatten)
    validateP2pcommons(indexMetadata, {}, "", unflatten)
}

exports.validateOnRegister = (indexMetadata, dbMetadata, hyperdriveKey, p2pcommonsDir, unflatten = true) => {
    if (unflatten) {
        indexMetadata = _unflattenIndexMetadata(indexMetadata)
    }
    validateMainExists(indexMetadata, hyperdriveKey, p2pcommonsDir, unflatten)
    validate(indexMetadata, dbMetadata, hyperdriveKey, unflatten)
}

exports.validateOnUpdateParents = async (indexMetadata, dbMetadata, hyperdriveKey, p2pcommons, unflatten = true) => {
    if (unflatten) {
        indexMetadata = _unflattenIndexMetadata(indexMetadata)
    }
    await validateParentsRegistered(indexMetadata, p2pcommons, unflatten)
    validate(indexMetadata, dbMetadata, hyperdriveKey, unflatten)
}

const validateTitle = (exports.validateTitle = (indexMetadata, unflatten = true) => {
    if (unflatten) {
        indexMetadata = _unflattenIndexMetadata(indexMetadata)
    }
    _validateTitleRequired(indexMetadata)
    _validateTitleType(indexMetadata)
    _validateTitleLength(indexMetadata)
    _validateTitleWhitespace(indexMetadata)
})

const _validateTitleRequired = (indexMetadata) => {
    assert(
        indexMetadata.title !== undefined,
        ValidationError,
        "Title is required",
        "title_required",
        "title"
    )
}

const _validateTitleType = (indexMetadata) => {
    assert(
        typeof indexMetadata.title === "string",
        ValidationError,
        "Title must be a string",
        "title_type",
        "title"
    )
}

const _validateTitleLength = (indexMetadata) => {
    const regex = /^.{1,300}$/
    assert(
        indexMetadata.title.match(regex),
        ValidationError,
        "Title must be between 1 and 300 characters long",
        "title_length",
        "title"
    )
}

const _validateTitleWhitespace = (indexMetadata) => {
    const regex = /[^\s]+/
    assert(
        indexMetadata.title.match(regex),
        ValidationError,
        "Title may not consist of only whitespace",
        "title_whitespace",
        "title"
    )
}

const validateDescription = (exports.validateDescription = (indexMetadata, unflatten = true) => {
    if (unflatten) {
        indexMetadata = _unflattenIndexMetadata(indexMetadata)
    }
    _validateDescriptionRequired(indexMetadata)
    _validateDescriptionType(indexMetadata)
})

const _validateDescriptionRequired = (indexMetadata) => {
    assert(
        indexMetadata.description !== undefined,
        ValidationError,
        "Description is required",
        "description_required",
        "description"
    )
}

const _validateDescriptionType = (indexMetadata) => {
    assert(
        typeof indexMetadata.description === "string",
        ValidationError,
        "Description must be a string",
        "description_type",
        "description"
    )
}

const validateUrl = (exports.validateUrl = (indexMetadata, hyperdriveKey, unflatten = true) => {
    if (unflatten) {
        indexMetadata = _unflattenIndexMetadata(indexMetadata)
    }
    _validateUrlRequired(indexMetadata)
    _validateUrlType(indexMetadata)
    _validateUrlProtocol(indexMetadata)
    _validateUrlFormat(indexMetadata)
    _validateUrlKey(indexMetadata, hyperdriveKey)
})

const _validateUrlRequired = (indexMetadata) => {
    assert(
        indexMetadata.url !== undefined,
        ValidationError,
        "URL is required",
        "url_required",
        "url"
    )
}

const _validateUrlType = (indexMetadata) => {
    assert(
        typeof indexMetadata.url === "string",
        ValidationError,
        "URL must be a string",
        "url_type",
        "url"
    )
}

const _validateUrlProtocol = (indexMetadata) => {
    const regex = /^(hyper:\/\/)/
    assert(
        indexMetadata.url.match(regex),
        ValidationError,
        "URL must start with hyper:// protocol",
        "url_protocol",
        "url"
    )
}

const _validateUrlFormat = (indexMetadata) => {
    const regex = /^(hyper:\/\/)([a-zA-Z0-9]{64})$/
    assert(
        indexMetadata.url.match(regex),
        ValidationError,
        "URL must contain a valid non-versioned Hyperdrive key",
        "url_format",
        "url"
    )
}

const _validateUrlKey = (indexMetadata, hyperdriveKey) => {
    assert(
        indexMetadata.url === `hyper://${hyperdriveKey}`,
        ValidationError,
        "URL must refer to the module's own Hyperdrive key",
        "url_key",
        "url"
    )
}

const validateLinks = (exports.validateLinks = (indexMetadata, unflatten = true) => {
    if (unflatten) {
        indexMetadata = _unflattenIndexMetadata(indexMetadata)
    }
    _validateLinksRequired(indexMetadata)
    _validateLinksType(indexMetadata)
    _validateLinksArrayValues(indexMetadata)
    _validateLinksLicense(indexMetadata)
    _validateLinksSpec(indexMetadata)
})

const _validateLinksRequired = (indexMetadata) => {
    assert(
        indexMetadata.links !== undefined,
        ValidationError,
        "Links object is required",
        "links_required",
        "links"
    )
}

const _validateLinksType = (indexMetadata) => {
    assert(
        typeof indexMetadata.links === "object"
        && !Array.isArray(indexMetadata.links),
        ValidationError,
        "Links must be an object",
        "links_type",
        "links"
    )
}

const _validateLinksArrayValues = (indexMetadata) => {
    Object.values(indexMetadata.links).forEach(value => {
        assert(
            Array.isArray(value),
            ValidationError,
            "Links must be an object with array values",
            "links_arrayvalues",
            "links"
        )
    })
}

const _validateLinksLicense = (indexMetadata) => {
    _validateLinksLicenseRequired(indexMetadata)
    _validateLinksLicenseFormat(indexMetadata)
    _validateLinksLicenseHrefKey(indexMetadata)
    _validateLinksLicenseValue(indexMetadata)
}

const _validateLinksLicenseRequired = (indexMetadata) => {
    assert(
        indexMetadata.links.license !== undefined,
        ValidationError,
        "License is required",
        "links_license_required",
        "links.license"
    )
}

const _validateLinksLicenseFormat = (indexMetadata) => {
    assert(
        indexMetadata.links.license.length === 1
        && typeof indexMetadata.links.license[0] === "object"
        && !Array.isArray(indexMetadata.links.license[0]),
        ValidationError,
        "License must contain one object",
        "links_license_format",
        "links.license"
    )
}

const _validateLinksLicenseHrefKey = (indexMetadata) => {
    assert(
        indexMetadata.links.license[0].href !== undefined,
        ValidationError,
        "License object must have an href key",
        "links_license_href",
        "links.license"
    )
}

const _validateLinksLicenseValue = (indexMetadata) => {
    assert(
        indexMetadata.links.license[0].href === "https://creativecommons.org/publicdomain/zero/1.0/legalcode",
        ValidationError,
        "License link must be equal to 'https://creativecommons.org/publicdomain/zero/1.0/legalcode",
        "links_license_value",
        "links.license"
    )
}

const _validateLinksSpec = (indexMetadata) => {
    _validateLinksSpecRequired(indexMetadata)
    _validateLinksSpecFormat(indexMetadata)
    _validateLinksSpecHrefKey(indexMetadata)
    _validateLinksSpecValidUrl(indexMetadata)
}

const _validateLinksSpecRequired = (indexMetadata) => {
    assert(
        indexMetadata.links.spec !== undefined,
        ValidationError,
        "Spec is required",
        "links_spec_required",
        "links.spec"
    )
}

const _validateLinksSpecFormat = (indexMetadata) => {
    assert(
        indexMetadata.links.spec.length === 1
        && typeof indexMetadata.links.spec[0] === "object"
        && !Array.isArray(indexMetadata.links.spec[0]),
        ValidationError,
        "Spec must contain one object",
        "links_spec_format",
        "links.spec"
    )
}

const _validateLinksSpecHrefKey = (indexMetadata) => {
    assert(
        indexMetadata.links.spec[0].href !== undefined,
        ValidationError,
        "Spec object must have an href key",
        "links_spec_href",
        "links.spec"
    )
}

const _validateLinksSpecValidUrl = (indexMetadata) => {
    const regex = /^https:\/\/p2pcommons.com\/specs\/module\/[0-9]+\.[0-9]+\.[0-9]+$/
    assert(
        indexMetadata.links.spec[0].href.match(regex),
        ValidationError,
        "Spec url must refer to a valid p2pcommons module spec",
        "links_spec_validurl",
        "links.spec"
    )
}

const validateP2pcommons = (exports.validateP2pcommons = (indexMetadata, dbMetadata, hyperdriveKey, unflatten = true) => {
    if (unflatten) {
        indexMetadata = _unflattenIndexMetadata(indexMetadata)
    }
    _validateP2pcommonsRequired(indexMetadata)
    _validateP2pcommonsType(indexMetadata)
    validateType(indexMetadata, unflatten)
    validateSubtype(indexMetadata, unflatten)
    validateMain(indexMetadata, unflatten)
    validateAvatar(indexMetadata, unflatten)
    validateAuthors(indexMetadata, unflatten)
    validateParents(indexMetadata, dbMetadata, hyperdriveKey, unflatten)
    validateFollows(indexMetadata, hyperdriveKey, unflatten)
    validateContents(indexMetadata, unflatten)
})

const _validateP2pcommonsRequired = (indexMetadata) => {
    assert(
        indexMetadata.p2pcommons !== undefined,
        ValidationError,
        "p2pcommons is required",
        "p2pcommons_required",
        "p2pcommons"
    )
}

const _validateP2pcommonsType = (indexMetadata) => {
    assert(
        typeof indexMetadata.p2pcommons === "object"
        && !Array.isArray(indexMetadata.p2pcommons),
        ValidationError,
        "p2pcommons must be an object",
        "p2pcommons_type",
        "p2pcommons"
    )
}

const validateType = (exports.validateType = (indexMetadata, unflatten = true) => {
    if (unflatten) {
        indexMetadata = _unflattenIndexMetadata(indexMetadata)
    }
    _validateTypeRequired(indexMetadata)
    _validateTypeType(indexMetadata)
    _validateTypeValue(indexMetadata)
})

const _validateTypeRequired = (indexMetadata) => {
    assert(
        indexMetadata.p2pcommons.type !== undefined,
        ValidationError,
        "Type is required",
        "type_required",
        "p2pcommons.type"
    )
}

const _validateTypeType = (indexMetadata) => {
    assert(
        typeof indexMetadata.p2pcommons.type === "string",
        ValidationError,
        "Type must be a string",
        "type_type",
        "p2pcommons.type"
    )
}

const _validateTypeValue = (indexMetadata) => {
    assert(
        indexMetadata.p2pcommons.type === "profile"
        || indexMetadata.p2pcommons.type === "content",
        ValidationError,
        "Type must be equal to 'profile' or 'content'",
        "type_value",
        "p2pcommons.type"
    )
}

const validateSubtype = (exports.validateSubtype = (indexMetadata, unflatten = true) => {
    if (unflatten) {
        indexMetadata = _unflattenIndexMetadata(indexMetadata)
    }
    _validateSubtypeRequired(indexMetadata)
    _validateSubtypeType(indexMetadata)
    _validateSubtypeFormat(indexMetadata)
})

const _validateSubtypeRequired = (indexMetadata) => {
    assert(
        indexMetadata.p2pcommons.subtype !== undefined,
        ValidationError,
        "Subtype is required",
        "subtype_required",
        "p2pcommons.subtype"
    )
}

const _validateSubtypeType = (indexMetadata) => {
    assert(
        typeof indexMetadata.p2pcommons.subtype === "string",
        ValidationError,
        "Subtype must be a string",
        "subtype_type",
        "p2pcommons.subtype"
    )
}

const _validateSubtypeFormat = (indexMetadata) => {
    const regex = /^[A-Za-z0-9]*$/
    assert(
        indexMetadata.p2pcommons.subtype.match(regex),
        ValidationError,
        "Subtype may only include standard alphanumeric characters",
        "subtype_format",
        "p2pcommons.subtype"
    )
}

const validateMain = (exports.validateMain = (indexMetadata, unflatten = true) => {
    if (unflatten) {
        indexMetadata = _unflattenIndexMetadata(indexMetadata)
    }
    _validateMainRequired(indexMetadata)
    _validateMainType(indexMetadata)
    _validateMainNoDotfile(indexMetadata)
    _validateMainRelativePath(indexMetadata)
})

const _validateMainRequired = (indexMetadata) => {
    assert(
        indexMetadata.p2pcommons.main !== undefined,
        ValidationError,
        "Main is required",
        "main_required",
        "p2pcommons.main"
    )
}

const _validateMainType = (indexMetadata) => {
    assert(
        typeof indexMetadata.p2pcommons.main === "string",
        ValidationError,
        "Main must be a string",
        "main_type",
        "p2pcommons.main"
    )
}

const _validateMainNoDotfile = (indexMetadata) => {
    const filename = indexMetadata.p2pcommons.main.split('/').pop()
    assert(
        filename.charAt(0) !== ".",
        ValidationError,
        "Main may not be a .dotfile",
        "main_nodotfile",
        "p2pcommons.main"
    )
}

const _validateMainRelativePath = (indexMetadata) => {
    assert(
        _isRelativePath(indexMetadata.p2pcommons.main),
        ValidationError,
        "Main may only contain a relative path within the module",
        "main_relativepath",
        "p2pcommons.main"
    )
}

const validateMainExists = (exports.validateMainExists = (indexMetadata, hyperdriveKey, p2pcommonsDir, unflatten = true) => {
    if (unflatten) {
        indexMetadata = _unflattenIndexMetadata(indexMetadata)
    }
    assert(indexMetadata.p2pcommons.main.length > 0,
        ValidationError,
        "No main file specified",
        "main_empty",
        "p2pcommons.main"
    )
    const path = join(p2pcommonsDir, hyperdriveKey, indexMetadata.p2pcommons.main)

    assert(existsSync(path),
        ValidationError,
        "Main file does not exist",
        "main_exists",
        "p2pcommons.main"
    )
})

const validateAvatar = (exports.validateAvatar = (indexMetadata, unflatten = true) => {
    if (unflatten) {
        indexMetadata = _unflattenIndexMetadata(indexMetadata)
    }
    _validateAvatarModuleType(indexMetadata)
    _validateAvatarType(indexMetadata)
    _validateAvatarRelativePath(indexMetadata)
})

const _validateAvatarModuleType = (indexMetadata) => {
    assert(
        indexMetadata.p2pcommons.avatar === undefined
        || indexMetadata.p2pcommons.type === "profile",
        ValidationError,
        "Avatar may only exist for profiles",
        "avatar_moduletype",
        "p2pcommons.avatar"
    )
}

const _validateAvatarType = (indexMetadata) => {
    assert(
        indexMetadata.p2pcommons.avatar === undefined
        || typeof indexMetadata.p2pcommons.avatar === "string",
        ValidationError,
        "Avatar must be a string",
        "avatar_type",
        "p2pcommons.avatar"
    )
}

const _validateAvatarRelativePath = (indexMetadata) => {
    assert(
        indexMetadata.p2pcommons.avatar === undefined
        || _isRelativePath(indexMetadata.p2pcommons.avatar),
        ValidationError,
        "Avatar may only contain a relative path within the module",
        "avatar_relativepath",
        "p2pcommons.avatar"
    )
}

const validateAuthors = (exports.validateAuthors = (indexMetadata, unflatten = true) => {
    if (unflatten) {
        indexMetadata = _unflattenIndexMetadata(indexMetadata)
    }
    _validateAuthorsRequired(indexMetadata)
    _validateAuthorsModuleType(indexMetadata)
    _validateAuthorsType(indexMetadata)
    _validateAuthorsUnique(indexMetadata)
    _validateAuthorsFormat(indexMetadata)
})

const _validateAuthorsRequired = (indexMetadata) => {
    assert(
        !(indexMetadata.p2pcommons.authors === undefined
        && indexMetadata.p2pcommons.type === "content"),
        ValidationError,
        "Authors is required for content",
        "authors_required",
        "p2pcommons.authors"
    )
}

const _validateAuthorsModuleType = (indexMetadata) => {
    assert(
        indexMetadata.p2pcommons.authors === undefined
        || indexMetadata.p2pcommons.type === "content",
        ValidationError,
        "Authors may only exist for content",
        "authors_moduletype",
        "p2pcommons.authors"
    )
}

const _validateAuthorsType = (indexMetadata) => {
    assert(
        indexMetadata.p2pcommons.authors === undefined
        || Array.isArray(indexMetadata.p2pcommons.authors),
        ValidationError,
        "Authors must be an array",
        "authors_type",
        "p2pcommons.authors"
    )
}

const _validateAuthorsUnique = (indexMetadata) => {
    const uniqueValues = [...new Set(indexMetadata.p2pcommons.authors)]
    assert(
        indexMetadata.p2pcommons.authors === undefined
        || uniqueValues.length === indexMetadata.p2pcommons.authors.length,
        ValidationError,
        "Authors must be unique",
        "authors_unique",
        "p2pcommons.authors"
    )
}

const _validateAuthorsFormat = (indexMetadata) => {
    const regex = /^[A-Za-z0-9]{64}$/
    if (indexMetadata.p2pcommons.authors !== undefined) {
        indexMetadata.p2pcommons.authors.forEach(author => {
            assert(
                typeof author === "string"
                && author.match(regex),
                ValidationError,
                "Authors may only contain non-versioned Hyperdrive keys",
                "authors_format",
                "p2pcommons.authors"
            )
        })
    }
}

const validateParents = (exports.validateParents = (indexMetadata, dbMetadata, hyperdriveKey, unflatten = true) => {
    if (unflatten) {
        indexMetadata = _unflattenIndexMetadata(indexMetadata)
    }
    _validateParentsRequired(indexMetadata)
    _validateParentsModuleType(indexMetadata)
    _validateParentsType(indexMetadata)
    _validateParentsUnique(indexMetadata)
    _validateParentsFormat(indexMetadata)
    _validateParentsNoSelfReference(indexMetadata, dbMetadata, hyperdriveKey)
})

const _validateParentsRequired = (indexMetadata) => {
    assert(
        !(indexMetadata.p2pcommons.parents === undefined
        && indexMetadata.p2pcommons.type === "content"),
        ValidationError,
        "Parents is required for content",
        "parents_required",
        "p2pcommons.parents"
    )
}

const _validateParentsModuleType = (indexMetadata) => {
    assert(
        indexMetadata.p2pcommons.parents === undefined
        || indexMetadata.p2pcommons.type === "content",
        ValidationError,
        "Parents may only exist for content",
        "parents_moduletype",
        "p2pcommons.parents"
    )
}

const _validateParentsType = (indexMetadata) => {
    assert(
        indexMetadata.p2pcommons.parents === undefined
        || Array.isArray(indexMetadata.p2pcommons.parents),
        ValidationError,
        "Parents must be an array",
        "parents_type",
        "p2pcommons.parents"
    )
}

const _validateParentsUnique = (indexMetadata) => {
    const uniqueValues = [...new Set(indexMetadata.p2pcommons.parents)]
    assert(
        indexMetadata.p2pcommons.parents === undefined
        || uniqueValues.length === indexMetadata.p2pcommons.parents.length,
        ValidationError,
        "Parents must be unique",
        "parents_unique",
        "p2pcommons.parents"
    )
}

const _validateParentsFormat = (indexMetadata) => {
    const regex = /^[A-Za-z0-9]{64}(\+\d+)$/
    if (indexMetadata.p2pcommons.parents !== undefined) {
        indexMetadata.p2pcommons.parents.forEach(parent => {
            assert(
                typeof parent === "string"
                && parent.match(regex),
                ValidationError,
                "Parents may only contain versioned Hyperdrive keys",
                "parents_format",
                "p2pcommons.parents"
            )
        })
    }
}

const _validateParentsNoSelfReference = (indexMetadata, dbMetadata, hyperdriveKey) => {
    if (indexMetadata.p2pcommons.parents !== undefined) {
        indexMetadata.p2pcommons.parents.forEach(parent => {
            const split = parent.split('+')
            assert(
                split[0] !== hyperdriveKey
                || split[1] <= dbMetadata.version,
                ValidationError,
                "Parents may not refer to current or future versions of itself",
                "parents_noselfreference",
                "p2pcommons.parents"
            )
        })
    }
}

const validateParentsRegistered = (exports.validateParentsRegistered = async (indexMetadata, p2pcommons, unflatten = true) => {
    if (unflatten) {
        indexMetadata = _unflattenIndexMetadata(indexMetadata)
    }
    if (indexMetadata.p2pcommons.parents !== undefined) {
        for (const parentKey of indexMetadata.p2pcommons.parents) {
            let isRegistered = false
            const { rawJSON: parent } = await p2pcommons.get(parentKey)
            for (const authorKey of parent.authors) {
                const { rawJSON: author } = await p2pcommons.get(authorKey)
                if (author.contents.includes(parentKey) || author.contents.includes(`dat://${parentKey}`)) {
                    isRegistered = true
                    break
                }
            }
            assert(
                isRegistered,
                ValidationError,
                "Parents must be registered by at least one author",
                "parents_registered",
                "p2pcommons.parents"
            )
        }
    }
})

const validateFollows = (exports.validateFollows = (indexMetadata, hyperdriveKey, unflatten = true) => {
    if (unflatten) {
        indexMetadata = _unflattenIndexMetadata(indexMetadata)
    }
    _validateFollowsRequired(indexMetadata)
    _validateFollowsModuleType(indexMetadata)
    _validateFollowsType(indexMetadata)
    _validateFollowsUnique(indexMetadata)
    _validateFollowsFormat(indexMetadata)
    _validateFollowsNoSelfReference(indexMetadata, hyperdriveKey)
})

const _validateFollowsRequired = (indexMetadata) => {
    assert(
        !(indexMetadata.p2pcommons.follows === undefined
        && indexMetadata.p2pcommons.type === "profile"),
        ValidationError,
        "Follows is required for profiles",
        "follows_required",
        "p2pcommons.follows"
    )
}

const _validateFollowsModuleType = (indexMetadata) => {
    assert(
        indexMetadata.p2pcommons.follows === undefined
        || indexMetadata.p2pcommons.type === "profile",
        ValidationError,
        "Follows may only exist for profiles",
        "follows_moduletype",
        "p2pcommons.follows"
    )
}

const _validateFollowsType = (indexMetadata) => {
    assert(
        indexMetadata.p2pcommons.follows === undefined
        || Array.isArray(indexMetadata.p2pcommons.follows),
        ValidationError,
        "Follows must be an array",
        "follows_type",
        "p2pcommons.follows"
    )
}

const _validateFollowsUnique = (indexMetadata) => {
    const uniqueValues = [...new Set(indexMetadata.p2pcommons.follows)]
    assert(
        indexMetadata.p2pcommons.follows === undefined
        || uniqueValues.length === indexMetadata.p2pcommons.follows.length,
        ValidationError,
        "Follows must be unique",
        "follows_unique",
        "p2pcommons.follows"
    )
}

const _validateFollowsFormat = (indexMetadata) => {
    const regex = /^[A-Za-z0-9]{64}(\+\d+)?$/
    if (indexMetadata.p2pcommons.follows !== undefined) {
        indexMetadata.p2pcommons.follows.forEach(follow => {
            assert(
                typeof follow === "string"
                && follow.match(regex),
                ValidationError,
                "Follows may only contain Hyperdrive keys (versioned or non-versioned)",
                "follows_format",
                "p2pcommons.follows"
            )
        })
    }
}

const _validateFollowsNoSelfReference = (indexMetadata, hyperdriveKey) => {
    if (indexMetadata.p2pcommons.follows !== undefined) {
        indexMetadata.p2pcommons.follows.forEach(follow => {
            const split = follow.split('+')
            assert(
                split[0] !== hyperdriveKey,
                ValidationError,
                "Follows may not refer to the profile's own Hyperdrive key",
                "follows_noselfreference",
                "p2pcommons.follows"
            )
        })
    }
}

const validateContents = (exports.validateContents = (indexMetadata, unflatten = true) => {
    if (unflatten) {
        indexMetadata = _unflattenIndexMetadata(indexMetadata)
    }
    _validateContentsRequired(indexMetadata)
    _validateContentsModuleType(indexMetadata)
    _validateContentsType(indexMetadata)
    _validateContentsUnique(indexMetadata)
    _validateContentsFormat(indexMetadata)
})

const _validateContentsRequired = (indexMetadata) => {
    assert(
        !(indexMetadata.p2pcommons.contents === undefined
        && indexMetadata.p2pcommons.type === "profile"),
        ValidationError,
        "Contents is required for profiles",
        "contents_required",
        "p2pcommons.contents"
    )
}

const _validateContentsModuleType = (indexMetadata) => {
    assert(
        indexMetadata.p2pcommons.contents === undefined
        || indexMetadata.p2pcommons.type === "profile",
        ValidationError,
        "Contents may only exist for profiles",
        "contents_moduletype",
        "p2pcommons.contents"
    )
}

const _validateContentsType = (indexMetadata) => {
    assert(
        indexMetadata.p2pcommons.contents === undefined
        || Array.isArray(indexMetadata.p2pcommons.contents),
        ValidationError,
        "Contents must be an array",
        "contents_type",
        "p2pcommons.contents"
    )
}

const _validateContentsUnique = (indexMetadata) => {
    const uniqueValues = [...new Set(indexMetadata.p2pcommons.contents)]
    assert(
        indexMetadata.p2pcommons.contents === undefined
        || uniqueValues.length === indexMetadata.p2pcommons.contents.length,
        ValidationError,
        "Contents must be unique",
        "contents_unique",
        "p2pcommons.contents"
    )
}

const _validateContentsFormat = (indexMetadata) => {
    const regex = /^[A-Za-z0-9]{64}(\+\d+)?$/
    if (indexMetadata.p2pcommons.contents !== undefined) {
        indexMetadata.p2pcommons.contents.forEach(content => {
            assert(
                typeof content === "string"
                && content.match(regex),
                ValidationError,
                "Contents may only contain Hyperdrive keys (versioned or non-versioned)",
                "contents_format",
                "p2pcommons.contents"
            )
        })
    }
}

const _isRelativePath = (path) => {
    const regexIsRelativeOutsideModule = /^\.\.[\\\/]/
    const regexIsURLOrAbsoluteWindowsPath = /:+/
    return !isAbsolute(path)
        && !path.match(regexIsRelativeOutsideModule)
        && !path.match(regexIsURLOrAbsoluteWindowsPath)
}

const _unflattenIndexMetadata = indexMetadata => {
    if (indexMetadata.p2pcommons === undefined) {
        indexMetadata.p2pcommons = {}
        for (const p2pcommonsKey of p2pcommonsKeys) {
            if (indexMetadata[p2pcommonsKey] !== undefined) {
                indexMetadata.p2pcommons[p2pcommonsKey] = indexMetadata[p2pcommonsKey]
                delete indexMetadata[p2pcommonsKey]
            }
        }
    }
    return indexMetadata
}