init:
	devbox install && \
	devbox run initdb && \
		sed -i "s/#port = 5432/port = 5433/g" ./.devbox/virtenv/postgresql/data/postgresql.conf

create:
	devbox run "createdb -p 5433 bordly_dev && createuser -p 5433 --superuser postgres"

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

up-services:
	devbox services start nginx postgresql

down-services:
	devbox services stop

ps:
	devbox services ls

build:
	devbox run "cd backend && pnpm run build && cd ../frontend && pnpm run build"

check:
	devbox run "pnpm run check"
