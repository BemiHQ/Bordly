init:
	devbox install && \
		devbox run initdb && sed -i "s/#port = 5432/port = 5433/g" ./.devbox/virtenv/postgresql/data/postgresql.conf && \
		devbox run "cd devbox.d/nginx && mkcert bordly.dev && mkcert api.bordly.dev"

create:
	devbox run "createdb -p 5433 bordly_dev && createuser -p 5433 --superuser postgres" &&  make migrate && \
		devbox run "cd backend && pnpm run dev-configure-minio"

reset:
	devbox run "dropdb -p 5433 bordly_dev && createdb -p 5433 bordly_dev"

recreate: reset migrate

sh:
	devbox --env-file backend/.env shell

install:
	devbox run "cd backend && pnpm install && cd ../frontend && pnpm install"

up:
	pnpm run dev

up-backend:
	devbox run --env-file backend/.env "cd backend && pnpm run dev"

up-frontend:
	devbox run --env-file frontend/.env "cd frontend && pnpm run dev"

up-fetch-emails:
	devbox run --env-file backend/.env "cd backend && pnpm run fetch-emails"

up-services:
	devbox services start nginx postgresql minio

down-services:
	devbox services stop

test:
	devbox run --env-file frontend/.env "cd frontend && pnpm run test"

ps:
	devbox services ls

console:
	devbox run --env-file backend/.env "cd backend && pnpm run repl"

format:
	devbox run "pnpm run check"

check: format
	devbox run "cd backend && pnpm run build && \
		cd ../frontend && pnpm tsc --noEmit && \
		rm -rf ../backend/dist"

migrate:
	devbox run --env-file backend/.env "cd backend && pnpm run migrate"

rollback:
	devbox run --env-file backend/.env "cd backend && pnpm mikro-orm migration:down"

add-migration:
	devbox run --env-file backend/.env "cd backend && pnpm mikro-orm migration:create --name $$NAME"
