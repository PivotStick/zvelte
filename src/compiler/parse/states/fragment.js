import { mustache } from './mustache.js';
import { tag } from './tag.js';
import { text } from './text.js';

/**
 * @param {import("../index.js").Parser} parser
 */
export const fragment = (parser) => {
	if (parser.match('<')) {
		return tag;
	}

	if (parser.match('{')) {
		return mustache;
	}

	return text;
};
