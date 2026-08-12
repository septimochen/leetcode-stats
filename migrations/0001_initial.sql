CREATE TABLE stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    username TEXT NOT NULL,

    date TEXT NOT NULL,

    ranking INTEGER,
    reputation INTEGER,

    total_solved INTEGER NOT NULL DEFAULT 0,
    easy_solved INTEGER NOT NULL DEFAULT 0,
    medium_solved INTEGER NOT NULL DEFAULT 0,
    hard_solved INTEGER NOT NULL DEFAULT 0,

    contest_rating REAL,
    contest_global_ranking INTEGER,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(username, date)
);

CREATE INDEX idx_stats_username_date
ON stats(username, date);

CREATE INDEX idx_stats_date
ON stats(date);