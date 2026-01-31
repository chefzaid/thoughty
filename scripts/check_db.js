const db = require('../server/src/db');

async function check() {
    try {
        const settings = await db.query('SELECT user_id, key, substring(value, 1, 50) as value_preview FROM settings');
        console.log('Settings:', JSON.stringify(settings.rows, null, 2));
        
        const users = await db.query('SELECT id, username, email, avatar_url FROM users');
        console.log('Users:', JSON.stringify(users.rows, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit(0);
    }
}

check();
