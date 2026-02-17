sh:
	devbox shell

install:
	devbox run "cd backend && pnpm install && cd ../frontend && pnpm install"

up:
	pnpm run dev

up-backend:
	devbox run --env-file backend/.env "cd backend && pnpm run dev"

up-frontend:
	devbox run "cd frontend && pnpm run dev"

build:
	devbox run "cd backend && pnpm run build && cd ../frontend && pnpm run build"

check:
	devbox run "pnpm run check"
