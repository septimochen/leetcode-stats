import type { LeetCodeStats } from "./leetcode";

export async function saveStats(
    db: D1Database,
    stats: LeetCodeStats,
    date: string,
): Promise<void> {
    await db
        .prepare(`
			INSERT INTO stats (
				username,
				date,
				ranking,
				reputation,
				total_solved,
				easy_solved,
				medium_solved,
				hard_solved,
				total_problems,
				easy_problems,
				medium_problems,
				hard_problems,
				contest_rating,
				contest_global_ranking
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(username, date)
			DO UPDATE SET
				ranking = excluded.ranking,
				reputation = excluded.reputation,
				total_solved = excluded.total_solved,
				easy_solved = excluded.easy_solved,
				medium_solved = excluded.medium_solved,
				hard_solved = excluded.hard_solved,
				total_problems = excluded.total_problems,
				easy_problems = excluded.easy_problems,
				medium_problems = excluded.medium_problems,
				hard_problems = excluded.hard_problems,
				contest_rating = excluded.contest_rating,
				contest_global_ranking =
					excluded.contest_global_ranking
		`)
        .bind(
            stats.username,
            date,
            stats.ranking,
            stats.reputation,
            stats.totalSolved,
            stats.easySolved,
            stats.mediumSolved,
            stats.hardSolved,
            stats.totalProblems ?? null,
            stats.easyProblems ?? null,
            stats.mediumProblems ?? null,
            stats.hardProblems ?? null,
            stats.contestRating,
            stats.contestGlobalRanking,
        )
        .run();
}

export async function getLatestStats(
    db: D1Database,
    username: string,
) {
    return db
        .prepare(
            "SELECT * FROM stats WHERE username = ? LIMIT 1",
        )
        .bind(username)
        .first();
}

export async function getAllStats(
    db: D1Database,
    username: string,
) {
    console.log("querying D1:", username);

    const result = await db
        .prepare("SELECT * FROM stats WHERE username = ?")
        .bind(username)
        .all();

    console.log("D1 query completed");

    return result.results;
}
export async function saveAcSubmissions(db: D1Database, submissions: import("./leetcode").AcSubmission[]): Promise<number> {
    let inserted = 0;
    // Keep batches bounded for large historical imports.
    for (let offset = 0; offset < submissions.length; offset += 100) {
        const statements = submissions.slice(offset, offset + 100).map(submission => db
            .prepare("INSERT INTO ac_submissions (title, titleSlug, timestamp) VALUES (?, ?, ?) ON CONFLICT(titleSlug) DO NOTHING")
            .bind(submission.title, submission.titleSlug, submission.timestamp));
        const results = await db.batch(statements);
        inserted += results.reduce((total, result) => total + (result.meta.changes ?? 0), 0);
    }
    return inserted;
}

export async function getRecentAcSubmissions(db: D1Database) {
    const result = await db.prepare("SELECT title, titleSlug, timestamp FROM ac_submissions ORDER BY timestamp DESC, titleSlug ASC LIMIT 15").all();
    return result.results;
}
