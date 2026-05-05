# Survivor Pick'em — Workspace

## Overview

Full-stack multiplayer Survivor TV show guessing game. Admin manages games, contestants, and weekly questions. Players make Survivor picks and answer weekly questions. 15-week progression with automatic scoring and a leaderboard.

pnpm monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec → `lib/api-spec/openapi.yaml`)
- **Build**: esbuild (CJS bundle)
- **Auth**: Clerk (via `@clerk/react` + `@clerk/express`)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + wouter routing
- **Query layer**: TanStack React Query (hooks from `@workspace/api-client-react`)

## Artifacts

| Artifact | Path | Port |
|---|---|---|
| `artifacts/survivor-game` | `/` | `$PORT` (Vite dev) |
| `artifacts/api-server` | `/api` | 8080 |

## Object Storage

Replit-managed bucket for contestant headshots and other uploaded assets.

- Server lib: `artifacts/api-server/src/lib/objectStorage.ts` + `objectAcl.ts` (copied from object-storage skill template).
- Server routes: `artifacts/api-server/src/routes/storage.ts` mounts:
  - `POST /api/storage/uploads/request-url` — returns presigned upload URL (auth-guarded with `requireAuth`).
  - `GET /api/storage/objects/*path` — serves uploaded private objects (no ACL check; treated as public game assets).
  - `GET /api/storage/public-objects/*path` — serves public assets.
- Frontend lib: `lib/object-storage-web` exports `useUpload()` hook (Uppy-based).
- Image URL pattern: `<img src={`/api/storage${contestant.headshotPath}`} />`. `headshotPath` already starts with `/objects/...`.
- Required env: `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Project Structure

```
lib/
  api-spec/       openapi.yaml + Orval config (source of truth for API shape)
  api-zod/        Zod validators generated from OpenAPI spec
  api-client-react/ TanStack Query React hooks generated from OpenAPI spec
  db/             Drizzle schema + db client (PostgreSQL)

artifacts/
  api-server/     Express 5 REST API
    src/routes/
      users.ts      GET /users/me, PATCH /users/me/role
      games.ts      CRUD games, GET /games/:id/stats
      contestants.ts  CRUD contestants per game
      weeks.ts      CRUD weeks per game
      questions.ts  CRUD questions + choices per week
      answers.ts    player-answers, correct-answers, survivor-picks, survivor-winner
      leaderboard.ts GET /games/:id/leaderboard
  survivor-game/  React + Vite frontend
    src/pages/
      dashboard.tsx   Player dashboard (weekly questions, leaderboard sidebar, picks)
      admin.tsx       Admin control center (game/contestant/week/question management, headshot uploads)
      onboarding.tsx  Role selection + survivor picks after registration
      leaderboard.tsx Full leaderboard with weekly breakdown
      contestants.tsx Player-facing contestants page (grid of headshots + names)
    src/components/
      nav.tsx         Top navigation bar (authenticated)
```

## Database Schema

Tables: `users`, `games`, `contestants`, `weeks`, `questions`, `choices`, `correct_answers`, `player_answers`, `survivor_picks`

- Enum: `role` (admin | player), `game_status` (setup | active | completed)
- Weeks: `is_open` / `is_locked` flags drive the game flow
- Scoring: `player_answers.is_correct` set when admin submits correct answers
- Survivor scoring: `firstPickPoints`/`secondPickPoints` for picking the winner; `firstPickTopThreePoints`/`secondPickTopThreePoints` for pick landing in Final 3 but not winning. Both picks scored independently.

## Game Flow

1. Admin creates game → adds contestants → creates Week 1 (auto-opens)
2. Players register → choose role → make Survivor picks (first/second winner choice)
3. Players answer open week questions from dropdown choices, save
4. Admin submits correct answers → week locks, scoring auto-calculated, next week opens
5. Repeat for 15 weeks. Admin selects Final 3 (3 finalists) + winner from those 3 → game completed, scoring applied
6. Players can only interact with open (unlocked) weeks

## Auth

- Clerk-managed. `requireAuth` middleware reads Clerk session from Express routes.
- Frontend uses `ClerkProvider` with wouter routing bridge.
- `useGetMe` auto-creates DB user on first authenticated call.
- Proxy path: `/api/__clerk`

## Codegen Fix

After running Orval, the script overwrites `lib/api-zod/src/index.ts` to only export from `./generated/api` (avoids duplicate export collision between api and types barrels).
