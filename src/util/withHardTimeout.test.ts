import { afterEach, describe, expect, it, vi } from 'vitest';
import { withHardTimeout } from 'app/util/withHardTimeout.js';

const HARD_TIMEOUT_ERROR = 'Hard timeout exceeded';

const neverSettles = () => new Promise<never>(() => {});
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A task that the timeout cleanup can make fail or succeed, like a render whose page gets closed. */
function controllableTask<T>() {
	let succeed: (value: T) => void = () => {};
	let fail: (error: Error) => void = () => {};
	const promise = new Promise<T>((resolve, reject) => {
		succeed = resolve;
		fail = reject;
	});
	return { promise, succeed, fail };
}

describe('withHardTimeout', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns the result of a task that finishes in time, without cleanup', async () => {
		const onTimeout = vi.fn(async () => {});
		await expect(withHardTimeout(Promise.resolve('rendered'), 20, onTimeout)).resolves.toBe('rendered');
		await sleep(40);
		expect(onTimeout).not.toHaveBeenCalled();
	});

	it('passes on the error of a task that fails in time, without cleanup', async () => {
		const onTimeout = vi.fn(async () => {});
		await expect(withHardTimeout(Promise.reject(new Error('HTTP 404')), 20, onTimeout)).rejects.toThrow('HTTP 404');
		await sleep(40);
		expect(onTimeout).not.toHaveBeenCalled();
	});

	it('runs the cleanup and reports the hard timeout when the task takes too long', async () => {
		const onTimeout = vi.fn(async () => {});
		await expect(withHardTimeout(neverSettles(), 10, onTimeout)).rejects.toThrow(HARD_TIMEOUT_ERROR);
		expect(onTimeout).toHaveBeenCalledOnce();
	});

	it('reports the hard timeout even when the cleanup makes the task fail first', async () => {
		const task = controllableTask<string>();
		const onTimeout = async () => {
			task.fail(new Error('Target page, context or browser has been closed'));
			await sleep(10);
		};
		await expect(withHardTimeout(task.promise, 10, onTimeout)).rejects.toThrow(HARD_TIMEOUT_ERROR);
	});

	it('reports the hard timeout even when the task finishes while the cleanup runs', async () => {
		const task = controllableTask<string>();
		const onTimeout = async () => {
			task.succeed('rendered too late');
			await sleep(10);
		};
		await expect(withHardTimeout(task.promise, 10, onTimeout)).rejects.toThrow(HARD_TIMEOUT_ERROR);
	});

	it('settles only after the cleanup has finished', async () => {
		const task = controllableTask<string>();
		let cleanupFinished = false;
		const onTimeout = async () => {
			task.fail(new Error('Target page, context or browser has been closed'));
			await sleep(10);
			cleanupFinished = true;
		};
		await withHardTimeout(task.promise, 10, onTimeout).catch(() => undefined);
		expect(cleanupFinished).toBe(true);
	});

	it('still reports the hard timeout when the cleanup fails, logging the cleanup error', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const cleanupError = new Error('Screenshot failed');
		const onTimeout = async () => {
			throw cleanupError;
		};
		await expect(withHardTimeout(neverSettles(), 10, onTimeout)).rejects.toThrow(HARD_TIMEOUT_ERROR);
		expect(warn).toHaveBeenCalledExactlyOnceWith('Error in onTimeout() - will be ignored', cleanupError);
	});
});
