export const JsKeywords = [
    "class",
    "break",
    "const",
    "let",
    "var",
    "continue",
    "if",
    "for",
    "while",
    "do",
    "new",
    "static",
    "true",
    "false",
    "void",
    "with",
    "yield",
    "await",
    "typeof",
    "throw",
    "throws",
    "null",
    "delete",
    "default",
    "catch",
    "debugger",
    "case",
    "arguments",
    "else",
    "extends",
    "export",
    "import",
    "extends",
    "switch",
    "instanceof",
    "return",
    "this",
];

export const VoidElements = [
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "keygen",
    "link",
    "menuitem",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
];

export const PassiveEvents = [
    "wheel",
    "touchstart",
    "touchmove",
    "touchend",
    "touchcancel",
];

/**
 * Attributes that are boolean, i.e. they are present or not present.
 */
export const DOMBooleanAttributes = [
    "allowfullscreen",
    "async",
    "autofocus",
    "autoplay",
    "checked",
    "controls",
    "default",
    "disabled",
    "formnovalidate",
    "hidden",
    "indeterminate",
    "ismap",
    "loop",
    "multiple",
    "muted",
    "nomodule",
    "novalidate",
    "open",
    "playsinline",
    "readonly",
    "required",
    "reversed",
    "seamless",
    "selected",
    "webkitdirectory",
];

/**
 * @type {Record<string, string>}
 * List of attribute names that should be aliased to their property names
 * because they behave differently between setting them as an attribute and
 * setting them as a property.
 */
export const AttributeAliases = {
    // no `class: 'className'` because we handle that separately
    formnovalidate: "formNoValidate",
    ismap: "isMap",
    nomodule: "noModule",
    playsinline: "playsInline",
    readonly: "readOnly",
};

export const DOMProperties = [
    ...Object.values(AttributeAliases),
    "value",
    "inert",
    ...DOMBooleanAttributes,
];
