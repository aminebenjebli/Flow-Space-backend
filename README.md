<div align="center">

# Flow Space – Backend API

Plateforme académique de productivité collaborative intelligente : gestion de tâches augmentée par l'IA, gamification, analytics, collaboration temps réel et support PWA.

![Status](https://img.shields.io/badge/status-active-success) ![Node](https://img.shields.io/badge/node-%3E=20.x-green) ![NestJS](https://img.shields.io/badge/nestjs-10.x-E0234E) ![Prisma](https://img.shields.io/badge/prisma-ORM-blue) ![DB](https://img.shields.io/badge/mongo-replica--set-critical) ![License](https://img.shields.io/badge/license-UNLICENSED-lightgrey)

</div>

---

## 🧭 Objectif du Projet

Fournir une base robuste et évolutive pour expérimenter des fonctionnalités de productivité intelligente en équipe (priorisation IA, scoring, présence, analytics comportement, prévention burnout). Ce dépôt est le backend unique (API REST + future WebSocket) – orienté apprentissage et qualité de code.

---

## ✨ Fonctionnalités (Implémentées & Planifiées)

### ✅ Actuel

- Authentification JWT + OTP e-mail (activation + reset password)
- Gestion utilisateurs (CRUD, validation DTO, hash bcrypt)
- Upload fichiers (Multer, taille max configurable)
- Logging structuré (Pino) + middleware de requêtes
- Rate limiting / throttling configurable
- Validation stricte des variables d'environnement
- Templates e-mail (Handlebars)
- Documentation Swagger `/api/docs`

### 🚧 En cours / À venir

- Création de tâches en langage naturel
- Priorisation intelligente (modèle scoring hybride règles + IA)
- Gamification (XP, niveaux, badges, leaderboards)
- Présence temps réel & collaboration (WebSocket + Redis)
- Analytics (heatmaps productivité, focus vs multitâche)
- Détection risque burnout (heuristiques horaires + charge)
- PWA: offline sync + notifications intelligentes

---

## �️ Architecture & Stack

| Domaine          | Choix                                  |
| ---------------- | -------------------------------------- |
| Framework        | NestJS (architecture modulaire)        |
| Base de données  | MongoDB (Prisma Client) en replica set |
| Auth             | JWT + OTP + bcryptjs                   |
| Validation       | class-validator / class-transformer    |
| Logging          | nestjs-pino / pino-pretty (dev)        |
| Fichiers         | Multer (limite dynamique)              |
| Documentation    | Swagger (OpenAPI)                      |
| Tests            | Jest (unit + e2e)                      |
| Sécurité         | Helmet, throttler, validation DTO      |
| Conteneurisation | Docker / docker compose                |

---

## 📂 Structure du Projet (résumé)

```
src/
    core/            # Config, services infra, utils
    modules/
        auth/          # Auth + OTP
        user/          # Users
        file-upload/   # Upload fichiers
    templates/       # E-mails Handlebars
prisma/
    schema.prisma    # Modèle Mongo (Prisma)
scripts/           # Scripts utilitaires
```

---

## 🧪 Prérequis

| Outil              | Version recommandée           |
| ------------------ | ----------------------------- |
| Node.js            | ≥ 20.x                        |
| npm                | ≥ 10.x                        |
| MongoDB            | 6/7 (replica set obligatoire) |
| Docker (optionnel) | Latest                        |
| Redis (futur)      | Pour temps réel / cache       |

---

## 🔧 Variables d'Environnement (Validation)

Voir `.env.example`. Chaque variable est validée au démarrage.

| Variable         | Description               | Exemple                                            |
| ---------------- | ------------------------- | -------------------------------------------------- |
| NODE_ENV         | Environnement             | development                                        |
| PORT             | Port HTTP                 | 8050                                               |
| BASE_URL         | URL publique API          | http://127.0.0.1:8050/                             |
| ALLOWED_ORIGINS  | CORS CSV                  | http://localhost:3000                              |
| THROTTLE_TTL     | Fenêtre (s)               | 60                                                 |
| THROTTLE_LIMIT   | Requêtes / fenêtre        | 100                                                |
| DATABASE_URL     | Connexion Mongo (rs)      | mongodb://localhost:27017/flowspace?replicaSet=rs0 |
| JWT_SECRET       | Secret JWT                | (string)                                           |
| EMAIL\_\*        | Config SMTP               | ...                                                |
| REDIS\_\*        | Config Redis (futur)      | ...                                                |
| LOG_LEVEL        | info / debug              | debug                                              |
| LOG_FORMAT       | pretty / json             | pretty                                             |
| MAX_FILE_SIZE    | Taille max upload (bytes) | 5242880                                            |
| UPLOAD_DIRECTORY | Dossier uploads           | uploads                                            |

---


## 🧪 Tests

```bash
npm run test       # Unitaires
npm run test:e2e   # End-to-end
npm run test:cov   # Couverture
npm run lint       # Qualité / ESLint
```

Seuil couverture cible: 80%.

---

## 🔐 Sécurité (actuel & futur)

| Domaine            | Implémenté  | Évolution prévue         |
| ------------------ | ----------- | ------------------------ |
| Auth JWT           | ✅          | Refresh tokens rotatifs  |
| OTP Email          | ✅          | Expiration configurable  |
| Rate limiting      | ✅          | Par IP + clé API (futur) |
| Validation DTO     | ✅          | Schémas versionnés       |
| Headers Helmet     | ✅          | CSP stricte (futur)      |
| Logs structurés    | ✅          | Corrélation trace-id     |
| Hash mots de passe | ✅ (bcrypt) | Argon2 benchmarking      |

---

## 🧠 Roadmap (Synthèse Backend)

| Fonction            | Statut  | Commentaire                  |
| ------------------- | ------- | ---------------------------- |
| Auth + OTP          | Terminé | Base stable                  |
| Upload fichiers     | Terminé | Limites & types à durcir     |
| IA Priorisation     | À venir | Modèle scoring + pondération |
| NLU création tâches | À venir | Parsing prompt -> backlog    |
| Gamification        | À venir | XP, badges, leaderboard      |
| Temps réel présence | À venir | WS + Redis adapter           |
| Analytics heatmaps  | À venir | Agrégations temporelles      |
| Détection burnout   | À venir | Heuristiques + seuils        |
| PWA offline sync    | À venir | File d'events & merge        |

---

## 🧰 Scripts (package.json)

## 🧰 Scripts (package.json)

```bash
# Development
npm run start:dev      # Dev + watch
npm run start:prod     # Lancement dist/
npm run build          # Compilation
npm run lint           # Lint + fix
npm run format         # Prettier

# Testing
npm run test / test:e2e / test:cov

# Database (Cross-platform)
npm run db:start       # Démarrer Mongo replica (auto-détecte OS)
npm run db:stop        # Arrêter MongoDB (auto-détecte OS)
npm run db:push        # Prisma db push
npm run db:studio      # Prisma Studio
npm run db:check       # Vérifier connexion DB
npm run db:generate    # Générer Prisma Client

# Platform-specific (optionnel)
npm run db:start:mac   # macOS/Linux uniquement
npm run db:start:win   # Windows PowerShell
npm run db:start:win:bat # Windows Batch (si PowerShell bloqué)
npm run db:stop:mac    # macOS Homebrew
npm run db:stop:win    # Windows service
```

---

## 👥 Flux de Contribution Interne

1. Créer branche: `feat/xxx` ou `fix/xxx`
2. Ajouter/adapter tests (≥80%)
3. `npm run lint && npm run test`
4. Mettre à jour README si changement majeur
5. PR avec description claire (contexte + solution)

Convention commit suggérée (simplifiée) :

```
feat: ajout priorisation IA
fix: correction validation email
refactor: extraction service OTP
docs: mise à jour guide Mongo
chore: bump dépendances
test: ajout cas OTP expiré
```

---

## 🧾 Licence

Usage académique interne. Ajouter une licence open-source si diffusion publique envisagée.

---

## 💬 Support / Questions

Ouvrir une Issue (bug) ou Discussion (idée / conception). Pour décisions techniques structurantes, créer un mini ADR (`/docs/adr/XXXX-titre.md`).

---

Focus: clarté, pédagogie, extensibilité. Chaque ajout doit : (1) être testé, (2) ne pas casser l’existant, (3) respecter la cohérence architecture. 🚀

## ✨ Fonctionnalités Clés

### 🤖 Intelligence & Automatisation

- Création de tâches en langage naturel (ex: "Créer un plan de lancement Q4 avec étapes et échéances")
- Priorisation intelligente (score dynamique: urgence, impact, dépendances, charge)
- Suggestions contextuelles (regroupement, découpage, assignation recommandée)
- Détection automatique d'inactivité / tâches orphelines

### 🕹️ Gamification Avancée

- Système de points & niveaux (XP par complétion pondérée)
- Badges, défis d'équipe, quêtes collaboratives
- Leaderboards individuels et par équipe (filtrage période)
- Bonus streak & réduction de dette technique

### 👥 Collaboration Temps Réel

- Présence des membres (who is online / typing)
- Commentaires threadés + réactions
- Verrouillage optimiste & merge léger sur tâches
- Notifications in-app & email événementielles

### 📊 Analytics & Santé Organisationnelle

- Heatmaps de productivité (horaire / jour / équipe)
- Détection proactive de risque de burnout (charge + heures tardives)
- Tableau de bord focus vs multitâche
- KPI: velocity, lead time, throughput, flow efficiency

### 📱 PWA & Expérience Offline

- Synchronisation offline-first (file d'events + résolutions)
- Notifications intelligentes (regroupement & priorité)
- Cache adaptatif (tâches actives + métadonnées fréquentes)

### 🔐 Sécurité & Observabilité

- Authentification JWT + OTP e-mail (activation / récupération)
- Limitation de débit (throttling configurable)
- Logs structurés (Pino) + corrélation requêtes
- Validation stricte environnement & inputs

## 🏗️ Architecture Backend

| Domaine          | Implémentation                      |
| ---------------- | ----------------------------------- |
| Framework        | NestJS (modules indépendants)       |
| Base de données  | MongoDB via Prisma Client           |
| Auth             | JWT, OTP, hash bcryptjs             |
| Mail             | Nodemailer + Handlebars templates   |
| Logging          | nestjs-pino + pino-pretty en dev    |
| Validation       | class-validator / class-transformer |
| Documentation    | Swagger (route: `/api/docs`)        |
| Tests            | Jest (unit + e2e)                   |
| Conteneurisation | Docker + docker-compose             |
| Performance      | Compression, Helmet, Throttler      |

> Les modules IA (priorisation, NLU) & temps réel (WebSocket / Redis pub-sub) seront ajoutés progressivement.

## 📂 Structure du Projet

```
src/
   core/            # Infrastructure, config, utilitaires
   modules/
      auth/          # Authentification & OTP
      user/          # Gestion utilisateurs
      file-upload/   # Upload fichiers
   templates/       # Templates e-mail (Handlebars)
prisma/
   schema.prisma    # Modèle Prisma (MongoDB)
```

## 🚀 Démarrage Rapide

```bash
git clone <repo-url> flow-space-backend
cd flow-space-backend
cp .env.example .env   # Configurer les variables
npm install
npx prisma generate
npx prisma db push
npm run start:dev
```

Swagger disponible sur: http://localhost:3000/api/docs


## 🔧 Variables d'Environnement (Validation Strict)

| Variable         | Description              | Exemple                         |
| ---------------- | ------------------------ | ------------------------------- |
| NODE_ENV         | Environnement            | development                     |
| PORT             | Port HTTP                | 3000                            |
| BASE_URL         | URL publique             | https://api.flow-space.dev      |
| ALLOWED_ORIGINS  | CORS liste (CSV)         | http://localhost:3000           |
| THROTTLE_TTL     | Fenêtre (s)              | 60                              |
| THROTTLE_LIMIT   | Requêtes / fenêtre       | 100                             |
| DATABASE_URL     | Connexion Mongo          | mongodb+srv://...               |
| JWT_SECRET       | Secret JWT               | (string)                        |
| EMAIL_HOST       | SMTP Host                | smtp.gmail.com                  |
| EMAIL_PORT       | SMTP Port                | 587                             |
| EMAIL_USER       | SMTP User                | bot@flow-space.dev              |
| EMAIL_PASSWORD   | SMTP Pass                | (secret)                        |
| EMAIL_FROM       | Expéditeur               | Flow Space <bot@flow-space.dev> |
| REDIS_HOST       | Host cache / events      | 127.0.0.1                       |
| REDIS_PORT       | Port Redis               | 6379                            |
| REDIS_PASSWORD   | Mot de passe (optionnel) | (secret)                        |
| LOG_LEVEL        | Niveau logs              | info                            |
| LOG_FORMAT       | Format (json/pretty)     | pretty                          |
| MAX_FILE_SIZE    | Upload max (bytes)       | 5242880                         |
| UPLOAD_DIRECTORY | Dossier fichiers         | ./uploads                       |

## 🧠 Roadmap Fonctionnelle (Backend)

| Étape                | Statut | Détails                           |
| -------------------- | ------ | --------------------------------- |
| Auth de base + OTP   | ✅     | Activation + reset password       |
| Gestion utilisateurs | ✅     | CRUD + validation                 |
| Upload fichiers      | ✅     | Multer + limites                  |
| Priorisation IA      | 🔜     | Modèle scoring + règles hybrides  |
| Création NL (NLU)    | 🔜     | Parsing prompt -> tâches          |
| Temps réel présence  | 🔜     | WebSocket + Redis adapter         |
| Gamification moteur  | 🔜     | Calcul XP + badges                |
| Analytics heatmaps   | 🔜     | Agrégations temporelles           |
| Burnout detection    | 🔜     | Heuristiques + signal charges     |
| PWA sync offline     | 🔜     | File events + résolution conflits |

## 🧪 Tests

```bash
npm run test          # Unitaires
npm run test:e2e      # End-to-end
npm run test:cov      # Couverture
npm run lint          # Qualité code
```

Seuil couverture global: 80% (branches, functions, lines, statements).

## 🛡️ Sécurité

- Headers sécurisés (Helmet)
- Rate limiting / Throttler
- Validation des DTO stricte
- Hash mots de passe (bcryptjs)
- Tokens courts + refresh (à implémenter)
- Logs structurés + traçabilité

## 📦 Docker

```bash
docker build -t flow-space-api .
docker compose up -d
```

## 🧰 Scripts Utiles

```bash
npm run start:dev      # Dev watch
npm run start:prod     # Prod (dist)
npm run build          # Compilation
npm run format         # Formatage Prettier
npm run security:audit # Audit dépendances
```

## 🗺️ Extension Futur (Idées)

- Intégration IA hybride (règles + LLM) pour priorisation
- Module knowledge base contextuel
- Moteur recommandation équipe (charge / compétences)
- Export analytics (CSV / Data Lake)
- Webhooks + intégrations (Slack, Jira, GitHub)

## 🤝 Contribution

1. Fork
2. Branche feature: `feat/<nom>`
3. Tests + lint
4. PR avec description claire

## 📜 Licence

UNLICENSED – usage interne ou selon politique propriétaire. Ajouter une licence si diffusion publique prévue.

## 💬 Support

Questions / idées : ouvrir une Issue ou démarrer une Discussion.

---

Focus sur la valeur et la clarté : chaque module vise la robustesse, l'observabilité et l'extensibilité. 🚀

## 🚨 Initial Setup

1. **Environment Setup**

    ```bash
    # Copy and configure environment variables
    cp .env.example .env
    ```

2. **Configure GitHub Repository Secrets**

    ```bash
    # Deployment Secrets
    PROD_HOST=
    PROD_SSH_USERNAME=
    PROD_SSH_PRIVATE_KEY=
    DEV_HOST=
    DEV_SSH_USERNAME=
    DEV_SSH_PRIVATE_KEY=

    # Environment Secrets
    TEST_ENV=           # Test environment variables
    DATABASE_URL=       # Production database URL

    # Integration Secrets
    SONAR_TOKEN=        # SonarCloud analysis token
    GITHUB_TOKEN=       # GitHub access token

    # Email Secrets (Optional)
    EMAIL_USER=
    EMAIL_PASSWORD=
    ```

3. **Database Setup**

    ```bash
    npx prisma generate
    npx prisma db push
    ```

4. **Start Development**
    ```bash
    npm install
    npm run start:dev
    ```

## 🎯 Prerequisites

- Node.js (v22+)
- MongoDB (v4.4+)
- npm or yarn
- PM2 (for production)

## 🚀 Quick Start

```bash
# 1. Create from template
git clone https://github.com/yourusername/nestjs-template.git my-project
cd my-project

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env

# 4. Start development server
npm run start:dev
```

## ⚡️ Template Features

- 🏗️ Production-Ready Architecture
- 🔐 JWT Authentication & Authorization
- 📚 Swagger API Documentation
- 🗄️ MongoDB with Prisma ORM
- ✅ Comprehensive Testing Setup
- 🔄 CI/CD with GitHub Actions
- 📊 Monitoring & Logging
- 🛡️ Security Best Practices
- 🎯 Input Validation & Error Handling

## Technology Stack

- **Framework**: NestJS
- **Language**: TypeScript
- **Database**: MongoDB
- **Authentication**: JWT
- **Testing**: Jest
- **Documentation**: Swagger/OpenAPI

## Using This Template

1. **Create New Repository**

```bash
# Use this template from GitHub
Click "Use this template" button on GitHub
# OR clone and reinitialize
git clone https://github.com/yourusername/nestjs-template.git my-project
cd my-project
rm -rf .git
git init
```

2. **Update Project Configuration**

```bash
# Update package.json
- Change name, description, and author
- Update repository URLs

# Update environment variables
cp .env.example .env

# Update deployment configurations
- Edit deploy.sh with your app name
- Update .github/workflows/* with your deployment details
```

## Prisma & Schema Updates

Note: Prisma Migrate is not supported for MongoDB. Ensure you have a MongoDB instance running and the DATABASE_URL environment variable set in your .env file. Then, synchronize your Prisma schema with:

```bash
npx prisma db push
```

This command updates your MongoDB collections to match the Prisma schema. After pushing changes, update the Prisma Client with:

```bash
npx prisma generate
```

Ensure you have a backup of your MongoDB data before modifying the schema.

## API Documentation

API documentation is available at `/api/docs` when running the server.

### Team & Project Management Endpoints

#### Team Management

**Create Team**
```bash
curl -X POST http://localhost:3000/api/v1/teams \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Development Team",
    "description": "Main development team for the project"
  }'
```

**List My Teams**
```bash
curl -X GET http://localhost:3000/api/v1/teams/mine \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Invite User to Team** (Sends Email Invitation)
```bash
curl -X POST http://localhost:3000/api/v1/teams/{teamId}/invites \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "role": "MEMBER"
  }'
```

This will send an email invitation to the specified user with:
- **One-click join button** (like GitHub) for instant acceptance
- Team details and invitation context  
- Secure invitation token with 7-day expiration
- Role assignment information
- Alternative methods for API or manual acceptance

**Accept Team Invitation**

Option 1: Direct link from email (one-click):
```bash
curl -X GET http://localhost:3000/api/v1/teams/invite/accept/{token} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Option 2: Manual API call:
```bash
curl -X POST http://localhost:3000/api/v1/teams/accept-invite \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "INVITATION_TOKEN_FROM_EMAIL"
  }'
```

**Remove Team Member**
```bash
curl -X POST http://localhost:3000/api/v1/teams/{teamId}/remove/{userId} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Project Management

**Create Project**
```bash
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "teamId": "TEAM_ID",
    "name": "Mobile App Project",
    "description": "Development of the mobile application"
  }'
