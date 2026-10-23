// The mobile survey shell reads the browser mock/outbox, so it is rendered on
// the client only (phase-2 §3.2, §4.1 offline note).
export const ssr = false;
export const prerender = false;
export const trailingSlash = 'never';
