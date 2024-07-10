export function tweened<T, K>(
    props: T,
    key: K,
    value: T[K],
    opts: import("svelte/motion").TweenedOptions<T[K]>,
): import("svelte/motion").Tweened;

export function spring<T, K>(
    props: T,
    key: K,
    value: T[K],
    opts: import("svelte/motion").SpringOpts,
): import("svelte/motion").Spring;
