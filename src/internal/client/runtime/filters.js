import { sprintf } from "sprintf-js";

const constants = {
    JSON_PRETTY_PRINT: 1 << 1,
};

/**
 * @param {string} key
 */
const notImplemented = (key) => () => {
    throw new Error(`The filter "${key}" is not implemented yet`);
};

/**
 * @type {Record<string, (...args: any[]) => any>}
 */
export const filters = {
    abs: Math.abs,
    /**
     * @param {any[]} array
     * @param {number} size
     * @param {any} fill
     * @param {boolean} preserveKeys
     */
    batch: (array, size, fill, preserveKeys = true) => {
        const batches = [];
        const totalCount = Math.ceil(array.length / size);

        for (let i = 0; i < totalCount; i++) {
            const offset = i * size;
            const batch = [];
            for (let j = 0; j < size; j++) {
                const value = array[offset + j] ?? fill;
                batch[preserveKeys ? offset + j : j] = value;
            }
            batches.push(batch);
        }

        return batches;
    },
    capitalize: (str) =>
        str.toLowerCase().replace(/\b\w/, (l) => l.toUpperCase()),
    column: (array, key) => {
        const values = [];
        array.forEach((item) => {
            values.push(item?.[key]);
        });
        return values;
    },
    convert_encoding: notImplemented("convert_encoding"),
    country_name: notImplemented("country_name"),
    currency_name: notImplemented("currency_name"),
    currency_symbol: notImplemented("currency_symbol"),
    data_uri: notImplemented("data_uri"),
    date: notImplemented("date"),
    date_modify: notImplemented("date_modify"),
    default: (value, fallback) => value ?? fallback,
    escape: notImplemented("escape"),
    filter: (array, callback) => array?.filter(callback),
    first: (array) => Object.keys(array).at(0),
    format: sprintf,
    format_currency: notImplemented("format_currency"),
    format_date: notImplemented("format_date"),
    format_datetime: notImplemented("format_datetime"),
    format_number: notImplemented("format_number"),
    format_time: notImplemented("format_time"),
    html_to_markdown: notImplemented("html_to_markdown"),
    inline_css: notImplemented("inline_css"),
    inky_to_html: notImplemented("inky_to_html"),
    join: (array, glue = "", and = glue) => {
        if (Array.isArray(array)) {
            let result = "";
            for (let i = 0; i < array.length; i++) {
                const value = array[i];
                if (i > 0) {
                    result += i === array.length - 1 ? and : glue;
                }
                result += value;
            }
            return result;
        }
    },
    /**
     * @param {any} value
     * @param {number} flags
     */
    json_encode: (value, flags) => {
        if ((flags & constants.JSON_PRETTY_PRINT) !== 0) {
            return JSON.stringify(value, null, 2);
        }
        return JSON.stringify(value);
    },
    keys: Object.keys,
    language_name: notImplemented("language_name"),
    last: (value) => Object.keys(value).at(-1),
    length: (value) => {
        if (typeof value === "object" && value !== null) {
            return value.length;
        }
    },
    locale_name: notImplemented("locale_name"),
    lower: (str) => str.toLowerCase(),
    map: (arr, callback) => arr.map(callback),
    markdown_to_html: notImplemented("markdown_to_html"),
    merge: (a, b) => {
        return Array.isArray(a) ? [...a, ...b] : { ...a, ...b };
    },
    nl2br: (value) => {
        return value.replace(/\n/g, "<br />");
    },
    number_format: notImplemented("number_format"),
    raw: () => {
        throw new Error(
            `"raw" filter should not be used, please use {{ @html ... }} instead`,
        );
    },
    reduce: notImplemented("reduce"),
    replace: notImplemented("replace"),
    reverse: notImplemented("reverse"),
    round: notImplemented("round"),
    slice: notImplemented("slice"),
    slug: notImplemented("slug"),
    sort: notImplemented("sort"),
    spaceless: notImplemented("spaceless"),
    split: (arr, ...args) => arr.split(...args),
    striptags: notImplemented("striptags"),
    timezone_name: notImplemented("timezone_name"),
    title: notImplemented("title"),
    trim: (str) => str.trim(),
    u: notImplemented("u:"),
    upper: (str) => str.toUpperCase(),
    url_encode: notImplemented("url_encode"),
    constant(key) {
        return constants[key];
    },
};

/**
 * @param {string} key
 */
export function getFilter(key) {
    return filters[key];
}

/**
 * @param {string} key
 * @param {(...args: any[]) => any} fn
 */
export function registerFilter(key, fn) {
    filters[key] = fn;
}
