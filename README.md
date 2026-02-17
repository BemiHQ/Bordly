# Bordly

## Tech stack

- Frontend: React, TanStack, TailwindCSS, Shadcn, Lucide React, Vite, Tiptap
- Backend: Node.js, Fastify, Mastra, MikroORM, Pg Boss, PostgreSQL, AWS SES/S3
- Common: TypeScript, tRPC
- Development: Nginx, Biome

## Configuration

Copy and customize `.env` files:

```
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Add to `/etc/hosts`:

```
127.0.0.1	api.bordly.dev
127.0.0.1	app.bordly.dev
```

To regenerate SSL certificates, run:

```
cd devbox.d/nginx && mkcert app.bordly.dev && mkcert api.bordly.dev
```

## Running the application

```
make init
make up-services
make install
make create
make up
```

Open [app.bordly.dev](https://app.bordly.dev) in your browser.
