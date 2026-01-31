const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const compression = require('compression');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const entriesRouter = require('./src/routes/entries');
const statsRouter = require('./src/routes/stats');
const configRouter = require('./src/routes/config');
const ioRouter = require('./src/routes/io');
const diariesRouter = require('./src/routes/diaries');
const authRouter = require('./src/routes/auth');
const { authenticateToken } = require('./src/middleware/authMiddleware');
const {
    helmetConfig,
    apiLimiter,
    xssSanitizer,
    securityHeaders,
    hpp,
    requestSizeLimiter
} = require('./src/middleware/securityMiddleware');

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware (apply early)
app.use(helmetConfig);
app.use(securityHeaders);

// Swagger configuration
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Journal API',
            version: '1.0.0',
            description: 'API for Managing Journal Entries',
        },
        servers: [
            {
                url: 'http://localhost:3001',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter your JWT access token'
                }
            }
        },
        security: [
            {
                bearerAuth: []
            }
        ]
    },
    apis: ['./src/routes/*.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, {
    swaggerOptions: {
        persistAuthorization: true
    }
}));

// Middleware
app.use(compression());

// CORS configuration with whitelist
const corsOptions = {
    origin: process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400 // 24 hours
};
app.use(cors(corsOptions));

// Body parsing with size limits
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));

// HTTP Parameter Pollution protection
app.use(hpp);

// XSS sanitization
app.use(xssSanitizer);

// Rate limiting for API routes
app.use('/api', apiLimiter);

// Public routes (no authentication required)
app.use('/api/auth', authRouter);

// Protected routes (authentication required)
app.use('/api/entries', authenticateToken, entriesRouter);
app.use('/api/stats', authenticateToken, statsRouter);
app.use('/api/config', authenticateToken, configRouter);
app.use('/api/io', authenticateToken, ioRouter);
app.use('/api/diaries', authenticateToken, diariesRouter);

// Start server only when run directly
const PORT = 3001;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
