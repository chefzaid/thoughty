# Thoughty

Thoughty is a privacy-focused journal. Write dated entries in plain text or Markdown, organize them with tags and multiple diaries, and revisit them through search, highlights, and statistics. Optional AI helps you tag, rephrase, summarize, and find inspiration; exports, printable books, and cloud sync keep your writing portable.

![Node](https://img.shields.io/badge/node-22-brightgreen.svg)
![React](https://img.shields.io/badge/react-19-61dafb.svg)
![NestJS](https://img.shields.io/badge/nestjs-11-e0234e.svg)
![TypeScript](https://img.shields.io/badge/typescript-5-3178c6.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

Production: [thoughty.swirlit.dev](https://thoughty.swirlit.dev)

## Quick Start

Requires Node.js 22, Docker, and optionally [`mask`](https://github.com/jacobdeichert/mask).

```bash
mask build   # install dependencies
mask run     # start PostgreSQL and MinIO, migrate, seed, and run the API and web app
```

Open `http://localhost:5173`. Manual steps, configuration, and the Dev Container are in the [Development Guide](./docs/development.md).

## Documentation

| Guide | Covers |
|---|---|
| [Features](./docs/features.md) | what the product does |
| [Architecture](./docs/architecture.md) | system design, module ownership, and the ADR index |
| [Data Model](./docs/data-model.md) | entities, ownership and deletion rules, tags, migrations |
| [Development](./docs/development.md) | local setup, configuration, everyday commands |
| [Testing](./docs/testing.md) | test layers, commands, writing tests |
| [Deployment](./docs/deployment.md) | delivery pipeline, versioning, profiles, secrets, DNS, rollback |
| [Operations](./docs/operations.md) | health checks, logs, metrics, troubleshooting, backup and restore |
| [Security](./docs/security.md) | authentication, abuse controls, secrets, AI privacy |
| [Onboarding](./docs/onboarding.md) | registering the repository with the `swirl-cloud` platform |
| [Standalone Vault](./docs/standalone-vault.md) | secrets for an independent installation |

The implemented and planned backlog is in [TODO.md](./TODO.md).

## Delivery

GitLab builds and tests every push; releases are started manually (or automatically from a `PIPELINE_MODE=full` run) and deployed by Argo CD. See [Deployment](./docs/deployment.md#delivery-pipeline) for the details.

- [Run a pipeline](https://gitlab.swirlit.dev/swirlit/thoughty/-/pipelines/new?ref=main) · [Pipelines](https://gitlab.swirlit.dev/swirlit/thoughty/-/pipelines) · [Releases](https://gitlab.swirlit.dev/swirlit/thoughty/-/releases) · [Packages](https://gitlab.swirlit.dev/swirlit/thoughty/-/packages) · [Container images](https://gitlab.swirlit.dev/swirlit/thoughty/-/container_registry)

## License

MIT. See [LICENSE](./LICENSE).