```

**List Projects by Team**
```bash
curl -X GET http://localhost:3000/api/v1/projects/by-team/{teamId} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get Project Details**
```bash
curl -X GET http://localhost:3000/api/v1/projects/{projectId} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Update Project**
```bash
curl -X PUT http://localhost:3000/api/v1/projects/{projectId} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Project Name",
    "description": "Updated project description"
  }'
```

**Delete Project**
```bash
curl -X DELETE http://localhost:3000/api/v1/projects/{projectId} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Enhanced Task Management

**Create Task with Project**
```bash
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement user authentication",
    "description": "Add JWT authentication to the API",
    "priority": "HIGH",
    "projectId": "PROJECT_ID",
    "dueDate": "2025-12-31T23:59:59.000Z"
  }'
```

**List Tasks by Project**
```bash
curl -X GET "http://localhost:3000/api/v1/tasks?projectId=PROJECT_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Update Task Project**
```bash
curl -X PUT http://localhost:3000/api/v1/tasks/{taskId} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "NEW_PROJECT_ID"
  }'
```

#### Role-Based Access Control

- **OWNER**: Full control over team (invite, remove members, create projects, manage all team resources)
- **ADMIN**: Can invite members, create projects, manage team projects (cannot remove OWNER)
- **MEMBER**: Can view team resources, participate in projects, manage own tasks

#### Authorization Rules

1. **Team Access**: Only team members can view team details and projects
2. **Admin Actions**: Only OWNER/ADMIN can invite users, remove members, and create projects
3. **Project Tasks**: Users can only assign tasks to projects if they're members of the project's team
4. **Task Management**: Users can only manage their own tasks, but project assignment requires team membership

#### Email Notifications

Team invitations automatically send email notifications with:
- **Template**: Professional HTML email with team details
- **Security**: Secure token-based invitations with 7-day expiration
- **Context**: Inviter information, team description, role assignment
- **Instructions**: Clear steps for accepting invitations
- **Fallback**: Token displayed in development mode for testing

**Email Configuration Required:**
```bash
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USER=your-email@domain.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@your-domain.com

