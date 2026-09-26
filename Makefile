.PHONY: install build check test format dev migrate-local deploy typegen

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
	npx --yes prettier@3.6.2 --write frontend src test package.json tsconfig.json vite.config.ts vitest.config.mts wrangler.jsonc README.md

dev:
	npm run dev

migrate-local:
	npx wrangler d1 migrations apply leetcode-stats --local

deploy:
	npm run deploy

typegen:
	npm run cf-typegen
