init:
	devbox install && \
	devbox run initdb && \
		sed -i "s/#port = 5432/port = 5433/g" ./.devbox/virtenv/postgresql/data/postgresql.conf

create:
	devbox run "createdb -p 5433 bordly_dev && createuser -p 5433 --superuser postgres" &&  make migrate

drop:
	devbox run "dropdb -p 5433 bordly_dev && createdb -p 5433 bordly_dev"

reset: drop migrate

sh:
	devbox --env-file backend/.env shell

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

check:
	devbox run "pnpm run check"

build:
	devbox run "cd backend && pnpm run build && rm -rf dist && cd ../frontend && pnpm run build && rm -rf dist"

migrate:
	devbox run --env-file backend/.env "cd backend && pnpm mikro-orm migration:up"

rollback:
	devbox run --env-file backend/.env "cd backend && pnpm mikro-orm migration:down"

add-migration:
	devbox run --env-file backend/.env "cd backend && pnpm mikro-orm migration:create --name $$NAME"
