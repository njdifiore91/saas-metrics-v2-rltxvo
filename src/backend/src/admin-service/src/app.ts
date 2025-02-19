/**
 * Admin Service Application Entry Point
 * Implements secure admin functionality with comprehensive monitoring and security controls
 * @version 1.0.0
 */

import express, { Express, Request, Response, NextFunction } from 'express'; // v4.18.2
import helmet from 'helmet'; // v6.0.0
import cors from 'cors'; // v2.8.5
import compression from 'compression'; // v1.7.4
import morgan from 'morgan'; // v1.10.0
import rateLimit from 'express-rate-limit'; // v6.7.0
import pino from 'pino'; // v8.11.0
import { AdminController } from './controllers/admin.controller';
import { prisma } from './config/database.config';
import { Logger } from '../shared/utils/logger';
import { HTTP_STATUS_CODES, SYSTEM_ERRORS, ErrorResponse } from '../shared/constants/error-codes';

// Environment variables with defaults
const PORT = process.env.ADMIN_SERVICE_PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGINS = process.env.ADMIN_CORS_ORIGINS?.split(',') || [];
const RATE_LIMIT_WINDOW = Number(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 100;

// Initialize logger
const logger = new Logger('AdminService');

// Initialize Express application
const app: Express = express();

/**
 * Initializes application middleware with enhanced security and monitoring
 * @param app Express application instance
 */
function initializeMiddleware(app: Express): void {
    // Security headers middleware
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
            },
        },
        crossOriginEmbedderPolicy: true,
        crossOriginOpenerPolicy: true,
        crossOriginResourcePolicy: { policy: "same-site" },
        dnsPrefetchControl: true,
        frameguard: { action: 'deny' },
        hidePoweredBy: true,
        hsts: true,
        ieNoOpen: true,
        noSniff: true,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
        xssFilter: true,
    }));

    // CORS middleware with strict origin validation
    app.use(cors({
        origin: (origin, callback) => {
            if (!origin || CORS_ORIGINS.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('CORS not allowed'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        maxAge: 600, // 10 minutes
    }));

    // Request parsing middleware
    app.use(express.json({ limit: '10kb' }));
    app.use(express.urlencoded({ extended: true, limit: '10kb' }));

    // Compression middleware
    app.use(compression());

    // Rate limiting middleware
    app.use(rateLimit({
        windowMs: RATE_LIMIT_WINDOW,
        max: RATE_LIMIT_MAX,
        message: { error: SYSTEM_ERRORS.SYS001 },
        standardHeaders: true,
        legacyHeaders: false,
    }));

    // Request logging middleware
    app.use(morgan('combined', {
        skip: (req) => req.url === '/health',
        stream: {
            write: (message) => logger.info('HTTP Request', { message: message.trim() })
        }
    }));

    // Trust proxy in production
    if (NODE_ENV === 'production') {
        app.set('trust proxy', 1);
    }
}

/**
 * Initializes API routes with enhanced security and monitoring
 * @param app Express application instance
 */
function initializeRoutes(app: Express): void {
    const adminController = new AdminController();

    // Health check endpoint
    app.get('/health', (req: Request, res: Response) => {
        res.status(HTTP_STATUS_CODES.OK).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: NODE_ENV,
            version: process.env.npm_package_version
        });
    });

    // Admin routes with rate limiting
    app.use('/api/v1/admin', adminController.getRateLimiter());
    app.post('/api/v1/admin', adminController.createAdmin);
    app.get('/api/v1/admin/:id', adminController.getAdmin);
    app.put('/api/v1/admin/:id', adminController.updateAdmin);
    app.delete('/api/v1/admin/:id', adminController.deleteAdmin);
    app.get('/api/v1/admin', adminController.listAdmins);

    // 404 handler
    app.use((req: Request, res: Response) => {
        res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
            error: 'Endpoint not found'
        });
    });

    // Error handler
    app.use((err: Error | ErrorResponse, req: Request, res: Response, next: NextFunction) => {
        logger.error('Unhandled error', err);

        const statusCode = 'status' in err ? err.status : HTTP_STATUS_CODES.SERVER_ERROR;
        const errorResponse = {
            error: err.message || SYSTEM_ERRORS.SYS003,
            status: statusCode,
            timestamp: new Date().toISOString(),
            path: req.path,
            correlationId: req.headers['x-correlation-id']
        };

        res.status(statusCode).json(errorResponse);
    });
}

/**
 * Starts the Express server with enhanced startup checks and graceful shutdown
 */
async function startServer(): Promise<void> {
    try {
        // Initialize middleware
        initializeMiddleware(app);

        // Initialize routes
        initializeRoutes(app);

        // Connect to database
        await prisma.$connect();

        // Start server
        const server = app.listen(PORT, () => {
            logger.info(`Admin service started`, {
                port: PORT,
                environment: NODE_ENV,
                timestamp: new Date().toISOString()
            });
        });

        // Graceful shutdown
        process.on('SIGTERM', async () => {
            logger.info('SIGTERM received, shutting down gracefully');
            await prisma.$disconnect();
            server.close(() => {
                logger.info('Server closed');
                process.exit(0);
            });
        });

    } catch (error) {
        logger.error('Failed to start admin service', error);
        process.exit(1);
    }
}

// Start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
    startServer();
}

export default app;