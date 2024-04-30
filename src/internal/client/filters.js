/**
 * @param {string} key
 */
const notImplemented = (key) => () => {
    throw new Error(`Filter "${key}" is not implemented yet`);
};

/**
 * @type {Record<string, (...args: any[]) => any>}
 */
const filters = {
    abs: notImplemented("abs"),
    batch: notImplemented("batch"),
    capitalize: notImplemented("capitalize"),
    column: notImplemented("column"),
    convert_encoding: notImplemented("convert_encoding"),
    country_name: notImplemented("country_name"),
    currency_name: notImplemented("currency_name"),
    currency_symbol: notImplemented("currency_symbol"),
    data_uri: notImplemented("data_uri"),
    date: notImplemented("date"),
    date_modify: notImplemented("date_modify"),
    default: notImplemented("default"),
    escape: notImplemented("escape"),
    filter: notImplemented("filter"),
    first: notImplemented("first"),
    format: notImplemented("format"),
    format_currency: notImplemented("format_currency"),
    format_date: notImplemented("format_date"),
    format_datetime: notImplemented("format_datetime"),
    format_number: notImplemented("format_number"),
    format_time: notImplemented("format_time"),
    html_to_markdown: notImplemented("html_to_markdown"),
    inline_css: notImplemented("inline_css"),
    inky_to_html: notImplemented("inky_to_html"),
    join: notImplemented("join"),
    json_encode: notImplemented("json_encode"),
    keys: notImplemented("keys"),
    language_name: notImplemented("language_name"),
    last: notImplemented("last"),
    length: (value) => {
        if (typeof value === "object" && value !== null) {
            return value.length;
        }
    },
    locale_name: notImplemented("locale_name"),
    lower: notImplemented("lower"),
    map: notImplemented("map"),
    markdown_to_html: notImplemented("markdown_to_html"),
    merge: notImplemented("merge"),
    nl2br: notImplemented("nl2br"),
    number_format: notImplemented("number_format"),
    raw: notImplemented("raw"),
    reduce: notImplemented("reduce"),
    replace: notImplemented("replace"),
    reverse: notImplemented("reverse"),
    round: notImplemented("round"),
    slice: notImplemented("slice"),
    slug: notImplemented("slug"),
    sort: notImplemented("sort"),
    spaceless: notImplemented("spaceless"),
    split: notImplemented("split"),
    striptags: notImplemented("striptags"),
    timezone_name: notImplemented("timezone_name"),
    title: notImplemented("title"),
    trim: notImplemented("trim"),
    u: notImplemented("u:"),
    upper: notImplemented("upper"),
    url_encode: notImplemented("url_encode"),
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
