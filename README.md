# Thoughty 📓

Thoughty is a modern, feature-rich journal application designed to help you capture your thoughts, organize them with tags, manage multiple diaries, and gain meaningful insights through statistics and visualizations. Built with a focus on privacy, flexibility, and a delightful user experience.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-19-61dafb.svg)
![NestJS](https://img.shields.io/badge/nestjs-11.1-e0234e.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.8-3178c6.svg)

---

## ✨ Features

### 📝 Journaling & Entry Management
- **Rich Text Entries** - Write and save your thoughts with an auto-resizing textarea interface
- **Markdown Support** - Toggle Markdown mode for rich formatting with a WYSIWYG-style toolbar
  - Formatting toolbar with Bold, Italic, Strikethrough, Headings (H1–H3), Bullet & Numbered Lists, Blockquote, Inline Code, Code Block, Link, and Horizontal Rule
  - Live preview renders Markdown with full GFM (GitHub Flavored Markdown) support including tables, task lists, and strikethrough
  - Per-entry format saved — plain text entries stay plain, Markdown entries render formatted
- **Multiple Entries Per Day** - Create as many entries as you want per day with automatic indexing
- **Date Selection** - Backdate entries using an intuitive date picker
- **Inline Editing** - Edit entries directly in place, including date, tags, and visibility
- **Bulk Entry Actions** - Select multiple entries at once for batch delete, visibility changes, tag updates, or moving entries between diaries
- **Cross-References** - Link entries together using `[[YYYY-MM-DD]]` or `[[YYYY-MM-DD#index]]` syntax with clickable navigation
- **Entry Highlighting** - Visual highlighting when navigating to specific entries from references
- **Entry Permalinks & Sharing** - Copy or open stable `?entry=<id>` links for any journal entry to bookmark or share a specific thought
- **Route-Aware Navigation** - Main areas use stable routes like `/journal`, `/stats`, `/profile`, and `/tags`, while diary, import/export, and entry permalink context stays in query params for reloadable deep links
- **Visibility Control** - Toggle entries between public and private with one click
- **Favorites** - Star/unstar entries as favorites and filter to show only favorites
- **Modification History** - View previous versions of edited entries with timestamps
- **File Uploads & Previews** - Attach images, audio notes, and documents (JPEG, PNG, GIF, WebP, SVG, PDF, TXT, MP3, WAV, OGG, M4A, WebM) to journal entries with inline previews, audio playback, and expanded in-app preview dialogs for supported files
- **Read Entries Aloud** - Listen to your journal entries using the many options of the Text-to-Speech feature
- **AI Fix Writing** - One-click grammar, spelling, and style correction powered by OpenRouter; the corrected text replaces the draft so you can review changes immediately
- **AI Discussion** - Open a chat conversation with AI about any journal entry; the AI uses the entry as context to provide thoughtful analysis, reflection prompts, and deeper insight

### 📚 Multiple Diaries
- **Unlimited Diaries** - Create themed diaries for different aspects of your life
- **Custom Icons** - Choose from 20 emoji icons to personalize each diary
- **Drag & Drop Reordering** - Reorder your diaries by dragging and dropping
- **All Diaries View** - View entries from all diaries in a unified timeline
- **Default Visibility** - Set per-diary default visibility (public/private) for new entries
- **Set Default Diary** - Designate any diary as your default for quick entry creation
- **Diary Tabs** - Quick navigation between diaries with a tabbed interface
- **Favorites Journal** - A dedicated ⭐ Favorites tab in the diary bar that shows all starred entries across diaries in one view

### 🏷️ Tagging System
- **Multi-Tag Support** - Add multiple tags to each entry for rich categorization
- **Auto-Complete** - Smart suggestions from your existing tags as you type
- **Create New Tags** - Add new tags inline while writing
- **AI Tag Suggestions** - Generate draft tags from your entry content using OpenRouter
- **Automatic AI Tagging** - Optionally fill in tags on save and cap the number of AI-generated tags per entry from profile settings
- **Dedicated Tags Tab** - Manage all tags from a standalone Tags view between Journal and Stats
- **Custom Tag Colors & Categories** - Give tags their own color and optional category for faster visual scanning
- **Global Tag Rename** - Rename a tag once and update it across all entries using it
- **Tag Chips** - Visual tag display with easy removal
- **Keyboard Navigation** - Use Enter to add and Backspace to remove tags

### 🔍 Search & Filtering
- **Full-Text Search** - Search across all entry content with keywords
- **Search Match Highlighting** - Matching search terms are highlighted directly inside plain text and Markdown entry results for faster scanning
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
- **Multiple Export Formats** - Export as TXT, JSON, or Markdown
- **Auto-Detect Import Format** - Automatically detects TXT, JSON, and Markdown files on import
- **Markdown Format Preserved** - Markdown entries flagged with `{md}` in exports and automatically detected on import
- **Full Export** - Export all entries or per-diary
- **Smart Filenames** - Export files named with diary name and date (e.g., `thoughty_My_Journal_2024-01-15.txt`)
- **Visibility Export** - Optionally include entry visibility (public/private) in exported files
- **All Diaries Mapping** - Exports from All Diaries preserve each entry's diary name, and imports map entries back to matching diaries when possible
- **Customizable Format** - Configure separators, date format, tag brackets
  - Entry separator (between different dates)
  - Same-day separator (between entries on same date)
  - Date prefix/suffix patterns
  - Tag bracket characters and separators
- **Preview Before Import** - Parse and review entries before importing
- **Duplicate Detection** - Identify and optionally skip duplicate entries
- **Import Statistics** - See how many entries were imported vs skipped
- **Diary Default Visibility** - Imported entries inherit the target diary's visibility setting
- **Safe Diary Fallback** - If an imported diary name does not match an existing diary, the entry is imported into the default target diary instead

### ☁️ Cloud Sync
- **Google Drive Integration** - Connect your Google account to sync journal exports to Google Drive
- **OneDrive Integration** - Connect your Microsoft account to sync journal exports to OneDrive
- **Dropbox Integration** - Connect your Dropbox account to sync journal exports to Dropbox
- **OAuth 2.0 Authentication** - Secure popup-based OAuth flow for connecting cloud providers (configured in Settings/Profile)
- **Upload Exports** - Export your journal in TXT, JSON, or Markdown format directly to a "Thoughty" folder in your cloud storage
- **Browse & Import Cloud Files** - View files in your Thoughty cloud folder and import them directly into your journal
- **Download Files** - Download any file from your cloud storage back to your device
- **Multiple Providers** - Connect to Google Drive, OneDrive, and Dropbox simultaneously
- **Token Management** - Encrypted token storage with automatic refresh when tokens expire
- **Per-Diary Export** - Upload exports for a specific diary or all diaries
- **Scheduled Sync** - Configure automatic sync on a fixed schedule (every 6h, 12h, daily, or weekly) from Import/Export
- **Diff-Based Sync** - Only uploads when content has changed since the last sync, using SHA-256 hash comparison
- **Auto-Sync Timer** - Client-side timer checks for due syncs every minute and triggers them automatically
- **Sync Now** - Manually trigger a diff-based sync at any time

### 🔐 Authentication & Security
- **Email/Password Registration** - Secure signup with password requirements
- **Login Flexibility** - Sign in with either email or username
- **Google OAuth** - One-click Google Sign-In with automatic account linking
- **JWT Authentication** - Secure access tokens (15-min) and refresh tokens (7-day)
- **Auto Token Refresh** - Seamless session management
- **Password Reset** - Email-based secure reset with 1-hour expiry tokens
- **Change Password** - Update password with current password verification
- **Account Deletion** - Soft delete with confirmation and password verification
- **GDPR Data Download** - Download all personal data as a JSON file from the profile page
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
- **Read Dates Toggle** - Choose whether text-to-speech includes date headers
- **AI Model Selection** - Choose from all available OpenRouter models via a searchable dropdown in profile settings
- **Automatic Tag Limit** - Set how many AI-generated tags can be added automatically when an entry is saved; use `0` to disable it

AI features (tag suggestions, writing fixes, AI chat) are powered by [OpenRouter](https://openrouter.ai). The API key is configured once on the server via the `OPENROUTER_API_KEY` environment variable — users only choose which model to use from the profile settings dropdown.

Fix Writing sends the draft text to the AI, which corrects grammar, spelling, and punctuation while preserving the original meaning, tone, and voice. The corrected text replaces the draft inline so you can review and accept or undo the changes.

Automatic tagging uses the same OpenRouter configuration. When `Automatic Tag Limit` is above `0`, new entries and edited entries can be saved without manually adding tags first, and the backend will try to append AI-generated tags up to the configured limit.

### 📱 User Experience
- **Public Intro Page** - A landing page that showcases the app and routes visitors directly into sign-in or sign-up
- **Responsive Design** - Mobile-friendly layout that works on all devices
- **Confirmation Modals** - Safe deletion with confirmation dialogs
- **Loading States** - Smooth loading indicators throughout
- **Keyboard Shortcuts** - Efficient navigation with keyboard support
- **Footer Links** - Privacy Policy, Terms of Service, and Contact

---

## 🛠️ Tech Stack

### Frontend
- **React 19** - Modern component-based UI with hooks
- **TypeScript 5** - Type-safe JavaScript
- **Vite 7** - Lightning-fast build tooling with HMR
- **Tailwind CSS 3** - Utility-first styling
- **Chart.js** - Beautiful data visualizations
- **react-markdown** - Markdown rendering with GFM support via remark-gfm
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
- **Jest 29** - Comprehensive testing framework
- **Helmet & HPP** - Security middleware

### Database & Storage
- **PostgreSQL 14+** - Robust relational database
- **S3** - S3-compatible object storage for attachments (MinIO for local dev) and AWS S3 or any S3-compatible provider for production

### DevOps & Tooling
- **Docker** - Containerized development
- **Docker Compose** - Multi-container orchestration
- **Kubernetes** - Production container orchestration
- **Jenkins** - CI/CD pipeline
- **HashiCorp Vault** - Secrets management
- **Nginx** - Web server & reverse proxy
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

4. **Start the database and storage**
   ```bash
   docker-compose -f .devcontainer/docker-compose.yml up -d db minio
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

# S3 / Object Storage (defaults work with local MinIO, no .env needed for local dev)
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=thoughty-attachments
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_REGION=us-east-1

# Config encryption (for sensitive settings)
CONFIG_ENCRYPTION_SECRET=your-encryption-secret-change-in-production

# AI (OpenRouter) — get your key at https://openrouter.ai/keys
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_TAG_MODEL=openai/gpt-4o-mini

# Cloud Sync OAuth (optional)
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
ONEDRIVE_CLIENT_ID=
ONEDRIVE_CLIENT_SECRET=
DROPBOX_CLIENT_ID=
DROPBOX_CLIENT_SECRET=
```

> **Note:** For local development, no `.env` file is needed for S3 — the defaults connect to the MinIO container started by `docker-compose`. For production, see [S3 Configuration for Production](#-s3-configuration-for-production).

> **Cloud Sync:** To enable cloud sync, create OAuth 2.0 credentials for each provider you want to support. Set the redirect URI to `<your-frontend-url>/cloud-callback` (e.g. `http://localhost:5173/cloud-callback` for local dev). Without these credentials, the cloud sync UI will still appear but connections will fail.

> **AI:** Sign up at [OpenRouter](https://openrouter.ai) and create an API key. Set `OPENROUTER_API_KEY` in your server `.env`. Users choose their preferred model from the profile settings — the key is shared across all users.

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

### Frontend Browser Tests
```bash
cd thoughty-web && npm run test:e2e
```

Playwright runs Chromium in headless mode against the Vite dev server. The critical-flow specs cover the public intro page, sign up, login, create entry, edit entry, delete entry, and import/export browser flows using stateful mocked API responses so they stay deterministic in local development and CI.

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

## 🚀 Production Deployment

### Prerequisites

- A running **Kubernetes** cluster (v1.25+)
- **kubectl** configured with cluster access
- **Helm 3** installed
- **HashiCorp Vault** deployed in the cluster (with the [Vault Agent Injector](https://developer.hashicorp.com/vault/docs/platform/k8s/injector))
- A **Docker registry** accessible from the cluster
- **Jenkins** with the following plugins: Pipeline, Docker Pipeline, Kubernetes CLI

### 1. Build & Push Docker Images

```bash
# Server
cd thoughty-server
docker build -t <your-registry>/thoughty-server:latest .
docker push <your-registry>/thoughty-server:latest

# Web
cd ../thoughty-web
docker build -t <your-registry>/thoughty-web:latest .
docker push <your-registry>/thoughty-web:latest
```

### 2. Configure HashiCorp Vault

Enable the Kubernetes auth method and store the application secrets:

```bash
# Enable Kubernetes auth (once per cluster)
vault auth enable kubernetes
vault write auth/kubernetes/config \
  kubernetes_host="https://$KUBERNETES_SERVICE_HOST:$KUBERNETES_SERVICE_PORT"

# Store database secrets
vault kv put secret/thoughty/database \
  POSTGRES_USER="thoughty" \
  POSTGRES_PASSWORD="<secure-password>" \
  POSTGRES_DB="journal"

# Store application secrets
vault kv put secret/thoughty/app \
  JWT_SECRET="<secure-jwt-secret>" \
  JWT_REFRESH_SECRET="<secure-refresh-secret>" \
  GOOGLE_CLIENT_ID="<your-google-client-id>" \
  GOOGLE_CLIENT_SECRET="<your-google-client-secret>" \
  SMTP_HOST="<smtp-host>" \
  SMTP_PORT="587" \
  SMTP_USER="<smtp-user>" \
  SMTP_PASS="<smtp-password>" \
  S3_ENDPOINT="https://s3.amazonaws.com" \
  S3_BUCKET="your-thoughty-bucket" \
  S3_ACCESS_KEY="<aws-access-key-id>" \
  S3_SECRET_KEY="<aws-secret-access-key>" \
  S3_REGION="eu-west-1"

# Create access policies
vault policy write thoughty-server - <<EOF
path "secret/data/thoughty/database" { capabilities = ["read"] }
path "secret/data/thoughty/app"      { capabilities = ["read"] }
EOF

vault policy write thoughty-postgres - <<EOF
path "secret/data/thoughty/database" { capabilities = ["read"] }
EOF

# Bind Kubernetes service accounts to Vault roles
vault write auth/kubernetes/role/thoughty-server \
  bound_service_account_names=thoughty-server \
  bound_service_account_namespaces=thoughty \
  policies=thoughty-server \
  ttl=1h

vault write auth/kubernetes/role/thoughty-postgres \
  bound_service_account_names=thoughty-postgres \
  bound_service_account_namespaces=thoughty \
  policies=thoughty-postgres \
  ttl=1h
```

### 3. Update Kubernetes Manifests

Before applying the manifests in `deployments/`:

1. Edit `deployments/configmap.yaml` — set `CORS_ORIGIN` to your domain
2. Edit `deployments/ingress.yaml` — replace `thoughty.example.com` with your domain and configure TLS
3. Edit `deployments/server-deployment.yaml` and `deployments/web-deployment.yaml` — update the `image:` fields to point to your registry

### 4. Deploy to Kubernetes

```bash
# Create namespace
kubectl apply -f deployments/namespace.yaml

# Apply configuration & service accounts
kubectl apply -f deployments/configmap.yaml
kubectl apply -f deployments/vault-service-accounts.yaml

# Deploy database
kubectl apply -f deployments/postgres.yaml

# Wait for PostgreSQL to be ready
kubectl rollout status deployment/postgres -n thoughty --timeout=120s

# Deploy application
kubectl apply -f deployments/server-deployment.yaml
kubectl apply -f deployments/web-deployment.yaml
kubectl apply -f deployments/ingress.yaml

# Verify all pods are running
kubectl get pods -n thoughty
```

### 5. Run Database Migrations

Once the server pod is running, exec into it to run migrations:

```bash
kubectl exec -it deployment/thoughty-server -n thoughty -- \
  node -e "require('./dist/database/data-source').default.initialize().then(ds => ds.runMigrations().then(() => { console.log('Migrations complete'); process.exit(0); }))"
```

### Manifest Overview

| File | Description |
|------|-------------|
| `deployments/namespace.yaml` | Creates the `thoughty` namespace |
| `deployments/configmap.yaml` | Non-sensitive config (NODE_ENV, DB host, CORS origin) |
| `deployments/vault-service-accounts.yaml` | Service accounts for Vault authentication |
| `deployments/vault-setup.sh` | Reference script with all Vault setup commands |
| `deployments/postgres.yaml` | PostgreSQL 16 deployment + headless service + 5Gi PVC |
| `deployments/server-deployment.yaml` | NestJS server (2 replicas, rolling update, health probes) |
| `deployments/web-deployment.yaml` | Nginx-served React app (2 replicas, rolling update) |
| `deployments/ingress.yaml` | Ingress routing `/api` → server, `/` → web |

---

## 🔧 Jenkins CI/CD Pipeline

The [Jenkinsfile](Jenkinsfile) defines a full pipeline that runs on every push.

### Pipeline Stages

| Stage | Description |
|-------|-------------|
| **Install Dependencies** | Parallel `npm ci` for server and web |
| **Lint** | Parallel linting for both projects |
| **Test** | Parallel unit tests with coverage |
| **Build Images** | Parallel Docker image builds |
| **Push Images** | Push to registry (main branch only) |
| **Deploy** | Apply K8s manifests and trigger rolling deployment (main branch only) |

### Jenkins Setup

1. **Required Plugins** — install via *Manage Jenkins → Plugins*:
   - Pipeline
   - Docker Pipeline
   - Kubernetes CLI (`withKubeConfig` step)
   - Credentials Binding

2. **Configure Credentials** — add via *Manage Jenkins → Credentials*:

   | Credential ID | Type | Description |
   |---------------|------|-------------|
   | `docker-registry-url` | Secret text | Your Docker registry URL (e.g. `registry.example.com`) |
   | `docker-registry-creds` | Username/Password | Registry login credentials |
   | `kubeconfig` | Secret file | Kubernetes kubeconfig for the target cluster |

3. **Create the Pipeline Job**:
   - *New Item → Pipeline*
   - Under *Pipeline*, select **Pipeline script from SCM**
   - Point to your Git repository, branch `main`
   - Script path: `Jenkinsfile`

4. **Agent Requirements** — the Jenkins agent must have:
   - Node.js 22+
   - Docker CLI
   - `kubectl`

---

## ☁️ S3 Configuration for Production

Attachments are stored in S3-compatible object storage. In local development, MinIO runs automatically via Docker Compose with zero configuration. For production, you need to configure a real S3 provider.

### AWS S3

1. Create an S3 bucket (e.g. `my-thoughty-attachments`)
2. Create an IAM user with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, and `s3:ListBucket` permissions on that bucket
3. Set the following environment variables:

```env
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=my-thoughty-attachments
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=...
S3_REGION=eu-west-1
```

### Other S3-Compatible Providers

Any S3-compatible provider works (DigitalOcean Spaces, Cloudflare R2, Backblaze B2, self-hosted MinIO, etc.). Set `S3_ENDPOINT` to the provider's endpoint URL:

| Provider | Endpoint Example |
|----------|------------------|
| AWS S3 | `https://s3.amazonaws.com` |
| DigitalOcean Spaces | `https://nyc3.digitaloceanspaces.com` |
| Cloudflare R2 | `https://<account-id>.r2.cloudflarestorage.com` |
| Backblaze B2 | `https://s3.us-west-004.backblazeb2.com` |
| Self-hosted MinIO | `https://minio.example.com` |

### IAM Policy (AWS)

Minimum required IAM policy for the S3 user:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::my-thoughty-attachments/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:CreateBucket"
      ],
      "Resource": "arn:aws:s3:::my-thoughty-attachments"
    }
  ]
}
```

> **Tip:** The server auto-creates the bucket on startup if it doesn't exist. You can remove `s3:CreateBucket` from the policy if you pre-create the bucket.

---

## 🔮 Roadmap

See [todo.txt](todo.txt) for the complete list of planned features, including:

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


