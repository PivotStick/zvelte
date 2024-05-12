import { fragment } from "./states/fragment.js";
import { createFragment } from "./utils/createFragment.js";
import { regexWhitespace } from "./utils/patterns.js";

export class Parser {
    /**
     * @param {string} template
     * @param {{
     *  component?: { name: RegExp; key: string; }
     * }} [options={}]
     */
    constructor(template, options = {}) {
        this.template = template;

        this.index = 0;
        this.component = options.component;

        if (this.component?.name.test("slot")) {
            throw new Error(
                "`slot` is a reserved element, it cannot be used for components",
            );
        }

        /**
         * @type {import("./types.js").Root}
         */
        this.root = {
            type: "Root",
            start: this.index,
            end: -1,
            js: null,
            css: null,
            fragment: createFragment(),
        };

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

        this.root.end = this.index;
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
    eat(str, required) {
        if (this.match(str)) {
            this.index += str.length;
            return true;
        }

        if (required) {
            throw this.error(`Expected "${str}"`);
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

    error(message = "Something went wrong", start = this.index) {
        let col = 0;
        let ln = 0;
        let cursor = 0;

        while (cursor <= start) {
            col++;

            if (this.template[cursor] === "\n") {
                col = 0;
                ln++;
            }

            cursor++;
        }

        const lines = this.template
            .replace(/\t/g, " ")
            .split("\n")
            .slice(0, ln + 10);

        const browser = typeof window !== "undefined";
        let red = browser ? "" : "\x1b[31m";
        let reset = browser ? "" : "\x1b[0m";
        let bold = browser ? "" : "\x1b[1m";
        let dim = browser ? "" : "\x1b[2m";
        let underline = browser ? "" : "\x1b[4m";

        lines.splice(
            ln + 1,
            0,
            `${red}${"-".repeat(Math.max(0, col - 1))}^ ${message} at ${ln + 1}:${col + 1}${reset}${dim}`,
        );

        lines[ln] =
            `${lines[ln].replace(/[^\s]/, `${underline}${bold}$&`)}${reset}`;

        return new SyntaxError(
            "\n" +
                reset +
                lines.slice(Math.max(0, ln - 4)).join("\n") +
                `...${reset}`,
        );
    }

    eof() {
        return this.index >= this.template.length;
    }
}

/**
 * @param {string} template
 * @param {ConstructorParameters<typeof Parser>[1]=} options
 */
export function parse(template, options) {
    const parser = new Parser(template, options);
    return parser.root;
}
