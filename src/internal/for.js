/**
 * @param {*} arrayLikeOrIterator
 */
export function ensureArrayLike(arrayLikeOrIterator) {
	return arrayLikeOrIterator?.length
		? arrayLikeOrIterator
		: Array.from(arrayLikeOrIterator);
}
