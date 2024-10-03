import { walk } from "zimmerframe";
import {
    regex_ends_with_whitespaces,
    regex_not_whitespace,
    regex_starts_with_whitespaces,
} from "../patterns.js";

/**
 * Extract nodes that are hoisted and trim whitespace according to the following rules:
 * - trim leading and trailing whitespace, regardless of surroundings
 * - keep leading / trailing whitespace of inbetween text nodes,
 *   unless it's whitespace-only, in which case collapse to a single whitespace for all cases
 *   except when it's children of certain elements where we know ignore whitespace (like td/option/head),
 *   in which case we remove it entirely
 * @param {import('#ast').ZvelteNode} parent
 * @param {import('#ast').ZvelteNode[]} nodes
 * @param {import('#ast').ZvelteNode[]} path
 * @param {import("./render_dom/types.js").ComponentClientTransformState} state
 * @param {string} namespace
 * @param {boolean} preserve_whitespace
 * @param {boolean} preserve_comments
 */
export function clean_nodes(
    parent,
    nodes,
    path,
    namespace = "html",
    state,
    // TODO give these defaults (state.options.preserveWhitespace and state.options.preserveComments).
    // first, we need to make `Component(Client|Server)TransformState` inherit from a new `ComponentTransformState`
    // rather than from `ClientTransformState` and `ServerTransformState`
    preserve_whitespace,
    preserve_comments,
) {
    /** @type {import("#ast").ZvelteNode[]} */
    const hoisted = [];

    /** @type {import("#ast").ZvelteNode[]} */
    const regular = [];

    for (const node of nodes) {
        if (node.type === "Comment" && !preserve_comments) {
            continue;
        }

        if (
            // node.type === "ConstTag" ||
            // node.type === "DebugTag" ||
            // node.type === "ZvelteBody" ||
            // node.type === "ZvelteWindow" ||
            // node.type === "ZvelteDocument" ||
            node.type === "VariableTag" ||
            node.type === "ZvelteHead" ||
            node.type === "TitleElement" ||
            node.type === "SnippetBlock"
        ) {
            // TODO others?
            hoisted.push(node);
        } else {
            regular.push(node);
        }
    }

    let trimmed = regular;

    if (!preserve_whitespace) {
        trimmed = [];

        let first, last;

        while (
            (first = regular[0]) &&
            first.type === "Text" &&
            !regex_not_whitespace.test(first.data)
        ) {
            regular.shift();
        }

        if (first?.type === "Text") {
            first.data = first.data.replace(regex_starts_with_whitespaces, "");
        }

        while (
            (last = regular.at(-1)) &&
            last.type === "Text" &&
            !regex_not_whitespace.test(last.data)
        ) {
            regular.pop();
        }

        if (last?.type === "Text") {
            last.data = last.data.replace(regex_ends_with_whitespaces, "");
        }

        const can_remove_entirely =
            (namespace === "svg" &&
                (parent.type !== "RegularElement" || parent.name !== "text") &&
                !path.some(
                    (n) => n.type === "RegularElement" && n.name === "text",
                )) ||
            (parent.type === "RegularElement" &&
                // TODO others?
                (parent.name === "select" ||
                    parent.name === "tr" ||
                    parent.name === "table" ||
                    parent.name === "tbody" ||
                    parent.name === "thead" ||
                    parent.name === "tfoot" ||
                    parent.name === "colgroup" ||
                    parent.name === "datalist"));

        // Replace any whitespace between a text and non-text node with a single spaceand keep whitespace
        // as-is within text nodes, or between text nodes and expression tags (because in the end they count
        // as one text). This way whitespace is mostly preserved when using CSS with `white-space: pre-line`
        // and default slot content going into a pre tag (which we can't see).
        for (let i = 0; i < regular.length; i++) {
            const prev = regular[i - 1];
            const node = regular[i];
            const next = regular[i + 1];

            if (node.type === "Text") {
                if (prev?.type !== "ExpressionTag") {
                    const prev_is_text_ending_with_whitespace =
                        prev?.type === "Text" &&
                        regex_ends_with_whitespaces.test(prev.data);
                    node.data = node.data.replace(
                        regex_starts_with_whitespaces,
                        prev_is_text_ending_with_whitespace ? "" : " ",
                    );
                }
                if (next?.type !== "ExpressionTag") {
                    node.data = node.data.replace(
                        regex_ends_with_whitespaces,
                        " ",
                    );
                }
                if (node.data && (node.data !== " " || !can_remove_entirely)) {
                    trimmed.push(node);
                }
            } else {
                trimmed.push(node);
            }
        }
    }

    var first = trimmed[0];

    return {
        hoisted,
        trimmed,
        /**
         * In a case like `{#if x}<Foo />{/if}`, we don't need to wrap the child in
         * comments — we can just use the parent block's anchor for the component.
         * TODO extend this optimisation to other cases
         */
        is_standalone:
            trimmed.length === 1 &&
            ((first.type === "RenderTag" && !first.metadata.dynamic) ||
                (first.type === "Component" &&
                    !state.options.hmr &&
                    !first.metadata.dynamic &&
                    !first.attributes.some(
                        (attribute) =>
                            attribute.type === "Attribute" &&
                            attribute.name.startsWith("--"),
                    ))),
        /** if a component/snippet/each block starts with text, we need to add an anchor comment so that its text node doesn't get fused with its surroundings */
        is_text_first:
            (parent.type === "Root" ||
                parent.type === "Fragment" ||
                parent.type === "SnippetBlock" ||
                parent.type === "ForBlock" ||
                parent.type === "ZvelteComponent" ||
                parent.type === "Component" ||
                parent.type === "ZvelteSelf") &&
            first &&
            (first?.type === "Text" || first?.type === "ExpressionTag"),
    };
}

