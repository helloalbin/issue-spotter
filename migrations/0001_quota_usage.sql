-- Per-key daily usage counters. `key` is namespaced, e.g. "search:a:<anon id>" or "search:i:<ip hash>".
CREATE TABLE quota_usage (
	key TEXT NOT NULL,
	day TEXT NOT NULL,
	count INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (key, day)
);
