sh:
	devbox shell

install:
	devbox run "cd backend && pnpm install && cd ../frontend && pnpm install"

up:
	devbox run "pnpm run dev"

build:
	devbox run "cd backend && pnpm run build && cd ../frontend && pnpm run build"

check:
	devbox run "pnpm run check"
