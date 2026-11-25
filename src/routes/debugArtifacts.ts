import path from 'node:path';

export interface DebugArtifactPaths {
	/** HAR recording of all requests the render made, with response bodies embedded */
	har: string;
	/** Full-page screenshot, taken when the render hits the hard timeout */
	screenshot: string;
}

/**
 * Where to save the debugging artifacts of one render, or `undefined` when no debug folder is configured.
 */
export function debugArtifactPaths(debugDir: string | undefined, renderId: number): DebugArtifactPaths | undefined {
	if (!debugDir) return undefined;
	return {
		har: path.join(debugDir, `${renderId}.har`),
		screenshot: path.join(debugDir, `${renderId}.png`),
	};
}
