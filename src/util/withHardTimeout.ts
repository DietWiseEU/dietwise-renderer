export async function withHardTimeout<T>(
	task: Promise<T>,
	timeoutMs: number,
	onTimeout: () => Promise<void>,
): Promise<T> {
	let timeoutHandle: NodeJS.Timeout;
	let timedOut = false;

	const timeoutPromise = new Promise<never>((_, reject) => {
		timeoutHandle = setTimeout(async () => {
			timedOut = true;
			try {
				await onTimeout();
			} catch (e) {
				// ignore cleanup errors, but log them for completeness
				console.warn('Error in onTimeout() - will be ignored', e);
			}
			reject(new Error('Hard timeout exceeded'));
		}, timeoutMs);
	});

	try {
		const result = await Promise.race([task, timeoutPromise]);
		if (!timedOut) return result;
	} catch (err) {
		if (!timedOut) throw err;
	} finally {
		clearTimeout(timeoutHandle!);
	}
	// The cleanup typically makes the task settle early (e.g. by closing its page); whatever the task did,
	// report the timeout, and only once the cleanup has finished
	return timeoutPromise;
}
