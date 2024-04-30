function notImplemented() {
    throw new Error("Filter not implemented yet");
}

/**
 * @type {Record<string, (...args: any[]) => any>}
 */
const filters = {
    abs: notImplemented,
    batch: notImplemented,
    capitalize: notImplemented,
    column: notImplemented,
    convert_encoding: notImplemented,
    country_name: notImplemented,
    currency_name: notImplemented,
    currency_symbol: notImplemented,
    data_uri: notImplemented,
    date: notImplemented,
    date_modify: notImplemented,
    default: notImplemented,
    escape: notImplemented,
    filter: notImplemented,
    first: notImplemented,
    format: notImplemented,
    format_currency: notImplemented,
    format_date: notImplemented,
    format_datetime: notImplemented,
    format_number: notImplemented,
    format_time: notImplemented,
    html_to_markdown: notImplemented,
    inline_css: notImplemented,
    inky_to_html: notImplemented,
    join: notImplemented,
    json_encode: notImplemented,
    keys: notImplemented,
    language_name: notImplemented,
    last: notImplemented,
    length: (value) => {
        if (typeof value === "object" && value !== null) {
            return value.length;
        }
    },
    locale_name: notImplemented,
    lower: notImplemented,
    map: notImplemented,
    markdown_to_html: notImplemented,
    merge: notImplemented,
    nl2br: notImplemented,
    number_format: notImplemented,
    raw: notImplemented,
    reduce: notImplemented,
    replace: notImplemented,
    reverse: notImplemented,
    round: notImplemented,
    slice: notImplemented,
    slug: notImplemented,
    sort: notImplemented,
    spaceless: notImplemented,
    split: notImplemented,
    striptags: notImplemented,
    timezone_name: notImplemented,
    title: notImplemented,
    trim: notImplemented,
    u: notImplemented,
    upper: notImplemented,
    url_encode: notImplemented,
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
