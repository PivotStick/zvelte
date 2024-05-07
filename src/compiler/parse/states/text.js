/**
 * @param {import("../index.js").Parser} parser
 */
export const text = (parser) => {
    const start = parser.index;
    let data = "";

    while (
        parser.index < parser.template.length &&
        !parser.match("<") &&
        !parser.match("{")
    ) {
        data += parser.template[parser.index++];
    }

    const node = {
        type: "Text",
        start,
        end: parser.index,
        data,
    };

    parser.append(node);
};
