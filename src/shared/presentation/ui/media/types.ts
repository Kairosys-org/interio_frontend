/**
 * Presentation-only media contract (DESIGN §8.2, spec Part 9 §12).
 *
 * Pages map their domain rows onto this shape before passing them to
 * `MediaGrid`/`Lightbox`, so the primitives never import a feature module.
 * `previewUrl` may be a mock signed URL (`interio-mock://…`); such a URL is
 * not renderable in a browser, which is why every tile has an honest labelled
 * placeholder rather than a fabricated image.
 */

export type MediaState = 'pending' | 'uploading' | 'complete' | 'failed' | (string & {});

export interface MediaItem {
	id: string;
	fileName: string;
	caption?: string | null;
	kind: string;
	mimeType: string;
	/** Short-lived URL or null. Only http(s), data: and blob: URLs render. */
	previewUrl?: string | null;
	uploadState?: MediaState;
	alt?: string | null;
	/** For example "Kitchen · photo" or "Survey photo". */
	ownerLabel?: string | null;
	sizeBytes?: number;
}

/** A browser can only load a real URL; mock scheme URLs are placeholders. */
export function canRenderPreview(url: string | null | undefined): boolean {
	if (!url) return false;
	return /^(https?:|data:|blob:)/i.test(url);
}

export function mediaStateLabel(state: MediaState | undefined): string {
	switch (state) {
		case 'pending':
			return 'Waiting to upload';
		case 'uploading':
			return 'Uploading';
		case 'complete':
			return 'Uploaded';
		case 'failed':
			return 'Upload failed';
		default:
			return 'Not uploaded';
	}
}

export function mediaAlt(item: MediaItem): string {
	return item.alt?.trim() || item.caption?.trim() || `${item.kind} — ${item.fileName}`;
}

/** One row of an upload queue; the page owns the actual upload. */
export interface EvidenceFile {
	id: string;
	name: string;
	sizeBytes: number;
	state: 'pending' | 'uploading' | 'complete' | 'failed';
	/** 0–100 while uploading. */
	progress?: number;
	error?: string | null;
	previewUrl?: string | null;
	mimeType?: string;
}
