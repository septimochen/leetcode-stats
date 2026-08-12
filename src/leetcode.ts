export interface LeetCodeStats {
    username: string;

    ranking: number | null;
    reputation: number | null;

    totalSolved: number;
    easySolved: number;
    mediumSolved: number;
    hardSolved: number;

    contestRating: number | null;
    contestGlobalRanking: number | null;
}

interface LeetCodeResponse {
    data?: {
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

    const easySolved = getSolved("Easy");
    const mediumSolved = getSolved("Medium");
    const hardSolved = getSolved("Hard");

    return {
        username: user.username,

        ranking: user.profile?.ranking ?? null,
        reputation: user.profile?.reputation ?? null,

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