# Thoughty

Thoughty is a modern journal application designed to help you capture your thoughts, organize them with tags, and gain insights through simple statistics and AI analysis.

## Features

*   **Journaling**: Write and save your thoughts with a streamlined interface.
*   **Organization**: Tagging system for easy categorization and retrieval.
*   **Statistics**: Visual insights into your journaling habits (thoughts per year/month, tag usage).
*   **Search & Filter**: Powerful date and tag filtering to find specific entries.
*   **AI Integration**: Planned features for mood analysis, writing assistance, and more.

## Tech Stack

*   **Frontend**: React, Vite
*   **Backend**: Node.js, Express
*   **Database**: PostgreSQL
*   **Tooling**: Docker

## Getting Started

### Prerequisites

*   Node.js (LTS recommended)
*   Docker & Docker Compose (for the database)
*   [mask](https://github.com/jacobdeichert/mask) (optional, but recommended for running commands)

### Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd thoughty
```


## Available Commands

This project uses a `maskfile.md` to manage common tasks. If you have [mask](https://github.com/jacobdeichert/mask) installed, you can run the following commands:

*   `mask build`: Build the client application.
    *   `mask build --clean`: Remove node_modules and reinstall dependencies before building.
*   `mask test`: Run both backend and frontend tests.
    *   `mask test --backend`: Run only backend tests.
    *   `mask test --frontend`: Run only frontend tests.
    *   `mask test --coverage`: Run the coverage report script.
*   `mask run`: Run the whole application (backend and frontend) using Docker.
    *   `mask run --kill`: Kill any existing Node.js processes before starting.
*   `mask seed`: Fill the database with test data.
