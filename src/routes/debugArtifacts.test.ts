import { describe, expect, it } from 'vitest';
import { debugArtifactPaths } from 'app/routes/debugArtifacts.js';

describe('debugArtifactPaths', () => {
	it('returns nothing when no debug folder is configured', () => {
		expect(debugArtifactPaths(undefined, 1795635716873)).toBeUndefined();
		expect(debugArtifactPaths('', 1795635716873)).toBeUndefined();
	});

	it('names the HAR and the screenshot after the render, inside the debug folder', () => {
		expect(debugArtifactPaths('/var/debug', 1795635716873)).toEqual({
			har: '/var/debug/1795635716873.har',
			screenshot: '/var/debug/1795635716873.png',
		});
		expect(debugArtifactPaths('/var/debug/', 1795635716873)).toEqual({
			har: '/var/debug/1795635716873.har',
			screenshot: '/var/debug/1795635716873.png',
		});
	});
});
