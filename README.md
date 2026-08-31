# Thoughty

Thoughty is a modern, feature-rich journal application designed to help you capture your thoughts, organize them with tags, manage multiple diaries. With big features like cloud-sync, statistics, visualizations, convert thoughts into a book, and gain meaningful insights through AI-powered analysis and recommendations. Built with a focus on privacy, flexibility, and a polished user experience, Thoughty aims to be your ultimate journaling companion.

![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-19-61dafb.svg)
![NestJS](https://img.shields.io/badge/nestjs-11.1-e0234e.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.8-3178c6.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## GitLab Delivery

- [Run a pipeline](https://gitlab.swirlit.dev/swirlit/thoughty/-/pipelines/new?ref=main)
- [Pipelines and delivery jobs](https://gitlab.swirlit.dev/swirlit/thoughty/-/pipelines)
- [Versioned application packages](https://gitlab.swirlit.dev/swirlit/thoughty/-/packages)
- [Container images](https://gitlab.swirlit.dev/swirlit/thoughty/-/container_registry)
- [Releases](https://gitlab.swirlit.dev/swirlit/thoughty/-/releases)

GitLab exposes `build`, `verify`, `release`, and `version` stages. Their jobs are ordered as `01-build`, `02-test`, `03-package`; `01-e2e`, `02-quality`, `03-security`; `01-release`, `02-deploy`; and `set-major-version`. Build and package are required; tests and their 80 percent coverage rule are non-blocking. Standard mode leaves E2E, quality, security, and release manual. `PIPELINE_MODE=full` runs non-blocking quality and Trivy security reporting automatically and automates release and deploy, while E2E remains manual.

Application versions start at `1.0.0` and are owned by [`VERSION`](./VERSION). Each new commit advances the patch component for its build (`1.0.1`, `1.0.2`, ...). A successful release tags and deploys that exact version, then prepares the next minor cycle (`1.1.0`, `1.2.0`, ...). To change the major version, start a pipeline with `NEW_MAJOR_VERSION` set to the desired integer and play `set-major-version`; it prepares `<major>.0.0` and synchronizes every npm manifest.

## Documentation

- [Features](./docs/features.md)
- [Architecture Overview and ADR Index](./docs/architecture.md)
- [Data Model Reference](./docs/data-model.md)
- [Development Guide](./docs/development.md)
- [Testing Guide](./docs/testing.md)
- [Deployment Guide](./docs/deployment.md)
- [Operations Runbook](./docs/operations.md)
- [Security and Privacy Reference](./docs/security.md)
- [Infrastructure Layout](./docs/deployment.md#infrastructure-layout)

## Roadmap

The feature backlog — both implemented and planned features — lives in [TODO.md](./TODO.md).

## Quick Start

```bash
mask build
docker compose -f infra/compose/compose.yaml up -d db minio
npm run migrate
npm run seed
mask run
```

For environment variables, local development setup, and test workflows, start with [docs/development.md](./docs/development.md).

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
