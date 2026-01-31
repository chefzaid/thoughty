# Thoughty NestJS Server

A TypeScript-based NestJS backend for the Thoughty journal application, migrated from Express.js.

## Features

- **Authentication**: JWT-based auth with registration, login, OAuth (Google/Facebook), password reset
- **Entries**: CRUD operations for journal entries with tagging, visibility control, and pagination
- **Diaries**: Multiple diaries per user with customizable icons and default diary support
- **Stats**: Aggregated statistics for entries by year, month, and tags
- **Config**: User-specific settings and preferences
- **Import/Export**: Text file import/export with customizable format configuration

## Tech Stack

- **Framework**: NestJS 10.x
- **Language**: TypeScript 5.x
- **ORM**: TypeORM with PostgreSQL
- **Authentication**: Passport.js with JWT strategy
- **Validation**: class-validator & class-transformer
- **Documentation**: Swagger/OpenAPI
- **Security**: Helmet, CORS, Rate Limiting, XSS Protection

## Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

## Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Configure your database and JWT secrets in .env
```

## Environment Variables

```env
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=journal

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=15m
REFRESH_SECRET=refresh-secret-change-in-production

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# Server
PORT=3001
NODE_ENV=development
```

## Running the Server

```bash
# Development mode
npm run start:dev

# Production build
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

## API Documentation

Once the server is running, access the Swagger documentation at:
```
http://localhost:3001/api-docs
```

## Database Migrations

The existing database schema from the Express server is compatible. TypeORM is configured with `synchronize: false` to prevent automatic schema changes in production.

```bash
# Run migrations (when available)
npm run migration:run

# Generate a new migration
npm run migration:generate -- -n MigrationName

# Revert last migration
npm run migration:revert
```

## Testing

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Test coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

## Project Structure

```
src/
├── common/                 # Shared utilities and decorators
│   ├── decorators/        # Custom decorators (@CurrentUser, @Public)
│   └── utils/             # Utility functions (sanitize, file-converter)
├── database/              # Database configuration
│   ├── entities/          # TypeORM entities
│   └── migrations/        # Database migrations
├── modules/               # Feature modules
│   ├── auth/              # Authentication
│   ├── config/            # User configuration
│   ├── diaries/           # Diaries management
│   ├── entries/           # Journal entries
│   ├── io/                # Import/Export
│   └── stats/             # Statistics
├── app.module.ts          # Root module
└── main.ts                # Application bootstrap
```

## API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - Login with email/username
- `POST /oauth` - OAuth authentication
- `POST /refresh` - Refresh access token
- `POST /logout` - Logout and invalidate token
- `GET /me` - Get current user
- `POST /change-password` - Change password
- `POST /forgot-password` - Request password reset
- `POST /reset-password` - Reset password with token
- `POST /delete-account` - Delete user account

### Entries (`/api/entries`)
- `GET /` - List entries with pagination & filters
- `GET /dates` - Get all dates with entries
- `GET /first` - Get page for year/month navigation
- `GET /by-date` - Find entry by date and index
- `GET /highlights` - Random entry and "on this day" entries
- `POST /` - Create new entry
- `PUT /:id` - Update entry
- `PATCH /:id/visibility` - Toggle visibility
- `DELETE /:id` - Delete entry
- `DELETE /all` - Delete all entries

### Diaries (`/api/diaries`)
- `GET /` - List all diaries
- `POST /` - Create diary
- `PUT /:id` - Update diary
- `DELETE /:id` - Delete diary
- `PATCH /:id/default` - Set as default diary

### Stats (`/api/stats`)
- `GET /` - Get aggregated statistics

### Config (`/api/config`)
- `GET /` - Get user configuration
- `POST /` - Update configuration

### Import/Export (`/api/io`)
- `GET /format` - Get format settings
- `POST /format` - Save format settings
- `GET /export` - Export entries
- `POST /preview` - Preview import
- `POST /import` - Import entries

## Migration from Express

This NestJS server is a direct migration from the original Express.js server with the following improvements:

1. **Type Safety**: Full TypeScript implementation with strict null checks
2. **Dependency Injection**: NestJS IoC container for better testability
3. **Validation**: Declarative DTOs with class-validator decorators
4. **ORM**: TypeORM entities instead of raw SQL queries
5. **Modular Architecture**: Feature-based module organization
6. **API Documentation**: Auto-generated Swagger docs from decorators
7. **Testing**: Built-in testing utilities with dependency mocking

## License

MIT
