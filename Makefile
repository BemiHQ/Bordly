sh:
	devbox shell

install:
	devbox run "cd backend && pnpm install"

up:
	devbox run "cd backend && pnpm run dev"

build:
	devbox run "cd backend && pnpm run build"
