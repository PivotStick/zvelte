export function tweened<T, K extends keyof T>(
    props: T,
    key: K,
    value: T[K],
    opts?: import("svelte/motion").TweenedOptions<T[K]>,
): import("svelte/motion").Tweened;

export function spring<T, K extends keyof T>(
    props: T,
    key: K,
    value: T[K],
    opts?: import("svelte/motion").SpringOpts,
): import("svelte/motion").Spring;
