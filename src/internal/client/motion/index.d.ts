export function tweened<T>(
    fn: (value: T) => void,
    value: T,
    opts: import("svelte/motion").TweenedOptions<T>,
): import("svelte/motion").Tweened;

export function spring<T>(
    fn: (value: T) => void,
    value: T,
    opts: import("svelte/motion").SpringOpts,
): import("svelte/motion").Spring;
