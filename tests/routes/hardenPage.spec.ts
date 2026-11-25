import { test, expect, type BrowserContext } from '@playwright/test';
import { hardenPage } from 'app/routes/hardenPage.js';

const RECIPE_HTML = '<!doctype html><title>Recipe</title><p>Recipe</p>';

const OPAQUE_URL = `data:text/html,${RECIPE_HTML}`;
const INSECURE_URL = 'http://recipe.test/';
const SECURE_URL = 'https://recipe.test/';

/**
 * Opens a page the way the render route does: init script first, then a new page (which starts on
 * about:blank), then navigation. Errors are collected from the very first document onwards.
 */
async function openHardenedPage(context: BrowserContext, url: string) {
	const pageErrors: string[] = [];
	context.on('weberror', (webError) => pageErrors.push(webError.error().message));
	await context.route(/^https?:\/\/recipe\.test\//, (route) =>
		route.fulfill({ contentType: 'text/html', body: RECIPE_HTML }),
	);
	await context.addInitScript(hardenPage);
	const page = await context.newPage();
	await page.goto(url);
	return { page, pageErrors };
}

for (const url of [OPAQUE_URL, INSECURE_URL, SECURE_URL]) {
	const origin = url.startsWith('data:') ? 'opaque' : url.startsWith('http:') ? 'insecure' : 'secure';

	test.describe(`hardenPage on ${origin} origins`, () => {
		test('runs without page errors', async ({ context }) => {
			const { page, pageErrors } = await openHardenedPage(context, url);
			// Unhandled promise rejections are reported asynchronously
			await page.waitForTimeout(500);
			expect(pageErrors).toEqual([]);
		});

		test('disables geolocation', async ({ context }) => {
			const { page } = await openHardenedPage(context, url);
			const outcome = await page.evaluate(
				() =>
					new Promise<string>((resolve) =>
						navigator.geolocation.getCurrentPosition(
							() => resolve('position granted'),
							(error) => resolve(error.message),
						),
					),
			);
			expect(outcome).toBe('Geolocation is disabled in this browser context');
		});
	});
}

for (const url of [INSECURE_URL, SECURE_URL]) {
	test(`hardenPage clears storage left by an earlier visit to ${url}`, async ({ context }) => {
		const { page } = await openHardenedPage(context, url);
		await page.evaluate(async () => {
			localStorage.setItem('visited', 'yes');
			sessionStorage.setItem('visited', 'yes');
			await new Promise((resolve, reject) => {
				const request = indexedDB.open('leftover');
				request.onsuccess = () => {
					request.result.close();
					resolve(undefined);
				};
				request.onerror = () => reject(request.error);
			});
			if (isSecureContext) await caches.open('leftover');
		});

		await page.reload();

		await expect
			.poll(() =>
				page.evaluate(async () => ({
					localStorage: localStorage.length,
					sessionStorage: sessionStorage.length,
					indexedDB: (await indexedDB.databases()).length,
					caches: isSecureContext ? (await caches.keys()).length : 0,
				})),
			)
			.toEqual({ localStorage: 0, sessionStorage: 0, indexedDB: 0, caches: 0 });
	});
}

test('hardenPage disables notifications, media capture and clipboard on a secure origin', async ({ context }) => {
	const { page } = await openHardenedPage(context, SECURE_URL);
	const outcomes = await page.evaluate(async () => {
		const outcomeOf = (call: () => Promise<unknown>) =>
			call().then(
				() => 'allowed',
				(error: Error) => `${error.name}: ${error.message}`,
			);
		return {
			notificationPermission: Notification.permission,
			notificationRequest: await Notification.requestPermission(),
			getUserMedia: await outcomeOf(() => navigator.mediaDevices.getUserMedia({ video: true })),
			getDisplayMedia: await outcomeOf(() => navigator.mediaDevices.getDisplayMedia()),
			clipboardRead: await outcomeOf(() => navigator.clipboard.read()),
			clipboardReadText: await outcomeOf(() => navigator.clipboard.readText()),
			clipboardWrite: await outcomeOf(() => navigator.clipboard.write([])),
			clipboardWriteText: await outcomeOf(() => navigator.clipboard.writeText('x')),
		};
	});
	expect(outcomes).toEqual({
		notificationPermission: 'denied',
		notificationRequest: 'denied',
		getUserMedia: 'NotAllowedError: getUserMedia is disabled in this browser context',
		getDisplayMedia: 'NotAllowedError: getDisplayMedia is disabled in this browser context',
		clipboardRead: 'NotAllowedError: Clipboard read is disabled in this browser context',
		clipboardReadText: 'NotAllowedError: Clipboard readText is disabled in this browser context',
		clipboardWrite: 'NotAllowedError: Clipboard write is disabled in this browser context',
		clipboardWriteText: 'NotAllowedError: Clipboard writeText is disabled in this browser context',
	});
});
