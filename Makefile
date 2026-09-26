.PHONY: setup install build check test format dev migrate-local deploy typegen

setup:
	@test -f wrangler.jsonc || cp wrangler.example.jsonc wrangler.jsonc
	@test -f .dev.vars || cp .dev.vars.example .dev.vars

install:
	npm ci

build:
	npm run build

check:
	npm run check
	npm run build

test:
	npm test -- --run

format:
	npx --yes prettier@3.6.2 --write frontend src test package.json tsconfig.json vite.config.ts vitest.config.mts wrangler.example.jsonc README.md

dev:
	npm run dev

migrate-local:
	npx wrangler d1 migrations apply leetcode-stats --local

deploy:
	npm run deploy

typegen:
	npm run cf-typegen
