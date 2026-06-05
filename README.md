# Thoughty 📓

Thoughty is a modern, feature-rich journal application designed to help you capture your thoughts, organize them with tags, manage multiple diaries. With big features like cloud-sync, statistics, visualizations, and gain meaningful insights through AI-powered analysis and recommendations. Built with a focus on privacy, flexibility, and a polished user experience, Thoughty aims to be your ultimate journaling companion.


![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-19-61dafb.svg)
![NestJS](https://img.shields.io/badge/nestjs-11.1-e0234e.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.8-3178c6.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## 🛠️ Tech Stack

### Frontend

- React 19
- TypeScript 5
- Vite 7
- Tailwind CSS 3
- Chart.js

### Backend

- NestJS 11
- TypeScript 5
- TypeORM
- PostgreSQL
- S3-compatible object storage

### DevOps and Tooling

- Docker and Docker Compose
- Kubernetes
- Jenkins
- HashiCorp Vault
- Nginx
- mask

## Documentation

- [Features](./docs/features.md)
- [Architecture Overview and ADR Index](./docs/adr/README.md)
- [Data Model Reference](./docs/data-model.md)
- [Development Guide](./docs/development.md)
- [Deployment Guide](./docs/deployment.md)
- [Operations Runbook](./docs/operations.md)
- [Security and Privacy Reference](./docs/security.md)

## Quick Start

```bash
mask build
docker-compose -f .devcontainer/docker-compose.yml up -d db minio
npm run migrate
npm run seed
mask run
```

For environment variables, local development setup, and test workflows, start with [docs/development.md](./docs/development.md).

## Roadmap

The current backlog and planned features live in [todo.txt](./todo.txt).

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).