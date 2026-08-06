<div align="center">
  
<img src="https://static.ietf.org/logos/icon-sidemeetings.svg" alt="Side Meetings" height="125" />

# Side Meetings Website

[![Release](https://img.shields.io/github/release/ietf-tools/sidemeetings.svg?style=flat&maxAge=300)](https://github.com/ietf-tools/sidemeetings/releases)
[![License](https://img.shields.io/github/license/ietf-tools/sidemeetings)](https://github.com/ietf-tools/sidemeetings/blob/main/LICENSE)
[![Node Version](https://img.shields.io/badge/node.js-26.x-green?logo=node.js&logoColor=white)](#prerequisites)

##### A fully featured side meetings management app for the IETF secretariat.

</div>

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
