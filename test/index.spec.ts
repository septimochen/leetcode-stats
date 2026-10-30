import { env, fetchMock } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index";
import { fetchRecentAcSubmissions } from "../src/leetcode";
import { saveAcSubmissions } from "../src/db";
import initialSql from "../migrations/0001_initial.sql?raw";
import totalsSql from "../migrations/0002_problem_totals.sql?raw";
import submissionsSql from "../migrations/0003_ac_submissions.sql?raw";

const testEnv = { ...env, AC_IMPORT_TOKEN: "test-secret" };
const request = (method: string, body?: unknown, token = "test-secret") => new Request("https://example.com/api/ac-submissions", {
    method, headers: { Authorization: `Bearer ${token}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

beforeAll(async () => {
    for (const statement of initialSql.split(";").map(part => part.trim()).filter(Boolean)) await env.DB.prepare(statement).run();
    await env.DB.prepare("INSERT INTO stats (username, date, total_solved) VALUES ('alice', '2026-01-01', 10)").run();
    for (const sql of [totalsSql, submissionsSql]) {
        for (const statement of sql.split(";").map(part => part.trim()).filter(Boolean)) await env.DB.prepare(statement).run();
    }
});
beforeEach(async () => { await env.DB.prepare("DELETE FROM ac_submissions").run(); });

describe("accepted submissions", () => {
    it("preserves existing snapshots through the migration", async () => {
        const row = await env.DB.prepare("SELECT username, total_solved, total_problems FROM stats WHERE username = ?").bind("alice").first();
        expect(row).toEqual({ username: "alice", total_solved: 10, total_problems: null });
    });
    it("fetches and validates the LeetCode feed with the requested limit", async () => {
        fetchMock.activate();
        fetchMock.disableNetConnect();
        try {
            fetchMock.get("https://leetcode.com").intercept({ path: "/graphql", method: "POST", body: (body: string) => {
                const query = JSON.parse(body);
                return query.variables.username === "alice" && query.variables.limit === 20 && query.query.includes("recentAcSubmissionList");
            } }).reply(200, { data: { recentAcSubmissionList: [{ title: "Two Sum", titleSlug: "two-sum", timestamp: "123" }] } });
            expect(await fetchRecentAcSubmissions("alice")).toEqual([{ title: "Two Sum", titleSlug: "two-sum", timestamp: 123 }]);
        } finally { fetchMock.deactivate(); }
    });

    it("merges duplicates without overwriting and returns only the latest 15", async () => {
        const original = Array.from({ length: 17 }, (_, i) => ({ title: `Problem ${i}`, titleSlug: `problem-${i}`, timestamp: i + 1 }));
        expect(await saveAcSubmissions(env.DB, original)).toBe(17);
        expect(await saveAcSubmissions(env.DB, [{ title: "Changed", titleSlug: "problem-16", timestamp: 999 }])).toBe(0);
        const result = await worker.fetch(request("GET"), testEnv);
        const rows = await result.json() as typeof original;
        expect(rows).toHaveLength(15);
        expect(rows[0]).toEqual(original[16]);
        expect(rows.at(-1)).toEqual(original[2]);
    });

    it("requires authorization and validates the complete import before writing", async () => {
        const rows = [{ title: "Two Sum", titleSlug: "two-sum", timestamp: "123" }];
        expect((await worker.fetch(request("POST", rows, "wrong"), testEnv)).status).toBe(401);
        expect((await worker.fetch(request("POST", rows), { ...testEnv, AC_IMPORT_TOKEN: "" })).status).toBe(503);
        expect((await worker.fetch(request("POST", [...rows, { title: "Bad", titleSlug: "../bad", timestamp: 1 }]), testEnv)).status).toBe(400);
        expect(await (await worker.fetch(request("GET"), testEnv)).json()).toEqual([]);
        const first = await worker.fetch(request("POST", rows), testEnv);
        expect(await first.json()).toEqual({ inserted: 1, skipped: 0 });
        expect(await (await worker.fetch(request("POST", rows), testEnv)).json()).toEqual({ inserted: 0, skipped: 1 });
    });
});
