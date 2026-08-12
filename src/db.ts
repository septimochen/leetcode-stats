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
				contest_rating,
				contest_global_ranking
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(username, date)
			DO UPDATE SET
				ranking = excluded.ranking,
				reputation = excluded.reputation,
				total_solved = excluded.total_solved,
				easy_solved = excluded.easy_solved,
				medium_solved = excluded.medium_solved,
				hard_solved = excluded.hard_solved,
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