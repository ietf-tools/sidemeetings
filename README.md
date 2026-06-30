# Side Meetings

This is a fully featured side meetings management app for the IETF secretariat.

## Setup

### Using VS Code _(recommended)_

Open the project in dev container

#### Installation

1. Create a copy of `.env.sample` to `.env` and set the values. REMOVE the variable `DATABASE_URL` from the file, this is already set and handled by the devcontainer.
2. From the integrated terminal, run `npm install`
3. Run `npm run db:migrate`

#### Usage

1. Run `npm run dev:backend`
2. In a separate terminal (use the split view), run `npm run dev:frontend`
3. Open http://localhost:3000/ in a browser

### Generic

#### Requirements

- **Node.js 26.x**
- **PostgreSQL 18**

#### Installation

1. Setup an empty PostgreSQL database
2. Create a copy of `.env.sample` to `.env` and set the values.
3. Install npm dependencies using `npm install`
4. Run `npm run db:migrate`

#### Usage

1. Run `npm run dev:backend`
2. In a separate terminal, run `npm run dev:frontend`
3. Open http://localhost:3000/ in a browser

## Build for production

```sh
npm run build
```
