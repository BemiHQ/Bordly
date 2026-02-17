# Bordly

<img src="https://bordly.ai/images/logo.png" alt="Bordly Logo" width="80" />

**The AI-native email inbox you'll enjoy using.**

Bordly is an email client that reimagines your inbox as a collaborative board.
It blends powerful AI automation with an intuitive UI, enabling truly agentic assistance for you and your team.

---

## Why Bordly?

- ✅ **Free & open** – Completely open-source, no hidden features
- 🦾 **AI-native** – Built from the ground up with AI capabilities
- 📬 **Unified inbox** – Connect all your email accounts in one place
- 🙌 **Collaborative** – Designed for teams to work together
- 🔒 **Privacy-focused** – Your data stays yours, no tracking or selling
- 🎨 **Beautiful design** – Clean and intuitive interface
- 🚀 **Blazing fast** – Smooth experience with instant UX
- 🛠️ **Customizable** - Developer-friendly and extensible

## Screenshots

<div align="center">

#### Board View
![Bordly Board](https://bordly.ai/screenshots/board.png)

#### Card Details
![Bordly Card](https://bordly.ai/screenshots/card.png)

</div>

## Tech Stack

- **Frontend**: React, TanStack Router, TailwindCSS, Shadcn UI, Tiptap, Vite
- **Backend**: Node.js, Fastify, tRPC, Mastra, MikroORM, Pg Boss
- **Data**: Google OAuth, PostgreSQL, AWS S3 (or compatible)
- **Development**: TypeScript, Devbox (Nix), Nginx, Biome, Mkcert

## Getting Started

### Prerequisites

- [Pnpm](https://pnpm.io/)
- [Devbox](https://www.jetify.com/devbox)

### Quick Start

#### 1. Clone the Repository

```bash
git clone https://github.com/BemiHQ/Bordly.git
cd Bordly
```

#### 2. Initialize Development Environment

```bash
# Install Devbox and initialize environment
make init

# Start required services (PostgreSQL, MinIO, Nginx)
make up-services
```

#### 3. Configure Environment

Copy and customize the `.env` files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Add to `/etc/hosts` for local development:

```
127.0.0.1	bordly.dev
127.0.0.1	api.bordly.dev
```

#### 4. Install Dependencies & Setup Database

```bash
# Install all dependencies
make install

# Create database and run migrations
make create
```

#### 5. Start the Application

```bash
# Start both frontend and backend
make up
```

Open [https://bordly.dev](https://bordly.dev) in your browser.

## Available Commands

Bordly provides a comprehensive set of `make` commands for development:

### Development

```bash
make up              # Start the full application
make up-backend      # Start backend only
make up-frontend     # Start frontend only
make up-services     # Start PostgreSQL, MinIO, and Nginx
make down-services   # Stop all services
make ps              # List running services
```

### Database

```bash
make create          # Create database and run migrations
make migrate         # Run migrations
make rollback        # Rollback last migration
make add-migration   # Create new migration (use NAME=migration_name)
make reset           # Drop and recreate database
make recreate        # Reset database and run migrations
```

### Code Quality

```bash
make check           # Format, lint, and type-check the entire codebase
make format          # Format code with Biome
make test            # Run tests
```

### Utilities

```bash
make sh              # Open a shell in the Devbox environment
make console         # Open Node.js REPL console
```

## License

Distributed under the [AGPL-3.0 License](LICENSE). If you need to modify and distribute the code, please release it to contribute back to the open-source community.