/**
 * Infers the namespace for the children of a node that should be used when creating the `$.template(...)`.
 * @param {import("#ast").Namespace} namespace
 * @param {import("#ast").ZvelteNode} parent
 * @param {import("#ast").ZvelteNode[]} nodes
 */
export function infer_namespace(namespace, parent, nodes) {
    if (parent.type === "RegularElement" && parent.name === "foreignObject") {
        return "html";
    }

    if (parent.type === "RegularElement" || parent.type === "ZvelteElement") {
        if (parent.metadata.svg) {
            return "svg";
        }
        return parent.metadata.mathml ? "mathml" : "html";
    }

    // Re-evaluate the namespace inside slot nodes that reset the namespace
    if (
        parent.type === "Fragment" ||
        parent.type === "Root" ||
        parent.type === "Component" ||
        parent.type === "ZvelteComponent" ||
        // parent.type === 'ZvelteFragment' ||
        parent.type === "SnippetBlock"
    ) {
        const new_namespace = check_nodes_for_namespace(nodes, "keep");
        if (new_namespace !== "keep" && new_namespace !== "maybe_html") {
            return new_namespace;
        }
    }

    return namespace;
}

/**
 * Heuristic: Keep current namespace, unless we find a regular element,
 * in which case we always want html, or we only find svg nodes,
 * in which case we assume svg.
 * @param {import("#ast").ZvelteNode[]} nodes
 * @param {import("#ast").Namespace | 'keep' | 'maybe_html'} namespace
 */
