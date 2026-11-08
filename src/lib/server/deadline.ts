/**
 * Time limits for one call to the model provider: it must keep making progress (`idleMs` without a
 * response or a new chunk is a stall) and must finish within `totalMs`. Pass `signal` to `fetch`;
 * call `touch()` whenever data arrives; call `dispose()` when done so no timer outlives the call.
 * An abort from `parent` (the user pressing Stop) passes through and is not reported as a timeout.
 */
export class Deadline {
	readonly signal: AbortSignal;
	/** Why the limit fired, or null if it has not. */
	reason: 'idle' | 'total' | null = null;

	#controller = new AbortController();
	#idleMs: number;
	#idleTimer: ReturnType<typeof setTimeout> | undefined;
	#totalTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(idleMs: number, totalMs: number, parent?: AbortSignal) {
		this.#idleMs = idleMs;
		this.signal = parent ? AbortSignal.any([parent, this.#controller.signal]) : this.#controller.signal;
		this.#totalTimer = setTimeout(() => this.#expire('total'), totalMs);
		this.touch();
	}

	get timedOut(): boolean {
		return this.reason !== null;
	}

	/** Progress was made, so the idle clock starts again. */
	touch() {
		clearTimeout(this.#idleTimer);
		this.#idleTimer = setTimeout(() => this.#expire('idle'), this.#idleMs);
	}

	dispose() {
		clearTimeout(this.#idleTimer);
		clearTimeout(this.#totalTimer);
	}

	#expire(reason: 'idle' | 'total') {
		this.reason = reason;
		this.dispose();
		this.#controller.abort(new Error(`Model provider ${reason} timeout`));
	}
}