# For direct invitation links
BASE_URL=https://api.your-domain.com
FRONTEND_URL=https://app.your-domain.com
```

**Features:**
- ✅ **One-click join button** - Users can accept invitations directly from the email
- ✅ **Professional email design** - Modern, responsive template with team branding
- ✅ **Multiple acceptance methods** - Direct link, API call, or manual token entry
- ✅ **Secure tokens** - 64-character hex tokens with 7-day expiration
- ✅ **Rich context** - Team details, inviter info, role assignment
- ✅ **Smart redirection** - Automatic redirect to team dashboard after acceptance

## Project Structure

```
src/
├── app.module.ts
├── core
│   ├── common
│   │   ├── filters
│   │   ├── guards
│   │   │   └── auth.guard.ts
│   │   ├── interceptors
│   │   ├── middleware
│   │   │   └── logger.middleware.ts
│   │   └── pipes
│   ├── config
│   │   ├── env.validation.ts
│   │   └── swagger.config.ts
│   ├── constants
│   ├── exceptions
│   ├── services
│   │   ├── base.service.ts
│   │   └── prisma.service.ts
│   └── utils
│       ├── auth.ts
│       ├── helpers.ts
│       ├── logger.ts
│       └── validation.ts
├── main.ts
├── modules
│   └── user
│       ├── dto
│       │   └── user.dto.ts
│       ├── user.controller.spec.ts
│       ├── user.controller.ts
│       ├── user.module.ts
│       ├── user.service.spec.ts
│       └── user.service.ts
└── templates
    ├── reset-password.hbs
    └── verify-account.hbs
