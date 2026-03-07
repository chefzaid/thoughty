# Thoughty 📓

Thoughty is a modern, feature-rich journal application designed to help you capture your thoughts, organize them with tags, manage multiple diaries, and gain meaningful insights through statistics and visualizations. Built with a focus on privacy, flexibility, and a delightful user experience.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-18.3-61dafb.svg)
![NestJS](https://img.shields.io/badge/nestjs-11.1-e0234e.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.8-3178c6.svg)

---

## ✨ Features

### 📝 Journaling & Entry Management
- **Rich Text Entries** - Write and save your thoughts with an auto-resizing textarea interface
- **Multiple Entries Per Day** - Create as many entries as you want per day with automatic indexing
- **Date Selection** - Backdate entries using an intuitive date picker
- **Inline Editing** - Edit entries directly in place, including date, tags, and visibility
- **Cross-References** - Link entries together using `[[YYYY-MM-DD]]` or `[[YYYY-MM-DD#index]]` syntax with clickable navigation
- **Entry Highlighting** - Visual highlighting when navigating to specific entries from references
- **Visibility Control** - Toggle entries between public and private with one click

### 📚 Multiple Diaries
- **Unlimited Diaries** - Create themed diaries for different aspects of your life
- **Custom Icons** - Choose from 20 emoji icons to personalize each diary
- **All Diaries View** - View entries from all diaries in a unified timeline
- **Default Visibility** - Set per-diary default visibility (public/private) for new entries
- **Set Default Diary** - Designate any diary as your default for quick entry creation
- **Diary Tabs** - Quick navigation between diaries with a tabbed interface

### 🏷️ Tagging System
- **Multi-Tag Support** - Add multiple tags to each entry for rich categorization
- **Auto-Complete** - Smart suggestions from your existing tags as you type
- **Create New Tags** - Add new tags inline while writing
- **Tag Chips** - Visual tag display with easy removal
- **Keyboard Navigation** - Use Enter to add and Backspace to remove tags

### 🔍 Search & Filtering
- **Full-Text Search** - Search across all entry content with keywords
- **Tag Filtering** - Filter by multiple tags simultaneously
- **Date Filtering** - Calendar picker with visual indicators for dates containing entries
- **Visibility Filtering** - Filter by All / Public / Private entries
- **Combined Filters** - Stack multiple filters for precise results
- **One-Click Reset** - Clear all filters instantly

### 📊 Statistics & Insights
- **Overview Dashboard** - Total entries, unique tags, years active, and averages
- **Entries Per Year** - Interactive bar chart showing yearly activity
- **Entries Per Month** - Configurable time periods (6/12/24/36 months or all-time)
- **Top Tags** - Horizontal bar chart of your 10 most-used tags
- **Tags Per Year** - Breakdown of top 5 tags by year with pagination
- **Per-Diary Stats** - Filter statistics by specific diary
- **Theme-Aware Charts** - Charts adapt beautifully to light and dark modes

### 🎯 Thought of the Day / Highlights
- **Random Entry** - Display a random journal entry for reflection
- **On This Day** - Discover entries from the same calendar date in previous years
- **Year Grouping** - Entries organized by "X year(s) ago"
- **Refresh Button** - Get a new random entry anytime
- **Quick Navigation** - Click any highlight to jump to the full entry

### 📤 Import & Export
- **Plain Text Format** - Export to portable `.txt` files
- **Full Export** - Export all entries or per-diary
- **Customizable Format** - Configure separators, date format, tag brackets
  - Entry separator (between different dates)
  - Same-day separator (between entries on same date)
  - Date prefix/suffix patterns
  - Tag bracket characters and separators
- **Preview Before Import** - Parse and review entries before importing
- **Duplicate Detection** - Identify and optionally skip duplicate entries
- **Import Statistics** - See how many entries were imported vs skipped

### 🔐 Authentication & Security
- **Email/Password Registration** - Secure signup with password requirements
- **Login Flexibility** - Sign in with either email or username
- **Google OAuth** - One-click Google Sign-In with automatic account linking
- **JWT Authentication** - Secure access tokens (15-min) and refresh tokens (7-day)
- **Auto Token Refresh** - Seamless session management
- **Password Reset** - Email-based secure reset with 1-hour expiry tokens
- **Change Password** - Update password with current password verification
- **Account Deletion** - Soft delete with confirmation and password verification
- **Password Hashing** - bcrypt with 10 salt rounds
- **Token Revocation** - All sessions invalidated on password change

### 👤 User Profile
- **Personal Information** - Manage full name, bio, and birthday
- **Profile Picture** - Upload, crop, zoom, and position custom avatars
- **Interactive Editor** - Circular crop tool with zoom slider for perfect pictures
- **Member Since** - Display your registration year

### ⚙️ Settings & Preferences
- **Dark/Light Theme** - Full theme support with visual toggle
- **Internationalization** - English 🇬🇧 and French 🇫🇷 language support
- **Pagination Settings** - Configure entries per page (5/10/15/20/25/50)

### 📱 User Experience
- **Responsive Design** - Mobile-friendly layout that works on all devices
- **Confirmation Modals** - Safe deletion with confirmation dialogs
- **Loading States** - Smooth loading indicators throughout
- **Keyboard Shortcuts** - Efficient navigation with keyboard support
- **Footer Links** - Privacy Policy, Terms of Service, and Contact

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern component-based UI with hooks
- **TypeScript 5** - Type-safe JavaScript
- **Vite 7** - Lightning-fast build tooling with HMR
- **Tailwind CSS 3** - Utility-first styling
- **Chart.js** - Beautiful data visualizations
- **react-datepicker** - Intuitive date selection
- **Vitest** - Fast unit testing with v8 coverage
- **Testing Library** - React component testing

### Backend
- **NestJS 11** - Progressive Node.js framework
- **TypeScript 5** - Type-safe development
- **TypeORM** - Elegant PostgreSQL ORM with migrations
- **Passport.js** - Authentication with JWT strategy
- **class-validator** - Declarative DTO validation
- **Swagger/OpenAPI** - Auto-generated API documentation
- **Jest 30** - Comprehensive testing framework
- **Helmet & HPP** - Security middleware

### Database
- **PostgreSQL 14+** - Robust relational database

### DevOps & Tooling
- **Docker** - Containerized development
- **Docker Compose** - Multi-container orchestration
- **ESLint 9** - Modern flat config code linting
- **Prettier** - Code formatting
- **mask** - Task runner for development commands

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+ (LTS recommended)
- **Docker & Docker Compose** (for the database)
- **[mask](https://github.com/jacobdeichert/mask)** (optional, but recommended for running commands)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd thoughty
   ```

2. **Install dependencies**
   ```bash
   mask build
   # or manually:
   cd thoughty-server && npm install && cd ..
   cd thoughty-web && npm install && cd ..
   ```

3. **Configure environment**
   - Copy `.env.example` to `.env` in both `thoughty-server/` and `thoughty-web/` directories
   - Update database credentials and JWT secrets

4. **Start the database**
   ```bash
   docker-compose -f .devcontainer/docker-compose.yml up -d db
   ```

5. **Run migrations and seed data**
   ```bash
   npm run migrate
   npm run seed
   ```

6. **Start the application**
   ```bash
   mask run
   ```

### Access Points

| Service | URL |
|---------|-----|
| Client | http://localhost:5173 |
| Server | http://localhost:3001 |
| API Docs (Swagger) | http://localhost:3001/api-docs |

### Environment Variables

Create `.env` files in both `thoughty-server/` and `thoughty-web/` directories:

**Server (.env)**
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

**Client (.env)**
```env
VITE_API_URL=http://localhost:3001
```

---

## 📋 Available Commands

This project uses a `maskfile.md` to manage common tasks. If you have [mask](https://github.com/jacobdeichert/mask) installed:

### Build
| Command | Description |
|---------|-------------|
| `mask build` | Install dependencies for server and client |
| `mask build --clean` | Clean node_modules and reinstall |

### Test
| Command | Description |
|---------|-------------|
| `mask test` | Run all tests (backend + frontend) |
| `mask test --backend` | Run backend tests only |
| `mask test --frontend` | Run frontend tests only |
| `mask test --coverage` | Generate coverage report |

### Run
| Command | Description |
|---------|-------------|
| `mask run` | Start the full application |
| `mask run --kill` | Kill existing Node processes before starting |

### Other
| Command | Description |
|---------|-------------|
| `npm run migrate` | Run database migrations |
| `npm run seed` | Seed database with test data |
| `npm run kill` | Kill running Node.js processes |
| `npm run coverage` | Generate combined coverage report |

---

## 📁 Project Structure

```
thoughty/
├── thoughty-web/           # React frontend application
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── AuthPage/           # Login/Register
│   │   │   ├── DiaryManager/       # Diary CRUD
│   │   │   ├── DiaryTabs/          # Diary navigation
│   │   │   ├── EntriesList/        # Entry display
│   │   │   ├── EntryForm/          # Create/edit entries
│   │   │   ├── FilterControls/     # Search & filters
│   │   │   ├── ImportExport/       # Import/export UI
│   │   │   ├── NavMenu/            # Navigation
│   │   │   ├── Pagination/         # Page controls
│   │   │   ├── ProfilePage/        # User profile
│   │   │   ├── ProfilePictureEditor/ # Avatar editor
│   │   │   ├── Stats/              # Statistics & charts
│   │   │   ├── TagPicker/          # Tag input
│   │   │   └── ThoughtOfTheDay/    # Highlights modal
│   │   ├── contexts/       # React context providers
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API service layer
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Utilities & translations
│   └── public/             # Static assets
├── thoughty-server/        # NestJS backend application
│   ├── src/
│   │   ├── common/         # Shared utilities
│   │   │   ├── decorators/ # Custom decorators (@CurrentUser, @Public)
│   │   │   └── utils/      # Utility functions
│   │   ├── database/       # Database configuration
│   │   │   ├── entities/   # TypeORM entities
│   │   │   └── migrations/ # Database migrations
│   │   └── modules/        # Feature modules
│   │       ├── auth/       # Authentication
│   │       ├── config/     # User configuration
│   │       ├── diaries/    # Diary management
│   │       ├── entries/    # Journal entries
│   │       ├── io/         # Import/Export
│   │       └── stats/      # Statistics
│   └── test/               # E2E tests
├── scripts/                # Utility scripts
└── maskfile.md             # Task runner configuration
```

---

## 🔌 API Overview

The backend provides a comprehensive RESTful API documented with Swagger/OpenAPI.

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/oauth` | OAuth authentication |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/change-password` | Change password |
| POST | `/api/auth/forgot-password` | Request reset email |
| POST | `/api/auth/reset-password` | Reset with token |
| POST | `/api/auth/delete-account` | Delete account |

### Diaries
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/diaries` | List all diaries |
| POST | `/api/diaries` | Create new diary |
| PUT | `/api/diaries/:id` | Update diary |
| DELETE | `/api/diaries/:id` | Delete diary |
| PATCH | `/api/diaries/:id/default` | Set as default |

### Entries
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/entries` | List entries (with filters) |
| POST | `/api/entries` | Create entry |
| PUT | `/api/entries/:id` | Update entry |
| DELETE | `/api/entries/:id` | Delete entry |
| DELETE | `/api/entries/all` | Delete all entries |
| PATCH | `/api/entries/:id/visibility` | Toggle visibility |
| GET | `/api/entries/highlights` | Random + On This Day |
| GET | `/api/entries/dates` | Get dates with entries |
| GET | `/api/entries/find-page` | Find page for date |
| GET | `/api/entries/find` | Find entry by date/index |

### Statistics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Get all statistics |

### Import/Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/io/format` | Get format settings |
| PUT | `/api/io/format` | Update format settings |
| GET | `/api/io/export` | Export entries |
| POST | `/api/io/import/preview` | Preview import |
| POST | `/api/io/import` | Import entries |

---

## 🧪 Testing

### Run All Tests
```bash
mask test
```

### Run with Coverage
```bash
mask test --coverage
```

### Frontend Tests Only
```bash
cd thoughty-web && npm test
```

### Backend Tests Only
```bash
cd thoughty-server && npm test
```

---

## 🎨 Theming

Thoughty supports both **light** and **dark** themes:

- Theme preference is saved per user
- Toggle available in Profile settings
- All components and charts adapt seamlessly
- System preference detection (planned)

---

## 🌍 Internationalization

Currently supported languages:
- 🇬🇧 **English** (en)
- 🇫🇷 **French** (fr)

Language can be changed in Profile settings. All UI elements, messages, and labels are fully translated.

---

## 🔮 Roadmap

See [PRD.txt](PRD.txt) for the complete list of planned features, including:

- ☁️ Cloud sync (OneDrive, Google Drive)
- 🤖 AI-powered features (mood analysis, tag suggestions, writing assistance)
- 👥 Social features (public feed, follows, comments, likes)
- 📖 Book converter (create chapters from tagged entries)
- 🔒 Enhanced security (2FA, session management)
- 📱 Mobile apps

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 💖 Made with ❤️ in Paris

