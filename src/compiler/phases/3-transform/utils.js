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
 * @param {string} namespace
 * @param {boolean} preserve_whitespace
 * @param {boolean} preserve_comments
 */
export function cleanNodes(
    parent,
    nodes,
    path,
    namespace = "html",
    preserve_whitespace,
    preserve_comments,
    hoist = true
) {
    /** @type {import('#ast').ZvelteNode[]} */
    const hoisted = [];

    /** @type {import('#ast').ZvelteNode[]} */
    const regular = [];

    for (const node of nodes) {
        if (node.type === "Comment" && !preserve_comments) {
            continue;
        }

        if (hoist && node.type === "SnippetBlock") {
            // TODO others?
            hoisted.push(node);
        } else {
            regular.push(node);
        }
    }

    if (preserve_whitespace) {
        return { hoisted, trimmed: regular };
    }

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
                (n) => n.type === "RegularElement" && n.name === "text"
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

    /** @type {import('#ast').ZvelteNode[]} */
    const trimmed = [];

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
                    prev_is_text_ending_with_whitespace ? "" : " "
                );
            }
            if (next?.type !== "ExpressionTag") {
                node.data = node.data.replace(regex_ends_with_whitespaces, " ");
            }
            if (node.data && (node.data !== " " || !can_remove_entirely)) {
                trimmed.push(node);
            }
        } else {
            trimmed.push(node);
        }
    }

    return { hoisted, trimmed };
}
