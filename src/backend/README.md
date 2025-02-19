# Startup Metrics Benchmarking Platform - Backend Services

## Overview

Enterprise-grade microservices architecture powering the Startup Metrics Benchmarking Platform. Built with Node.js 18 LTS, TypeScript, and modern cloud-native technologies.

## Architecture

### Services
- **API Gateway** (Port 3000)
  - Request routing and validation
  - Rate limiting and caching
  - Authentication middleware
  - Response transformation

- **Auth Service** (Port 3001)
  - Google OAuth integration
  - JWT token management
  - Session handling
  - Role-based access control

- **Metrics Service** (Port 3002)
  - Metric calculations
  - Benchmark data processing
  - Data validation
  - Caching layer

- **Admin Service** (Port 3003)
  - User management
  - System configuration
  - Audit logging
  - Platform monitoring

- **Report Service** (Port 3004)
  - Report generation
  - Data export
  - Template management
  - Caching

### Infrastructure
- PostgreSQL 14 (Port 5432)
- Redis 6.2 (Port 6379)
- Docker & Docker Compose
- Kubernetes orchestration

## Prerequisites

- Node.js >= 18.0.0
- Docker >= 20.10.0
- Docker Compose >= 2.0.0
- PostgreSQL 14
- Redis 6.2

## Project Structure

```
src/backend/
├── src/
│   ├── admin-service/    # Platform administration
│   ├── auth-service/     # Authentication & authorization
│   ├── metrics-service/  # Metric processing
│   ├── report-service/   # Report generation
│   ├── api-gateway/      # API routing & middleware
│   └── shared/           # Shared utilities & types
├── docker-compose.yml    # Development orchestration
├── package.json         # Workspace configuration
└── tsconfig.json       # TypeScript configuration
```

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/startup-metrics/platform.git
cd platform/src/backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start development environment:
```bash
npm run docker:up
```

5. Initialize database:
```bash
npm run prisma:generate
npm run prisma:migrate
```

6. Start development server:
```bash
npm run dev
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build production artifacts
- `npm run test` - Run test suite
- `npm run lint` - Run code linting
- `npm run format` - Format code with Prettier
- `npm run docker:up` - Start Docker services
- `npm run docker:down` - Stop Docker services

### Code Style

- ESLint configuration with TypeScript support
- Prettier for code formatting
- Husky for Git hooks
- Jest for testing

### Security

- Helmet for HTTP headers
- Rate limiting with Redis
- CORS configuration
- JWT authentication
- Input validation
- Data encryption

### Performance

- Redis caching
- Response compression
- Connection pooling
- Resource limits
- Health checks

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Deployment

### Production Build

```bash
# Build all services
npm run build

# Build Docker images
npm run docker:build
```

### Environment Configuration

Required environment variables:
```
NODE_ENV=production
PORT=3000
POSTGRES_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
JWT_SECRET=your_jwt_secret
```

### Health Checks

All services expose a `/health` endpoint that returns:
- Service status
- Database connectivity
- Redis connectivity
- System resources

## API Documentation

API documentation is available at:
- Development: http://localhost:3000/api-docs
- Production: https://api.startup-metrics.com/api-docs

## Monitoring

- Prometheus metrics at `/metrics`
- Winston logging with daily rotation
- OpenTelemetry tracing
- Resource monitoring
- Error tracking

## Maintenance

### Backup Strategy

- Database: Daily automated backups
- File storage: Continuous replication
- Configuration: Version controlled
- Logs: 30-day retention

### Scaling Guidelines

- Horizontal scaling via Kubernetes
- Redis cluster for caching
- PostgreSQL read replicas
- CDN for static assets

## Support

For technical support:
- Email: devops@startup-metrics.com
- Slack: #platform-support
- Documentation: https://docs.startup-metrics.com

## License

Private and Confidential - Startup Metrics Platform
Copyright © 2023 Startup Metrics. All rights reserved.