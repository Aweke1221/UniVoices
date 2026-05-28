import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query('SELECT id, student_id, university_id, description FROM complaints');
  console.log("COMPLAINTS:", res.rows);
  const users = await client.query('SELECT id, role, university_id FROM users');
  console.log("USERS:", users.rows);
  await client.end();
}
run();
