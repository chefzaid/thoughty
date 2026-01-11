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

const app = express();

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
    },
    apis: ['./src/routes/*.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Middleware
app.use(compression());
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api/entries', entriesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/config', configRouter);
app.use('/api/io', ioRouter);
app.use('/api/diaries', diariesRouter);

// Start server only when run directly
const PORT = 3001;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
