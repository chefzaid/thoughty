# Thoughty 📓

Thoughty is a modern, feature-rich journal application designed to help you capture your thoughts, organize them with tags, manage multiple diaries, and gain meaningful insights through statistics and visualizations. Built with a focus on privacy, flexibility, and a polished user experience.

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
- [Development Guide](./docs/development.md)
- [Deployment Guide](./docs/deployment.md)
- [ADR 0001: Split Documentation Out of Root README](./docs/adr/0001-documentation-structure.md)
- [ADR 0002: Adopt a Modular Monolith with a Route-Driven UI Shell and Feature-Oriented Code Structure](./docs/adr/0002-modular-monolith-and-route-driven-ui.md)
- [ADR 0003: Standardize on a TypeScript-First Full-Stack Platform](./docs/adr/0003-typescript-first-technology-stack.md)
- [ADR 0004: Use Backend OpenAPI as the Source of Truth for API Contracts](./docs/adr/0004-openapi-as-contract-source.md)
- [ADR 0005: Apply Selective CQRS in the Entry Domain](./docs/adr/0005-selective-cqrs-in-entry-domain.md)
- [ADR 0006: Run Scheduled Cloud Sync Through a Separate Worker and Database-Backed Queue](./docs/adr/0006-database-backed-cloud-sync-worker.md)
- [ADR 0007: Keep Code Quality Enforcement Lightweight but Continuous](./docs/adr/0007-code-quality-and-verification-gates.md)
- [ADR 0008: Establish a Secure-by-Default Authentication and OWASP Baseline](./docs/adr/0008-security-authentication-and-owasp-baseline.md)
- [ADR 0009: Apply Layered Rate Limiting for Baseline Abuse Resistance](./docs/adr/0009-rate-limiting-and-abuse-controls.md)
- [ADR 0010: Model the Journal Around Diaries, Dated Entries, Revisions, and Attachments](./docs/adr/0010-journal-data-model.md)
- [ADR 0011: Store Attachments as Metadata in PostgreSQL and Blobs in S3-Compatible Object Storage](./docs/adr/0011-attachments-and-object-storage.md)
- [ADR 0012: Keep Delivery and Operational Verification Simple, Explicit, and Repository-Owned](./docs/adr/0012-delivery-health-and-operational-model.md)

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