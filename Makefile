.PHONY: setup install build check test test-mcp format dev migrate-local deploy typegen

CF_D1_DATABASE_ID ?=

setup:
	@test -f .dev.vars || cp .dev.vars.example .dev.vars

install:
	npm ci

build:
	npm run build

check:
	npm run check
	npm run build
	uv run ruff check scripts
	uv run ruff format --check scripts
	uv run ty check scripts

test:
	npm test -- --run
	uv run pytest

test-mcp:
	node scripts/test_mcp.mjs

format:
	uv run ruff format scripts
	npx --yes prettier@3.6.2 --write frontend src test scripts/*.mjs package.json tsconfig.json cloudflare.config.ts vite.config.ts vitest.config.mts wrangler.example.jsonc README.md

dev:
	npm run dev

migrate-local:
	@test -n "$(CF_D1_DATABASE_ID)" || (echo "Set CF_D1_DATABASE_ID to the D1 database ID" && exit 1)
	cf d1 migrations apply "$(CF_D1_DATABASE_ID)" --local

deploy:
	npm run deploy

typegen:
	npm run cf-typegen
