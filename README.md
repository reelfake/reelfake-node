# reelfake REST API

A Node.js REST API for managing movies, actors, genres, countries, languages, and more. Built with Express, Sequelize, and TypeScript.

## Features

- User authentication and management
- CRUD operations for movies, actors, genres, countries, languages, addresses, and cities
- OpenAPI documentation (Swagger and Redoc)
- Dockerized for easy deployment

## Project Structure

```
.
├── config/                # Configuration files (e.g., nginx)
├── openapi/               # OpenAPI specs and docs
├── scripts/               # Utility scripts (e.g., deployment)
├── src/                   # Source code
│   ├── constants/         # App constants (languages, countries, etc.)
│   ├── controllers/       # Route controllers
│   ├── middlewares/       # Express middlewares
│   ├── models/            # Sequelize models
│   ├── routes/            # API routes
│   ├── tests/             # Unit and integration tests
│   ├── types/             # TypeScript types
│   ├── utils/             # Utility functions
│   ├── app.ts             # Express app setup
│   ├── server.ts          # Server entrypoint
│   └── sequelize.config.ts# Sequelize configuration
├── Dockerfile             # Docker build instructions
├── docker-compose.yaml    # Docker Compose setup
├── package.json           # Project metadata and scripts
├── tsconfig.json          # TypeScript configuration
├── webpack.*.config.js    # Webpack configs
└── README.md              # Project documentation
```

## Getting Started

### Prerequisites

- Node.js 22+
- Yarn
- Docker (optional, for containerization)

### Installation

```sh
yarn install
```

### Build

```sh
yarn build
```

### Run (Development)

```sh
yarn start
```

### Run with Docker

```sh
docker-compose up --build
```

### API Documentation

- Swagger UI: [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs)
- Redoc: [http://localhost:8000/api/v1/redocs](http://localhost:8000/api/v1/redocs)
- OpenAPI Spec: [http://localhost:8000/openapi/v1](http://localhost:8000/openapi/v1)

## Deployment

Use the provided script to copy files to your deployment target:

```sh
bash scripts/copy_to_pi.sh
```

## Environment Variables

Configure your environment in `.env.dev`, `.env.test`, `.env.prod` as needed.

## Testing

```sh
yarn test
```

## License

MIT

---

For more details, see the source code in [`src/app.ts`](src/app.ts) and the OpenAPI specs in [`openapi/`](openapi)