```

## Testing

```bash
# Unit tests - runs fast unit tests
npm run test

# Watch mode tests - continuously runs tests on file changes
npm run test:watch

# Debug tests - enables debug mode for troubleshooting test failures
npm run test:debug

# End-to-end tests - verifies API endpoints and integrations
npm run test:e2e

# Test coverage - generates comprehensive coverage reports
npm run test:cov

# Performance tests - simulates load using k6 performance testing
npm run test:performance

# Security audit - checks for vulnerabilities in project dependencies
npm run security:audit
```

## Testing Strategy

### Unit Tests

```bash
npm run test
```

- Tests individual components in isolation
- Located in `*.spec.ts` files next to the implementation
- Coverage threshold: 80% for all metrics

### Integration Tests

```bash
npm run test:e2e
```

- Tests API endpoints and service interactions
- Located in `test/` directory
- Includes database integration tests

### Performance Tests

```bash
npm run test:performance
```

- Uses k6 for load testing
- Tests API endpoints under load
- Measures response times and error rates
- Located in `tests/performance/`

### Security Tests

```bash
npm run security:audit
```

- npm audit for dependency vulnerabilities
- CodeQL analysis for code security
- Regular security patches

### Code Quality

```bash
npm run lint        # ESLint checks
npm run quality:sonar  # SonarCloud analysis
```

- Enforces coding standards
- Identifies code smells and bugs
- Maintains maintainability metrics

## Development Tools

### Available Scripts

```bash
npm run start:dev   # Development with hot reload
npm run start:debug # Debug mode
npm run start:prod  # Production mode
npm run build       # Production build
npm run format      # Format code with Prettier
```

### API Documentation

- Swagger UI: `/api/docs`

## Docker Support

```bash
# Build the container
docker build -t personal-template-nestjs-api .

