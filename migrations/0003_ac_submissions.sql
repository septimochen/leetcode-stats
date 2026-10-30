CREATE TABLE ac_submissions (
    title TEXT NOT NULL,
    titleSlug TEXT PRIMARY KEY NOT NULL,
    timestamp INTEGER NOT NULL
);

CREATE INDEX ac_submissions_timestamp ON ac_submissions(timestamp DESC);
