export interface Config {
	hardTimeoutMs: number;
	/** Folder for per-render debugging artifacts (HAR, timeout screenshot); nothing is saved when empty */
	debugDir?: string;
}
