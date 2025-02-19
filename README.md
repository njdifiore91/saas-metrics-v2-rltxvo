# Startup Metrics Benchmarking Platform

A comprehensive web-based platform providing benchmark data and comparison tools for startup performance metrics. The platform enables founders and executives to evaluate their performance against industry standards within specific revenue ranges.

## Overview

The Startup Metrics Benchmarking Platform offers:
- Multi-source benchmark data integration
- Interactive metric visualization and comparison
- Role-based access control
- Secure data handling and compliance
- Enterprise-grade scalability

## Technology Stack

### Frontend
- React 18.2+ with TypeScript 4.9+
- Material UI 5.0+
- D3.js 7.0+ for visualizations
- React Query 4.0+
- Redux Toolkit 1.9+

### Backend
- Node.js 18 LTS
- Express.js 4.18+
- PostgreSQL 14+
- Redis 6.2+
- Docker & Kubernetes

## Prerequisites

- Node.js >= 18.0.0
- Docker >= 20.10.0
- Docker Compose >= 2.0.0
- PostgreSQL 14+
- Redis 6.2+

## Project Structure

```
/
├── src/
│   ├── backend/                 # Backend services
│   │   ├── admin-service/      # Platform administration
│   │   ├── auth-service/       # Authentication & authorization
│   │   ├── metrics-service/    # Metric processing
│   │   ├── report-service/     # Report generation
│   │   ├── api-gateway/        # API routing & middleware
│   │   └── shared/             # Shared utilities & types
│   └── web/                    # Frontend application
│       ├── components/         # React components
│       ├── pages/             # Page components
│       ├── services/          # API services
│       ├── store/             # Redux store
│       └── utils/             # Utility functions
├── infrastructure/            # Infrastructure as code
└── docs/                     # Documentation
```

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/startup-metrics/platform.git
cd platform
```

2. Install dependencies:
```bash
# Backend dependencies
cd src/backend
npm install

# Frontend dependencies
cd ../web
npm install
```

3. Configure environment variables:
```bash
# Backend
cp src/backend/.env.example src/backend/.env
# Edit .env with your configuration

# Frontend
cp src/web/.env.example src/web/.env
# Edit .env with your configuration
```

4. Start development environment:
```bash
# Start backend services
cd src/backend
npm run docker:up

# Start frontend development server
cd ../web
npm run dev
```

## Development

### Available Scripts

Backend:
```bash
npm run dev           # Start development server
npm run build        # Build production artifacts
npm run test         # Run test suite
npm run lint         # Run code linting
npm run docker:up    # Start Docker services
```

Frontend:
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run tests
npm run lint         # Check for linting issues
npm run typecheck    # Type checking
```

## Deployment

### Production Build

```bash
# Build backend services
cd src/backend
npm run build
npm run docker:build

# Build frontend
cd ../web
npm run build
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

## Security

- Google OAuth 2.0 authentication
- JWT token-based authorization
- Role-based access control
- Data encryption at rest and in transit
- Regular security scanning
- API rate limiting

## Monitoring

- Prometheus metrics
- ELK stack for logging
- OpenTelemetry tracing
- Health check endpoints
- Resource monitoring
- Error tracking

## Support

For technical support:
- Email: devops@startup-metrics.com
- Slack: #platform-support
- Documentation: https://docs.startup-metrics.com

## License

Private and Confidential - Startup Metrics Platform
Copyright © 2023 Startup Metrics. All rights reserved.