<script>
    let { layout, page, layoutProps, pageProps } = $props();
</script>

{#if layout}
    <svelte:component this={layout} __initialLoad={layoutProps}>
        <svelte:component this={page} __initialLoad={pageProps} />
    </svelte:component>
{:else}
    <svelte:component this={page} __initialLoad={pageProps} />
{/if}
