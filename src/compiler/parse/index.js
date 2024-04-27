import { fragment } from "./states/fragment.js";
import { regexWhitespace } from "./utils/patterns.js";

export class Parser {
    /**
     * @param {string} template
     */
    constructor(template) {
        this.template = template;
        this.html = {
            type: "Fragment",
            children: [],
        };

        this.js = null;
        this.css = null;

        this.index = 0;
        this.stack = [this.html];

        /**
         * @typedef {(parser: Parser) => ParserState | void} ParserState
         * @type {ParserState}
         */
        let state = fragment;
        while (this.index < this.template.length) {
            state = state(this) || fragment;
        }
    }

    current() {
        return this.stack[this.stack.length - 1];
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

    error(message = "Something went wrong") {
        const i = this.index;

        let col = 0;
        let ln = 0;
        let cursor = 0;

        while (cursor <= i) {
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
        let dim = browser ? "" : "\x1b[2m";

        lines.splice(
            ln + 1,
            0,
            `${red}${"-".repeat(Math.max(0, col - 1))}^ ${message} at ${ln + 1}:${col + 1}${reset}${dim}`,
        );

        return new SyntaxError("\n" + reset + lines.join("\n") + `...${reset}`);
    }
}

/**
 * @param {string} template
 */
export function parse(template) {
    const parser = new Parser(template);

    return {
        html: parser.html,
        js: parser.js,
        css: parser.css,
    };
}
