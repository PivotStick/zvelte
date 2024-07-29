import { fragment } from "./states/fragment.js";
import { createFragment } from "./utils/createFragment.js";
import { regexWhitespace } from "./utils/patterns.js";

export class Parser {
    /**
     * @param {string} template
     * @param {{
     *  specialTag?: string;
     * }} [options={}]
     */
    constructor(template, options = {}) {
        this.template = template;

        this.index = 0;
        this.specialTag = options.specialTag ?? "zvelte";

        /**
         * @type {import("./types.js").Root}
         */
        this.root = {
            type: "Root",
            start: this.index,
            end: -1,
            js: null,
            css: null,
            imports: [],
            fragment: createFragment(),
        };

        this.root.fragment.start = this.index;

        /**
         * @type {import("./types.js").TemplateNode[]}
         */
        this.stack = [this.root];
        this.fragments = [this.root.fragment];

        /**
         * @typedef {(parser: Parser) => ParserState | void} ParserState
         * @type {ParserState}
         */
        let state = fragment;
        while (this.index < this.template.length) {
            state = state(this) || fragment;
        }

        this.root.fragment.end = this.root.end = this.index;
    }

    current() {
        return /** @type {import("./types.js").TemplateNode} */ (
            this.stack.at(-1)
        );
    }

    currentFrag() {
        return /** @type {import("./types.js").Fragment} */ (
            this.fragments.at(-1)
        );
    }

    pop() {
        this.fragments.pop();
        return this.stack.pop();
    }

    /**
     * @template T
     * @param {Omit<T, "prev" | "parent">} node
     * @returns {T}
     */
    append(node) {
        const current = this.current();
        const fragment = this.fragments.at(-1);

        Object.defineProperties(node, {
            prev: {
                enumerable: false,
                value: fragment?.nodes.at(-1) ?? null,
            },
            parent: {
                enumerable: false,
                configurable: true,
                value: current,
            },
        });

        // @ts-expect-error
        fragment.nodes.push(node);

        // @ts-expect-error
        return node;
    }

    /**
     * @param {string} str
     */
    match(str) {
        return this.template.slice(this.index, this.index + str.length) === str;
    }

    /**
     * @param {string} str
     * @param {boolean=} required
     */
    eat(str, required, errorMessage = `Expected "${str}"`) {
        if (this.match(str)) {
            this.index += str.length;
            return true;
        }

        if (required) {
            throw this.error(
                errorMessage,
                this.index,
                this.index + str.length - 1,
            );
        }

        return false;
    }

    /**
     * @param {RegExp} pattern
     */
    matchRegex(pattern) {
        const [match] = pattern.exec(this.template.slice(this.index)) ?? [null];
        return match;
    }

    allowWhitespace() {
        while (
            this.index < this.template.length &&
            regexWhitespace.test(this.template[this.index])
        ) {
            this.index++;
        }
    }

    /**
     * @param {RegExp} pattern
     */
    read(pattern) {
        const result = this.matchRegex(pattern);
        if (result) this.index += result.length;
        return result;
    }

    /**
     * @param {RegExp} pattern
     */
    readUntil(pattern) {
        if (this.index > this.template.length) {
            throw this.error("Unexpected end of input");
        }

        const start = this.index;
        const match = pattern.exec(this.template.slice(start));
        if (match) {
            this.index = start + match.index;
            return this.template.slice(start, this.index);
        }

        this.index = this.template.length;
        return this.template.slice(start);
    }

    requireWhitespace() {
        if (!regexWhitespace.test(this.template[this.index])) {
            throw this.error(`Expected a whitespace`);
        }

        this.allowWhitespace();
    }

    /**
     * @param {string} message
     */
    error(message, start = this.index, end = start) {
        const range = indexesToRange(start, end, this.template);
        const lines = this.template
            .replace(/\t/g, " ")
            .split("\n")
            .slice(0, range.end.ln + 10);

        const browser = typeof window !== "undefined";
        let red = browser ? "" : "\x1b[31m";
        let reset = browser ? "" : "\x1b[0m";
        let bold = browser ? "" : "\x1b[1m";
        let dim = browser ? "" : "\x1b[2m";
        let underline = browser ? "" : "\x1b[4m";

        lines.splice(
            range.start.ln + 1,
            0,
            `${red}${"-".repeat(Math.max(0, range.start.col))}^ ${message} at ${
                range.start.ln + 1
            }:${range.start.col + 1}${reset}${dim}`,
        );

        lines[range.start.ln] = `${lines[range.start.ln].replace(
            /[^\s]/,
            `${underline}${bold}$&`,
        )}${reset}`;

        return new ParseError({
            range,
            message,
            preview:
                "\n" +
                reset +
                lines.slice(Math.max(0, range.start.ln - 4)).join("\n") +
                `...${reset}`,
        });
    }

    eof() {
        return this.index >= this.template.length;
    }
}

/**
 * @param {number} index
 * @param {string} source
 */
function indexToPosition(index, source) {
    let col = 0;
    let ln = 0;
    let cursor = 0;

    while (cursor <= index) {
        col++;

        if (source[cursor] === "\n") {
            col = 0;
            ln++;
        }

        cursor++;
    }

    return { col, ln };
}

/**
 * @param {number} start
 * @param {number} end
 * @param {string} source
 */
function indexesToRange(start, end, source) {
    return {
        start: indexToPosition(start, source),
        end: indexToPosition(end, source),
    };
}

/**
 * @param {string} template
 * @param {ConstructorParameters<typeof Parser>[1]=} options
 */
export function parse(template, options) {
    const parser = new Parser(template, options);
    return parser.root;
}

/**
 * @typedef {{ col: number; ln: number; }} Position;
 * @typedef {{ start: Position; end: Position; }} Range;
 */
class ParseError extends SyntaxError {
    /**
     * @param {{
     *   range: Range;
     *   message: string;
     *   preview: string;
     * }} options
     */
    constructor({ range, message, preview }) {
        super(preview);

        this.text = message;
        this.range = range;
    }
}
