/**
 * Browser SHA-256 for asset integrity (Part 9 §12, S7).
 *
 * The mock backend never trusts the client's claim: it compares this digest
 * with the one re-sent on completion, so a tampered file ends `failed`.
 */
export async function sha256Hex(file: Blob): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}
