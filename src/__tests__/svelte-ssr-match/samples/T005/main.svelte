<script>
    let { Layout, Page, layoutProps, pageProps } = $props();
</script>

{#if Layout}
    <Layout __initialLoad={layoutProps}>
        <Page __initialLoad={pageProps} />
    </Layout>
{:else}
    <Page __initialLoad={pageProps} />
{/if}