# Run with Docker Compose
docker-compose up -d
```

## Monitoring & Logging

- Application metrics: Prometheus
- Logging: Winston
- Error tracking: Sentry

## Monitoring & Observability

### Logging

- Structured logging with Pino
- Log levels: error, warn, info, debug
- Request/Response logging middleware

### Health Checks

- Endpoint: `/health`
- Checks database connection
- Monitors external service dependencies

### Performance Monitoring

- Response time metrics
- Request rate tracking
- Error rate monitoring
- Resource usage stats

## Security Features

- JWT Authentication
- Rate limiting
- CORS protection
- Helmet security headers
- Input validation
- SQL injection protection
- XSS prevention

## Secrets Configuration

Ensure the following secrets are defined in your CI/CD environment (e.g., GitHub repository settings):

- PROD_HOST: Production server hostname or IP.
- PROD_SSH_USERNAME: SSH username for production deployments.
- PROD_SSH_PRIVATE_KEY: SSH private key for production deployments.
- DEV_HOST: Development server hostname or IP.
- DEV_SSH_USERNAME: SSH username for development deployments.
- DEV_SSH_PRIVATE_KEY: SSH private key for development deployments.
- SONAR_TOKEN: Token for SonarCloud analysis.
- TEST_ENV: Test environment variables.
- DATABASE_URL: Production database URL.

## Template Customization

### Module Structure

```
src/
├── modules/           # Feature modules
│   ├── auth/         # Authentication module
│   ├── user/         # User management
│   └── your-module/  # Add your modules here
```

### Adding New Features

```bash
# Generate new module
nest g module modules/your-module

