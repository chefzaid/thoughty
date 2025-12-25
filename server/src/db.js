const { Pool } = require('pg');
require('dotenv').config();

const dbConfig = {
    user: process.env.POSTGRES_USER || 'postgres',
    host: process.env.POSTGRES_HOST || 'db',
    database: process.env.POSTGRES_DB || 'journal',
    password: process.env.POSTGRES_PASSWORD || 'password',
    port: process.env.POSTGRES_PORT || 5432,
};

const pool = new Pool(dbConfig);


module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
