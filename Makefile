sh:
	devbox shell

install:
	devbox run "cd backend && pnpm install && cd ../frontend && pnpm install"

up:
	devbox run "pnpm exec concurrently -n backend,frontend -c blue,magenta 'cd backend && pnpm run dev' 'cd frontend && pnpm run dev'"

build:
	devbox run "cd backend && pnpm run build && cd ../frontend && pnpm run build"