# Generate CRUD resources
nest g resource modules/your-module
```

### 1. Application Name

- Update `package.json`
- Modify `deploy.sh`
- Update GitHub workflow files
- Change name in Swagger configuration

### 2. Environment Configuration

```bash
   # Copy and configure environment variables
   cp .env.example .env
```

### 3. Module Structure

The template follows a modular architecture:

```
src/
├── modules/           # Feature modules
│   ├── auth/         # Authentication module
│   ├── user/         # User management
│   └── your-module/  # Add your modules here
```

### 4. Adding New Modules

```bash
# Generate new module
nest g module modules/your-module

# Generate CRUD resources
nest g resource modules/your-module
```

### 5. Database Configuration

- Update `prisma/schema.prisma` with your models
- Run `npx prisma generate` after changes
- Modify `PrismaService` if needed

## Template Maintenance

### Updating Dependencies

```bash
# Check outdated packages
npm outdated

# Update packages
npm update

# Update major versions
npx npm-check-updates -u
```

### Contributing to Template

1. Fork the template repository
2. Create feature branch
3. Commit changes
4. Create Pull Request

## Support & Updates

- 📦 Regular dependency updates
- 🐛 Bug fixes via GitHub issues
- 💡 Feature requests welcome
- 📖 Documentation improvements
