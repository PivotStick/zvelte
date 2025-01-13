<script>
    import { fly } from "svelte/transition";

    let { currentItem } = $props();
    let heroHeader;
</script>

<div class="hero-header" bind:this={heroHeader}>
    <p>
        {#key currentItem}
            <span
                in:fly={{ duration: 500, y: "100%" }}
                out:fly={{ duration: 500, y: "-100%" }}
                >{currentItem.title}</span
            >
        {/key}
    </p>
</div>
