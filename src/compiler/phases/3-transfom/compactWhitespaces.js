/**
 * @param {import("#ast").Any} node
 */
export function compactWhitespaces(node) {
    switch (node.type) {
        case "Text":
            if (node.data.trim() === "") node.data = " ";
            break;

        case "Root":
        case "Element":
        case "Component":
        case "SlotElement":
            compactWhitespaces(node.fragment);
            break;

        case "IfBlock":
            compactWhitespaces(node.consequent);
            if (node.alternate) compactWhitespaces(node.alternate);
            break;

        case "ForBlock":
            compactWhitespaces(node.body);
            if (node.fallback) compactWhitespaces(node.fallback);
            break;

        case "Fragment":
            node.nodes.forEach(compactWhitespaces);
            break;
    }
}
