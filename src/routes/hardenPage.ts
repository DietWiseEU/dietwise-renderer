/**
 * Runs in every document of a rendering context before any page script: clears storage left over
 * from earlier visits and disables browser APIs that need user permission.
 * Playwright serializes this function into the browser, so it must not reference anything outside its body.
 */
export function hardenPage() {
	const clearBrowserState = () => {
		try {
			window.localStorage.clear();
		} catch (_) {
			// Intentionally blank
		}
		try {
			window.sessionStorage.clear();
		} catch (_) {
			// Intentionally blank
		}
		// Opaque origins (about:blank, data:) have no IndexedDB access, and calling databases() there makes
		// Chromium report an unhandled rejection even though the returned promise is handled
		if (window.origin !== 'null') {
			void indexedDB
				.databases?.()
				.then((databases) =>
					Promise.all(
						databases
							.map((database) => database.name)
							.filter((name): name is string => typeof name === 'string')
							.map((name) => indexedDB.deleteDatabase(name)),
					),
				)
				.catch(() => undefined);
		}
		// CacheStorage exists only in secure contexts
		if ('caches' in window) {
			void caches
				.keys()
				.then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
				.catch(() => undefined);
		}
	};

	clearBrowserState();
	window.addEventListener('beforeunload', clearBrowserState);

	const denied = 'denied';
	const notAllowed = (name: string) =>
		Object.assign(new Error(`${name} is disabled in this browser context`), {
			name: 'NotAllowedError',
		});

	if ('Notification' in window) {
		Object.defineProperty(Notification, 'permission', {
			configurable: true,
			get: () => denied,
		});
		Notification.requestPermission = async () => denied;
	}

	if ('geolocation' in navigator) {
		const geolocationError = () => {
			throw notAllowed('Geolocation');
		};
		navigator.geolocation.getCurrentPosition = ((success, error) => {
			error?.({
				code: 1,
				message: 'Geolocation is disabled in this browser context',
				PERMISSION_DENIED: 1,
				POSITION_UNAVAILABLE: 2,
				TIMEOUT: 3,
			});
			if (!error) geolocationError();
		}) as Geolocation['getCurrentPosition'];
		navigator.geolocation.watchPosition = ((success, error) => {
			error?.({
				code: 1,
				message: 'Geolocation is disabled in this browser context',
				PERMISSION_DENIED: 1,
				POSITION_UNAVAILABLE: 2,
				TIMEOUT: 3,
			});
			if (!error) geolocationError();
			return 0;
		}) as Geolocation['watchPosition'];
	}

	if ('mediaDevices' in navigator && navigator.mediaDevices) {
		navigator.mediaDevices.getUserMedia = async () => {
			throw notAllowed('getUserMedia');
		};
		navigator.mediaDevices.getDisplayMedia = async () => {
			throw notAllowed('getDisplayMedia');
		};
	}

	if ('clipboard' in navigator && navigator.clipboard) {
		navigator.clipboard.read = async () => {
			throw notAllowed('Clipboard read');
		};
		navigator.clipboard.readText = async () => {
			throw notAllowed('Clipboard readText');
		};
		navigator.clipboard.write = async () => {
			throw notAllowed('Clipboard write');
		};
		navigator.clipboard.writeText = async () => {
			throw notAllowed('Clipboard writeText');
		};
	}
}
