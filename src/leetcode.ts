export interface LeetCodeStats {
    username: string;

    ranking: number | null;
    reputation: number | null;

    totalSolved: number;
    easySolved: number;
    mediumSolved: number;
    hardSolved: number;

    totalProblems: number;
    easyProblems: number;
    mediumProblems: number;
    hardProblems: number;

    contestRating: number | null;
    contestGlobalRanking: number | null;
}

interface LeetCodeResponse {
    data?: {
        allQuestionsCount?: Array<{ difficulty: string; count: number }>;
        matchedUser?: {
            username: string;
            profile?: {
                ranking?: number | null;
                reputation?: number | null;
            };
            submitStats?: {
                acSubmissionNum?: Array<{
                    difficulty: string;
                    count: number;
                }>;
            };
        };

        userContestRanking?: {
            rating?: number | null;
            globalRanking?: number | null;
        } | null;
    };

    errors?: Array<{
        message: string;
    }>;
}

const QUERY = `
query UserStats($username: String!) {
    allQuestionsCount {
        difficulty
        count
    }
	matchedUser(username: $username) {
		username

		profile {
			ranking
			reputation
		}

		submitStats {
			acSubmissionNum {
				difficulty
				count
			}
		}
	}

	userContestRanking(username: $username) {
		rating
		globalRanking
	}
}
`;

export async function fetchLeetCodeStats(
    username: string,
): Promise<LeetCodeStats> {
    const response = await fetch("https://leetcode.com/graphql", {
        method: "POST",

        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "leetcode-stats-worker/1.0",
        },

        body: JSON.stringify({
            query: QUERY,
            variables: {
                username,
            },
        }),
    });

    if (!response.ok) {
        throw new Error(
            `LeetCode request failed: ${response.status} ${response.statusText}`,
        );
    }

    const body = (await response.json()) as LeetCodeResponse;

    if (body.errors?.length) {
        throw new Error(
            `LeetCode GraphQL error: ${body.errors
                .map((error) => error.message)
                .join(", ")}`,
        );
    }

    const user = body.data?.matchedUser;

    if (!user) {
        throw new Error(`LeetCode user not found: ${username}`);
    }

    const submissions = user.submitStats?.acSubmissionNum ?? [];

    const getSolved = (difficulty: string): number => {
        return (
            submissions.find(
                (item) => item.difficulty === difficulty,
            )?.count ?? 0
        );
    };

    const getTotal = (difficulty: string): number => {
        const count = body.data?.allQuestionsCount?.find((item) => item.difficulty === difficulty)?.count;
        if (count == null || !Number.isInteger(count) || count <= 0) {
            throw new Error(`Missing or invalid LeetCode problem total: ${difficulty}`);
        }
        return count;
    };

    const easySolved = getSolved("Easy");
    const mediumSolved = getSolved("Medium");
    const hardSolved = getSolved("Hard");

    return {
        username: user.username,

        ranking: user.profile?.ranking ?? null,
        reputation: user.profile?.reputation ?? null,

        totalProblems: getTotal("All"),
        easyProblems: getTotal("Easy"),
        mediumProblems: getTotal("Medium"),
        hardProblems: getTotal("Hard"),

        easySolved,
        mediumSolved,
        hardSolved,
        totalSolved: easySolved + mediumSolved + hardSolved,

        contestRating:
            body.data?.userContestRanking?.rating ?? null,

        contestGlobalRanking:
            body.data?.userContestRanking?.globalRanking ?? null,
    };
}
export interface AcSubmission {
    title: string;
    titleSlug: string;
    timestamp: number;
}

// LeetCode returns timestamps as Unix seconds encoded as strings.
export function parseAcSubmission(value: unknown): AcSubmission | null {
    if (typeof value !== "object" || value === null) return null;
    const record = value as Record<string, unknown>;
    const timestamp = typeof record.timestamp === "string" && /^\d+$/.test(record.timestamp)
        ? Number(record.timestamp) : record.timestamp;
    if (typeof record.title !== "string" || !record.title.trim() || record.title.length > 500 ||
        typeof record.titleSlug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.titleSlug) || record.titleSlug.length > 300 ||
        typeof timestamp !== "number" || !Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp > 8640000000000) return null;
    return { title: record.title, titleSlug: record.titleSlug, timestamp };
}

export async function fetchRecentAcSubmissions(username: string): Promise<AcSubmission[]> {
    const response = await fetch("https://leetcode.com/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "leetcode-stats-worker/1.0" },
        body: JSON.stringify({
            query: `query recentAcSubmissions($username: String!, $limit: Int!) {
                recentAcSubmissionList(username: $username, limit: $limit) { title titleSlug timestamp }
            }`,
            variables: { username, limit: 20 },
        }),
    });
    if (!response.ok) throw new Error(`LeetCode request failed: ${response.status} ${response.statusText}`);
    const body = await response.json() as { data?: { recentAcSubmissionList?: unknown }; errors?: Array<{ message: string }> };
    if (body.errors?.length) throw new Error(`LeetCode GraphQL error: ${body.errors.map(error => error.message).join(", ")}`);
    const list = body.data?.recentAcSubmissionList;
    if (!Array.isArray(list)) throw new Error("Missing recent accepted submissions from LeetCode");
    return list.map(item => {
        const submission = parseAcSubmission(item);
        if (!submission) throw new Error("Invalid accepted submission from LeetCode");
        return submission;
    });
}
