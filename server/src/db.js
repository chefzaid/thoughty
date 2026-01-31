const { Pool } = require('pg');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbConfig = {
    user: process.env.POSTGRES_USER || 'postgres',
    // When running the server on the host machine (common on Windows), the dev DB
    // container is exposed on localhost:5432. The hostname "db" only resolves
    // when the server itself runs inside the docker-compose network.
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'journal',
    password: process.env.POSTGRES_PASSWORD || 'password',
    port: process.env.POSTGRES_PORT || 5432,
};

const pool = new Pool(dbConfig);


module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
