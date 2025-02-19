# Startup Metrics Benchmarking Platform - Frontend

## Overview

Enterprise-grade web frontend for the Startup Metrics Benchmarking Platform, providing interactive metric visualization and comparison tools for startup performance analysis.

## Technology Stack

- React 18.2+ with TypeScript 4.9+
- Material UI 5.0+ for component library
- D3.js 7.0+ for data visualization
- React Query 4.0+ for API data management
- Redux Toolkit 1.9+ for state management

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn package manager
- Modern web browser (see browserslist in package.json)

## Getting Started

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Development Scripts

```bash
# Run tests
npm run test                 # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Generate coverage report

# Code quality
npm run lint                # Check for linting issues
npm run lint:fix            # Fix linting issues
npm run format             # Format code with Prettier
npm run typecheck          # Type checking
```

## Project Structure

```
src/
├── assets/           # Static assets (images, fonts, etc.)
├── components/       # Reusable UI components
│   ├── common/      # Generic components
│   ├── metrics/     # Metric-specific components
│   └── layout/      # Layout components
├── config/          # Configuration files
├── hooks/           # Custom React hooks
├── pages/           # Page components
├── services/        # API services
├── store/           # Redux store configuration
├── styles/          # Global styles
├── types/           # TypeScript type definitions
└── utils/           # Utility functions
```

## Configuration

### TypeScript Configuration

Key compiler options from tsconfig.json:
- Target: ESNext
- Strict mode enabled
- React JSX mode
- Path aliases configured
- Comprehensive type checking

### Development Environment

- ESLint 8+ for code linting
- Prettier 2+ for code formatting
- Jest 29+ for testing
- Vite 4+ for development and building

## Architecture

### Component Architecture

- Atomic design principles
- Strict prop typing
- Error boundary implementation
- Performance optimization with React.memo and useMemo
- Accessibility compliance (WCAG 2.1 AA)

### State Management

- Redux Toolkit for global state
- React Query for server state
- Local state with useState/useReducer
- Context API for theme/auth

### API Integration

- Axios with retry capability
- Request/response interceptors
- Error handling middleware
- Response caching strategy
- Type-safe API calls

## Security

- Google OAuth 2.0 integration
- JWT token management
- XSS prevention
- CSRF protection
- Secure HTTP headers
- Input sanitization

## Performance Optimization

- Code splitting
- Lazy loading
- Image optimization
- Bundle size optimization
- Virtual scrolling for large lists
- Memoization strategies

## Testing Strategy

- Jest for unit testing
- React Testing Library
- Accessibility testing
- Performance testing
- Mock service worker
- Comprehensive test coverage

## Browser Support

Production:
- Modern browsers (>0.2% market share)
- No dead browsers
- No Opera Mini

Development:
- Latest Chrome
- Latest Firefox
- Latest Safari

## Contributing

1. Follow TypeScript strict mode
2. Ensure tests pass
3. Follow ESLint rules
4. Use Prettier formatting
5. Write documentation
6. Create meaningful commits

## License

Private - All rights reserved

## Support

Contact the development team for support and questions.