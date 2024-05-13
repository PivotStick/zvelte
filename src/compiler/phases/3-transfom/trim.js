/**
 * @param {import("#ast").Fragment} fragment
 */
function trimFragment(fragment) {
    const first = fragment.nodes.at(0);

    if (
        first?.type === "Text" &&
        (first.data = first.data.trimStart()) === ""
    ) {
        fragment.nodes.splice(0, 1);
    }

    const last = fragment.nodes.at(-1);

    if (last?.type === "Text" && (last.data = last.data.trimEnd()) === "") {
        fragment.nodes.splice(-1);
    }
}

/**
 * @param {import("#ast").Any} node
 */
export function trim(node) {
    switch (node.type) {
        case "Fragment":
            node.nodes.forEach(trim);
            break;

        case "Root":
        case "Element":
        case "Component":
        case "SlotElement":
            trimFragment(node.fragment);
            trim(node.fragment);
            break;

        case "IfBlock":
            trimFragment(node.consequent);
            trim(node.consequent);
            if (node.alternate) {
                trimFragment(node.alternate);
                trim(node.alternate);
            }
            break;

        case "ForBlock":
            trimFragment(node.body);
            trim(node.body);
            if (node.fallback) {
                trimFragment(node.fallback);
                trim(node.fallback);
            }
            break;
    }
}
