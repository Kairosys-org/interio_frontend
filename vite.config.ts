import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	// SvelteKit reads PUBLIC_* through `$env/*`; Vite needs its own prefix so
	// `import.meta.env.PUBLIC_*` resolves in the network layer and in tests.
	envPrefix: ['PUBLIC_', 'VITE_'],
	plugins: [tailwindcss(), sveltekit()]
});
