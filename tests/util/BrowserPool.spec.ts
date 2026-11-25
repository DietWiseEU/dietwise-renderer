import { test, expect } from '@playwright/test';
import { BrowserPool } from 'app/util/BrowserPool.js';

/** Collects console.error calls (BrowserPool reports disconnects there) instead of printing them. */
function captureConsoleErrors() {
	const originalConsoleError = console.error;
	const messages: unknown[][] = [];
	console.error = (...args: unknown[]) => {
		messages.push(args);
	};
	return {
		messages,
		restore: () => {
			console.error = originalConsoleError;
		},
	};
}

test('BrowserPool replaces a browser that disconnects unexpectedly', async () => {
	const pool = new BrowserPool(1);
	await pool.init();
	const consoleErrors = captureConsoleErrors();
	try {
		const original = pool.acquire();

		await original.close();

		await expect
			.poll(() => {
				try {
					const replacement = pool.acquire();
					return replacement !== original && replacement.isConnected();
				} catch {
					return false;
				}
			})
			.toBe(true);
		expect(consoleErrors.messages).toEqual([['Browser disconnected, replacing...']]);
	} finally {
		consoleErrors.restore();
		await pool.shutdown();
	}
});

test('BrowserPool does not replace the browsers it closes on shutdown', async () => {
	const pool = new BrowserPool(1);
	await pool.init();
	const consoleErrors = captureConsoleErrors();
	try {
		const original = pool.acquire();

		await pool.shutdown();
		// Long enough for a replacement browser to finish launching, if one were started
		await new Promise((resolve) => setTimeout(resolve, 2000));

		expect(original.isConnected()).toBe(false);
		expect(() => pool.acquire()).toThrow('No alive browsers available');
		expect(consoleErrors.messages).toEqual([]);
	} finally {
		consoleErrors.restore();
	}
});