function check_nodes_for_namespace(nodes, namespace) {
    /**
     * @param {import("#ast").ZvelteElement | import("#ast").RegularElement} node}
     * @param {{stop: () => void}} context
     */
    const RegularElement = (node, { stop }) => {
        if (!node.metadata.svg && !node.metadata.mathml) {
            namespace = "html";
            stop();
        } else if (namespace === "keep") {
            namespace = node.metadata.svg ? "svg" : "mathml";
        }
    };

    for (const node of nodes) {
        walk(
            node,
            {},
            {
                _(node, { next }) {
                    if (
                        node.type === "ForBlock" ||
                        node.type === "IfBlock" ||
                        node.type === "AwaitBlock" ||
                        node.type === "Fragment" ||
                        node.type === "KeyBlock" ||
                        node.type === "RegularElement" ||
                        node.type === "ZvelteElement" ||
                        node.type === "Text"
                    ) {
                        next();
                    }
                },
                ZvelteElement: RegularElement,
                RegularElement,
                Text(node) {
                    if (node.data.trim() !== "") {
                        namespace = "maybe_html";
                    }
                },
            },
        );

        if (namespace === "html") return namespace;
    }

    return namespace;
}

/**
 * @param {string} name
 */
export function is_capture_event(name) {
    return (
        name.endsWith("capture") &&
        name !== "gotpointercapture" &&
        name !== "lostpointercapture"
    );
}

/**
 * Subset of delegated events which should be passive by default.
 * These two are already passive via browser defaults on window, document and body.
 * But since
 * - we're delegating them
 * - they happen often
 * - they apply to mobile which is generally less performant
 * we're marking them as passive by default for other elements, too.
 */
const PASSIVE_EVENTS = ["touchstart", "touchmove"];

/**
 * Returns `true` if `name` is a passive event
 * @param {string} name
 */
export function is_passive_event(name) {
    return PASSIVE_EVENTS.includes(name);
}

/**
 * Attributes that are boolean, i.e. they are present or not present.
 */
const DOM_BOOLEAN_ATTRIBUTES = [
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
 * Returns `true` if `name` is a boolean attribute
 * @param {string} name
 */
export function is_boolean_attribute(name) {
    return DOM_BOOLEAN_ATTRIBUTES.includes(name);
}

/**
 * @type {Record<string, string>}
 * List of attribute names that should be aliased to their property names
 * because they behave differently between setting them as an attribute and
 * setting them as a property.
 */
const ATTRIBUTE_ALIASES = {
    // no `class: 'className'` because we handle that separately
    formnovalidate: "formNoValidate",
    ismap: "isMap",
    nomodule: "noModule",
    playsinline: "playsInline",
    readonly: "readOnly",
};

/**
 * @param {string} name
 */
export function normalize_attribute(name) {
    name = name.toLowerCase();
    return ATTRIBUTE_ALIASES[name] ?? name;
}

const DOM_PROPERTIES = [
    ...DOM_BOOLEAN_ATTRIBUTES,
    "formNoValidate",
    "isMap",
    "noModule",
    "playsInline",
    "readOnly",
    "value",
    "inert",
    "volume",
];

/**
 * @param {string} name
 */
export function is_dom_property(name) {
    return DOM_PROPERTIES.includes(name);
}

const LOAD_ERROR_ELEMENTS = [
    "body",
    "embed",
    "iframe",
    "img",
    "link",
    "object",
    "script",
    "style",
    "track",
];

/**
 * Returns `true` if the element emits `load` and `error` events
 * @param {string} name
 */
export function is_load_error_element(name) {
    return LOAD_ERROR_ELEMENTS.includes(name);
}

/**
 * Determines the namespace the children of this node are in.
 * @param {import('#ast').RegularElement | import('#ast').ZvelteElement} node
 * @param {import("#ast").Namespace} namespace
 * @returns {import("#ast").Namespace}
 */
export function determine_namespace_for_children(node, namespace) {
    if (node.name === "foreignObject") {
        return "html";
    }

    if (node.metadata.svg) {
        return "svg";
    }

    return node.metadata.mathml ? "mathml" : "html";
}

const VOID_ELEMENT_NAMES = [
    "area",
    "base",
    "br",
    "col",
    "command",
    "embed",
    "hr",
    "img",
    "input",
    "keygen",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
];

/**
 * Returns `true` if `name` is of a void element
 * @param {string} name
 */
export function is_void(name) {
    return (
        VOID_ELEMENT_NAMES.includes(name) || name.toLowerCase() === "!doctype"
    );
}
