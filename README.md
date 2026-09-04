# Ragnorosis

A grand-strategy game based on the Ragnorosis novels.

## Design docs

- [`docs/ragnorosis_gdd.md`](docs/ragnorosis_gdd.md) — full Game Design Document
- [`docs/epoch1-implementation-skeleton.md`](docs/epoch1-implementation-skeleton.md) — Epoch 1 implementation spec

## Stack

Vite + React + TypeScript, Tailwind CSS, Zustand, Vitest.

The simulation core (`src/sim`) is kept independent of React — region/time/economy logic
lives there as plain, unit-tested TypeScript, and the UI (`src/components`) renders it.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — type-check and build for production
- `npm run test` — run the test suite once
- `npm run test:watch` — run tests in watch mode
- `npm run lint` — lint with oxlint
- `npm run format` — format with Prettier
