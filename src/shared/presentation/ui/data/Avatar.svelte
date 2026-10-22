<script lang="ts">
	import { cn } from '$lib/utils';

	type Size = 'sm' | 'md' | 'lg';

	interface Props {
		name: string;
		src?: string | null;
		size?: Size;
		class?: string;
	}

	let { name, src, size = 'md', class: className }: Props = $props();

	let failed = $state(false);

	const initials = $derived(
		name
			.trim()
			.split(/\s+/)
			.filter((part) => part.length > 0)
			.slice(0, 2)
			.map((part) => part.charAt(0).toUpperCase())
			.join('')
	);

	const showImage = $derived(Boolean(src) && !failed);

	$effect(() => {
		if (src) failed = false;
	});
</script>

<span
	role="img"
	aria-label={name}
	class={cn(
		'avatar inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-chip-neutral text-chip-neutral-ink select-none',
		`avatar-${size}`,
		size === 'lg' ? 'text-footnote' : 'text-caption',
		className
	)}
>
	{#if showImage}
		<img
			{src}
			alt=""
			loading="lazy"
			class="size-full object-cover"
			onerror={() => (failed = true)}
		/>
	{:else}
		<span aria-hidden="true">{initials}</span>
	{/if}
</span>

<style>
	.avatar {
		font-weight: 500;
		inline-size: var(--avatar-size);
		block-size: var(--avatar-size);
	}

	.avatar-sm {
		--avatar-size: var(--spacing-6);
	}

	.avatar-md {
		--avatar-size: var(--spacing-8);
	}

	.avatar-lg {
		--avatar-size: var(--spacing-10);
	}
</style>
