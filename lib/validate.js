const { ValidationError } = require('./errors')
const assert = require('nanocustomassert')
const { join, isAbsolute, normalize } = require('path')
const { promises: { access } } = require('fs')

const validate = (exports.validate = (indexMetadata, dbMetadata) => {
    validateTitle(indexMetadata)
    validateDescription(indexMetadata)
    validateUrl(indexMetadata, dbMetadata)
    validateLinks(indexMetadata)
    validateP2pcommons(indexMetadata, dbMetadata)
})

exports.validateOnRegister = (indexMetadata, dbMetadata) => {
    validate(indexMetadata, dbMetadata)
    validateMainExists(indexMetadata)
}

exports.validateOnUpdateParents = (indexMetadata, dbMetadata) => {
    validate(indexMetadata, dbMetadata)
    validateParentsRegistered(indexMetadata)
}

const validateTitle = (exports.validateTitle = (indexMetadata) => {
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

const validateDescription = (exports.validateDescription = (indexMetadata) => {
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

const validateUrl = (exports.validateUrl = (indexMetadata, dbMetadata) => {
    _validateUrlRequired(indexMetadata)
    _validateUrlType(indexMetadata)
    _validateUrlProtocol(indexMetadata)
    _validateUrlFormat(indexMetadata)
    _validateUrlKey(indexMetadata, dbMetadata)
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
    const regex = /^(hyper:\/\/)([a-zA-Z0-9]{64})$/ // Mistake in specs
    assert(
        indexMetadata.url.match(regex),
        ValidationError,
        "URL must contain a valid non-versioned Hyperdrive key",
        "url_format",
        "url"
    )
}

const _validateUrlKey = (indexMetadata, dbMetadata) => {
    // How?
}

const validateLinks = (exports.validateLinks = (indexMetadata) => {
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
        indexMetadata.links.license.length == 1
        && typeof indexMetadata.links.license[0] == "object"
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
        indexMetadata.links.spec.length == 1
        && typeof indexMetadata.links.spec[0] == "object"
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

const validateP2pcommons = (exports.validateP2pcommons = (indexMetadata, dbMetadata) => {
    _validateP2pcommonsRequired(indexMetadata)
    _validateP2pcommonsType(indexMetadata)
    validateType(indexMetadata)
    validateSubtype(indexMetadata)
    validateMain(indexMetadata)
    validateAvatar(indexMetadata)
    validateAuthors(indexMetadata)
    validateParents(indexMetadata, dbMetadata)
    validateFollows(indexMetadata)
    validateContents(indexMetadata)
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

const validateType = (exports.validateType = (indexMetadata) => {
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

const validateSubtype = (exports.validateSubtype = (indexMetadata) => {
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
    const regex = /^[A-Za-z0-9]*$/ // Mistake in specs?
    assert(
        indexMetadata.p2pcommons.subtype.match(regex),
        ValidationError,
        "Subtype may only include standard alphanumeric characters",
        "subtype_format",
        "p2pcommons.subtype"
    )
}

const validateMain = (exports.validateMain = (indexMetadata) => {
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
    const regexIsRelativeOutsideModule = /^\.\.[\\\/]/
    const regexIsURLOrAbsoluteWindowsPath = /:+/
    assert(
        !isAbsolute(indexMetadata.p2pcommons.main)
        && !indexMetadata.p2pcommons.main.match(regexIsRelativeOutsideModule)
        && !indexMetadata.p2pcommons.main.match(regexIsURLOrAbsoluteWindowsPath),
        ValidationError,
        "Main may only contain a relative path within the module",
        "main_relativepath",
        "p2pcommons.main"
    )
}

const validateMainExists = (exports.validateMainExists = async (indexMetadata, p2pcommonsDir) => {
    assert(indexMetadata.p2pcommons.main.length > 0,
        ValidationError,
        "No main file specified",
        "main_empty",
        "p2pcommons.main"
    )
    const hyperdriveKey = indexMetadata.url.substring(8)
    const path = join(p2pcommonsDir, hyperdriveKey, indexMetadata.p2pcommons.main)
    try {
        await access(path)
    } catch(err) {
        throw new ValidationError("Main file does not exist", "main_exists", "p2pcommons.main")
    }
})

const validateAvatar = (exports.validateAvatar = (indexMetadata) => {
    _validateAvatarMayExist(indexMetadata)
    _validateAvatarType(indexMetadata)
    _validateAvatarRelativePath(indexMetadata)
})

const _validateAvatarMayExist = (indexMetadata) => {

}

const _validateAvatarType = (indexMetadata) => {
    
}

const _validateAvatarRelativePath = (indexMetadata) => {
    
}

const validateAuthors = (exports.validateAuthors = (indexMetadata) => {
    _validateAuthorsRequired(indexMetadata)
    _validateAuthorsMayExist(indexMetadata)
    _validateAuthorsType(indexMetadata)
    _validateAuthorsUnique(indexMetadata)
    _validateAuthorsUnversioned(indexMetadata)
})

const _validateAuthorsRequired = (indexMetadata) => {

}

const _validateAuthorsMayExist = (indexMetadata) => {
    
}

const _validateAuthorsType = (indexMetadata) => {
    
}

const _validateAuthorsUnique = (indexMetadata) => {
    
}

const _validateAuthorsUnversioned = (indexMetadata) => {
    
}

const validateParents = (exports.validateParents = (indexMetadata, dbMetadata) => {
    _validateParentsRequired(indexMetadata)
    _validateParentsMayExist(indexMetadata)
    _validateParentsType(indexMetadata)
    _validateParentsUnique(indexMetadata)
    _validateParentsVersioned(indexMetadata)
    _validateParentsNoSelfReference(indexMetadata, dbMetadata)
})

const _validateParentsRequired = (indexMetadata) => {

}

const _validateParentsMayExist = (indexMetadata) => {
    
}

const _validateParentsType = (indexMetadata) => {
    
}

const _validateParentsUnique = (indexMetadata) => {
    
}

const _validateParentsVersioned = (indexMetadata) => {
    
}

const _validateParentsNoSelfReference = (indexMetadata, dbMetadata) => {
    
}

const validateParentsRegistered = (exports.validateParentsRegistered = (indexMetadata) => {
    
})

const validateFollows = (exports.validateFollows = (indexMetadata) => {
    _validateFollowsRequired(indexMetadata)
    _validateFollowsMayExist(indexMetadata)
    _validateFollowsType(indexMetadata)
    _validateFollowsUnique(indexMetadata)
    _validateFollowsFormat(indexMetadata)
    _validateFollowsNoSelfReference(indexMetadata)
})

const _validateFollowsRequired = (indexMetadata) => {

}

const _validateFollowsMayExist = (indexMetadata) => {
    
}

const _validateFollowsType = (indexMetadata) => {
    
}

const _validateFollowsUnique = (indexMetadata) => {
    
}

const _validateFollowsFormat = (indexMetadata) => {
    
}

const _validateFollowsNoSelfReference = (indexMetadata) => {
    
}

const validateContents = (exports.validateContents = (indexMetadata) => {
    _validateContentsRequired(indexMetadata)
    _validateContentsMayExist(indexMetadata)
    _validateContentsType(indexMetadata)
    _validateContentsUnique(indexMetadata)
    _validateContentsFormat(indexMetadata)
})

const _validateContentsRequired = (indexMetadata) => {

}

const _validateContentsMayExist = (indexMetadata) => {
    
}

const _validateContentsType = (indexMetadata) => {
    
}

const _validateContentsUnique = (indexMetadata) => {
    
}

const _validateContentsFormat = (indexMetadata) => {
    
}