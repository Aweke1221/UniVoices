import pg from "pg";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";

dotenv.config();

const { Pool } = pg;

// Lazy initialize pool to accommodate missing env vars during build/setup
let pool: pg.Pool | null = null;
let useLocalFallback = false;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.warn("DATABASE_URL is not set. Database operations will default to local fallback.");
    } else if (connectionString && (connectionString.startsWith("http://") || connectionString.startsWith("https://"))) {
      console.error("DATABASE_URL must be a PostgreSQL connection string (postgresql://...), not an HTTP/REST URL.");
    }
    pool = new Pool({
      connectionString: connectionString || undefined,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 2000, // Fast connection check - fail over to local JSON DB in 2 seconds instead of 10
      query_timeout: 10000,          // Query executes in max 10 seconds
    });
    
    // Test the connection immediately and log issues
    pool.on('error', (err: any) => {
      console.error('Unexpected error on idle database client', err.message);
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        console.warn('⚠️ Postgres connection failed. Entering local file-based database fallback mode...');
        useLocalFallback = true;
      }
    });
  }
  return pool;
}

// ==========================================
// LOCAL FILE-BASED SQL FALLBACK ENGINE
// ==========================================

const dbFilePath = path.join(process.cwd(), "local_db.json");

interface LocalDb {
  universities: any[];
  users: any[];
  complaints: any[];
  comments: any[];
  category_definitions: any[];
  banned_words: any[];
  system_audit_logs: any[];
  department_notifications: any[];
  upvotes: any[];
  complaint_reactions: any[];
  comment_reactions: any[];
  media: any[];
  pre_registered_students: any[];
}

const initialDb: LocalDb = {
  universities: [
    { id: "10000000-0000-4000-8000-000000000001", name: "Addis Ababa University", location: "Addis Ababa", logo_url: "https://api.dicebear.com/7.x/initials/svg?seed=AAU&backgroundColor=003366", is_frozen: false, created_at: new Date().toISOString() },
    { id: "10000000-0000-4000-8000-000000000002", name: "Adama Science and Technology University", location: "Adama", logo_url: "https://api.dicebear.com/7.x/initials/svg?seed=ASTU&backgroundColor=004488", is_frozen: false, created_at: new Date().toISOString() },
    { id: "10000000-0000-4000-8000-000000000003", name: "Hawassa University", location: "Hawassa", logo_url: "https://api.dicebear.com/7.x/initials/svg?seed=HU&backgroundColor=0055aa", is_frozen: false, created_at: new Date().toISOString() },
    { id: "10000000-0000-4000-8000-000000000004", name: "Dire Dawa University", location: "Dire Dawa", logo_url: "https://api.dicebear.com/7.x/initials/svg?seed=DDU&backgroundColor=0066cc", is_frozen: false, created_at: new Date().toISOString() },
    { id: "10000000-0000-4000-8000-000000000005", name: "Bahir Dar University", location: "Bahir Dar", logo_url: "https://api.dicebear.com/7.x/initials/svg?seed=BDU&backgroundColor=0077ee", is_frozen: false, created_at: new Date().toISOString() }
  ],
  users: [
    {
      id: "f0000000-0000-4000-8000-000000000000",
      full_name: "Root Administrator",
      username: "admin",
      password: "admin123",
      role: "SYSTEM_ADMIN",
      student_id_number: "SYS-ADM-001",
      is_verified: true,
      account_status: "ACTIVE",
      settings: {},
      created_at: new Date().toISOString()
    },
    {
      id: "f0000000-0000-4000-8000-000000000001",
      full_name: "Abebe Kebede",
      username: "abebe",
      password: "password123",
      role: "STUDENT",
      student_id_number: "DDU-1001",
      university_id: "10000000-0000-4000-8000-000000000004",
      is_verified: true,
      account_status: "ACTIVE",
      settings: {},
      created_at: new Date().toISOString()
    },
    {
      id: "f0000000-0000-4000-8000-000000000002",
      full_name: "Sara Tesfaye",
      username: "sara",
      password: "password123",
      role: "STUDENT",
      student_id_number: "AAU-2002",
      university_id: "10000000-0000-4000-8000-000000000001",
      is_verified: true,
      account_status: "ACTIVE",
      settings: {},
      created_at: new Date().toISOString()
    },
    {
      id: "f0000000-0000-4000-8000-000000000003",
      full_name: "Admin @ Addis Ababa University",
      username: "aau_admin",
      password: "password123",
      role: "UNI_ADMIN",
      student_id_number: "ADMIN-AAU",
      university_id: "10000000-0000-4000-8000-000000000001",
      is_verified: true,
      account_status: "ACTIVE",
      settings: {},
      created_at: new Date().toISOString()
    },
    {
      id: "f0000000-0000-4000-8000-000000000004",
      full_name: "Federal MoE Inspector",
      username: "moe",
      password: "password123",
      role: "MOE",
      student_id_number: "MOE-8899",
      is_verified: true,
      account_status: "ACTIVE",
      settings: {},
      created_at: new Date().toISOString()
    }
  ],
  complaints: [
    {
      id: "c0000000-0000-4000-8000-000000000001",
      student_id: "f0000000-0000-4000-8000-000000000001",
      university_id: "10000000-0000-4000-8000-000000000004",
      category: "CAFETERIA",
      description: "The meat served in Block 4 central dining hall smells decayed. Multiple students reported stomach issues.",
      upvotes_count: 142,
      likes_count: 0,
      dislikes_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: "c0000000-0000-4000-8000-000000000002",
      student_id: "f0000000-0000-4000-8000-000000000001",
      university_id: "10000000-0000-4000-8000-000000000004",
      category: "DORMITORY",
      description: "Severe water shortage in Female Dormitory Block 12. No running water for 48 hours.",
      upvotes_count: 89,
      likes_count: 0,
      dislikes_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: "c0000000-0000-4000-8000-000000000003",
      student_id: "f0000000-0000-4000-8000-000000000002",
      university_id: "10000000-0000-4000-8000-000000000001",
      category: "ACADEMIC",
      description: "Massive failure in the grade management system for Semester 2.",
      upvotes_count: 215,
      likes_count: 0,
      dislikes_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  comments: [],
  category_definitions: [
    { name: 'CAFETERIA', label: 'Cafeteria & Food', description: 'Dining services and food quality', created_at: new Date().toISOString() },
    { name: 'DORMITORY', label: 'Dormitory', description: 'Living conditions and housing', created_at: new Date().toISOString() },
    { name: 'ACADEMIC', label: 'Academic', description: 'Courses, grades and registration', created_at: new Date().toISOString() },
    { name: 'SAFETY', label: 'Security & Safety', description: 'Campus safety and security', created_at: new Date().toISOString() },
    { name: 'CLINIC', label: 'Health Clinic', description: 'Medical services and facilities', created_at: new Date().toISOString() }
  ],
  banned_words: [],
  system_audit_logs: [],
  department_notifications: [],
  upvotes: [],
  complaint_reactions: [],
  comment_reactions: [],
  media: [],
  pre_registered_students: []
};

let fallbackData = { ...initialDb };

function loadLocalDb() {
  try {
    if (fs.existsSync(dbFilePath)) {
      const dataStr = fs.readFileSync(dbFilePath, "utf-8");
      fallbackData = JSON.parse(dataStr);
    } else {
      saveLocalDb();
    }
    console.log("Loaded fallback database with", fallbackData.users.length, "users and", fallbackData.complaints.length, "complaints.");
  } catch (err) {
    console.warn("Failed to read local SQL fallback file:", err);
  }
}

function saveLocalDb() {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(fallbackData, null, 2), "utf-8");
  } catch (err) {
    console.warn("Failed to write local SQL fallback file:", err);
  }
}

export function runLocalQuery(text: string, params?: any[]): any {
  const norm = text.replace(/\s+/g, " ").trim();
  
  // 1. SELECT UNIVERSITIES
  if (norm.includes("FROM pre_registered_students")) {
    const studentIdMatch = norm.match(/student_id\s*=\s*\$(\d+)/i);
    let list = [...(fallbackData.pre_registered_students || [])];
    if (studentIdMatch) {
      const val = params?.[parseInt(studentIdMatch[1]) - 1];
      if (val) {
        list = list.filter(s => s.student_id ? s.student_id.toLowerCase() === val.toLowerCase() : false);
      }
    }
    const rows = list.map(student => {
      const uni = fallbackData.universities.find(u => u.id === student.university_id);
      return {
        ...student,
        university_name: uni ? uni.name : null
      };
    });
    return { rows };
  }

  if (norm.includes("SELECT * FROM universities")) {
    return { rows: fallbackData.universities.sort((a,b) => a.name.localeCompare(b.name)) };
  }
  if (norm.includes("SELECT is_frozen FROM universities WHERE id = $1")) {
    const uni = fallbackData.universities.find(u => u.id === params?.[0]);
    return { rows: uni ? [{ is_frozen: uni.is_frozen }] : [{ is_frozen: false }] };
  }

  // 2. SELECT CATEGORIES
  if (norm.includes("SELECT * FROM category_definitions")) {
    return { rows: fallbackData.category_definitions };
  }

  // 3. SELECT BANNED WORDS
  if (norm.includes("SELECT * FROM banned_words") || norm.includes("SELECT word FROM banned_words")) {
    return { rows: fallbackData.banned_words };
  }

  // 4. USERS COUNT & QUERIES
  if (norm.includes("SELECT COUNT(*) FROM users")) {
    return { rows: [{ count: fallbackData.users.length.toString() }] };
  }
  if (norm.includes("FROM users u") && norm.includes("LEFT JOIN universities")) {
    const rows = fallbackData.users.map(u => {
      const uni = fallbackData.universities.find(uni => uni.id === u.university_id);
      return {
        ...u,
        university_name: uni ? uni.name : null
      };
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { rows };
  }
  if (norm.includes("FROM users") && norm.includes("role = 'MOE'")) {
    const rows = fallbackData.users
      .filter(u => u.role === "MOE")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { rows };
  }
  if (norm.includes("FROM users") && norm.includes("university_id = $1") && !norm.includes("assigned_category")) {
    const uniId = params?.[0];
    const rows = fallbackData.users
      .filter(u => u.university_id === uniId)
      .sort((a, b) => (a.role || "").localeCompare(b.role || "") || (a.full_name || "").localeCompare(b.full_name || ""));
    return { rows };
  }
  if (norm.includes("FROM users") && norm.includes("university_id = $1") && norm.includes("assigned_category")) {
    const uniId = params?.[0];
    const rows = fallbackData.users
      .filter(u => u.university_id === uniId)
      .sort((a, b) => (a.role || "").localeCompare(b.role || "") || (a.full_name || "").localeCompare(b.full_name || ""));
    return { rows };
  }
  if (norm.includes("SELECT id FROM users WHERE username = $1 OR phone = $2 OR student_id_number = $3")) {
    const u = fallbackData.users.find(u => u.username === params?.[0] || u.phone === params?.[1] || u.student_id_number === params?.[2]);
    return { rows: u ? [{ id: u.id }] : [] };
  }
  if (norm.includes("FROM users WHERE role = 'DEPT_ADMIN' AND university_id = $1 AND assigned_category = $2")) {
    const list = fallbackData.users.filter(u => u.role === 'DEPT_ADMIN' && u.university_id === params?.[0] && u.assigned_category === params?.[1]);
    return { rows: list.map(u => ({ id: u.id })) };
  }
  if (norm.includes("FROM users WHERE role = 'UNI_ADMIN' AND university_id = $1")) {
    const list = fallbackData.users.filter(u => u.role === 'UNI_ADMIN' && u.university_id === params?.[0]);
    return { rows: list.map(u => ({ id: u.id })) };
  }
  if (norm.includes("FROM users WHERE university_id = $1 AND role = 'DEPT_ADMIN'")) {
    const list = fallbackData.users
      .filter(u => u.university_id === params?.[0] && u.role === 'DEPT_ADMIN')
      .map(u => ({
        id: u.id,
        full_name: u.full_name,
        username: u.username,
        assigned_category: u.assigned_category,
        account_status: u.account_status
      }));
    return { rows: list };
  }
  if (norm.includes("SELECT * FROM users WHERE username = $1 AND password = $2")) {
    const u = fallbackData.users.find(u => u.username === params?.[0] && u.password === params?.[1]);
    return { rows: u ? [u] : [] };
  }
  if (norm.includes("SELECT role, assigned_category, university_id FROM users WHERE id = $1")) {
    const u = fallbackData.users.find(user => user.id === params?.[0]);
    return { rows: u ? [u] : [] };
  }
  if (norm.includes("SELECT password FROM users WHERE id = $1")) {
    const u = fallbackData.users.find(user => user.id === params?.[0]);
    return { rows: u ? [{ password: u.password }] : [] };
  }
  if (norm.includes("SELECT id, full_name, username, role, university_id, avatar_url, bio, student_id_number, phone, account_status, settings, created_at FROM users WHERE id = $1")) {
    const u = fallbackData.users.find(user => user.id === params?.[0]);
    return { rows: u ? [u] : [] };
  }
  if (norm.includes("SELECT role FROM users WHERE id = $1")) {
    const u = fallbackData.users.find(user => user.id === params?.[0]);
    return { rows: u ? [{ role: u.role }] : [] };
  }

  // 5. COMPLAINTS LIST WITH JOINS
  if (norm.includes("FROM complaints c")) {
    let list = [...fallbackData.complaints];
    
    // Parse dynamic university bounds
    const uniMatch = norm.match(/c\.university_id\s*=\s*\$(\d+)/i);
    if (uniMatch) {
      const val = params?.[parseInt(uniMatch[1]) - 1];
      if (val) list = list.filter(c => c.university_id === val);
    }
    const catMatch = norm.match(/c\.category\s*=\s*\$(\d+)/i);
    if (catMatch) {
      const val = params?.[parseInt(catMatch[1]) - 1];
      if (val) list = list.filter(c => c.category === val);
    }

    const rows = list.map(c => {
      const uni = fallbackData.universities.find(u => u.id === c.university_id);
      const student = fallbackData.users.find(u => u.id === c.student_id);
      const hasUpvoted = params?.[0] && fallbackData.upvotes.some(u => u.complaint_id === c.id && u.user_id === params[0]);
      const reactRelation = params?.[0] && fallbackData.complaint_reactions.find(r => r.complaint_id === c.id && r.user_id === params[0]);
      const comments_count = fallbackData.comments.filter(comm => comm.complaint_id === c.id).length;
      
      const parsedEvidenceUrl = c.evidence_url && c.evidence_url.startsWith('data:') 
        ? `/api/complaints/${c.id}/evidence?type=${c.evidence_url.split(';')[0].split('/')[1] || 'image'}`
        : c.evidence_url;

      return {
        ...c,
        university_name: uni ? uni.name : "Unknown University",
        university_logo: uni ? uni.logo_url : null,
        student_name: student ? student.full_name : "Anonymous Student",
        poster_role: student ? student.role : "STUDENT",
        student_avatar: student ? student.avatar_url : null,
        student_bio: student ? student.bio : null,
        has_upvoted: !!hasUpvoted,
        user_reaction: reactRelation ? reactRelation.reaction_type : null,
        comments_count: comments_count.toString(),
        evidence_url: parsedEvidenceUrl
      };
    });
    return { rows };
  }

  if (norm.includes("SELECT student_id FROM complaints WHERE id = $1")) {
    const c = fallbackData.complaints.find(comp => comp.id === params?.[0]);
    return { rows: c ? [{ student_id: c.student_id }] : [] };
  }
  if (norm.includes("SELECT id, created_at, university_id FROM complaints ORDER BY created_at DESC LIMIT 1000")) {
    const list = [...fallbackData.complaints].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 1000);
    return { rows: list };
  }
  if (norm.includes("SELECT evidence_url FROM complaints WHERE id = $1")) {
    const c = fallbackData.complaints.find(comp => comp.id === params?.[0]);
    return { rows: c ? [{ evidence_url: c.evidence_url }] : [] };
  }

  // 6. COMMENTS JOIN
  if (norm.includes("FROM comments c")) {
    const complaintId = params?.[0];
    const loggedInUser = params?.[1];
    let list = fallbackData.comments.filter(c => c.complaint_id === complaintId);
    const rows = list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(c => {
      const u = fallbackData.users.find(user => user.id === c.user_id);
      const hasLiked = loggedInUser && fallbackData.comment_reactions.some(r => r.comment_id === c.id && r.user_id === loggedInUser && r.reaction_type === 'LIKE');
      const hasDisliked = loggedInUser && fallbackData.comment_reactions.some(r => r.comment_id === c.id && r.user_id === loggedInUser && r.reaction_type === 'DISLIKE');
      return {
        ...c,
        user_name: u ? u.full_name : "Anonymous User",
        user_avatar: u ? u.avatar_url : null,
        user_role: u ? u.role : "STUDENT",
        has_liked: !!hasLiked,
        has_disliked: !!hasDisliked
      };
    });
    return { rows };
  }
  if (norm.includes("SELECT evidence_url FROM comments WHERE id = $1")) {
    const c = fallbackData.comments.find(comm => comm.id === params?.[0]);
    return { rows: c ? [{ evidence_url: c.evidence_url }] : [] };
  }

  // 7. NOTIFICATIONS
  if (norm.includes("FROM department_notifications n")) {
    const userId = params?.[0];
    const list = fallbackData.department_notifications.filter(n => n.user_id === userId);
    const rows = list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(n => {
      const c = fallbackData.complaints.find(comp => comp.id === n.complaint_id);
      const uni = c ? fallbackData.universities.find(u => u.id === c.university_id) : null;
      return {
        ...n,
        complaint_desc: c ? c.description : "",
        complaint_category: c ? c.category : "",
        university_name: uni ? uni.name : ""
      };
    });
    return { rows };
  }

  // 8. AUDIT LOGS
  if (norm.includes("FROM system_audit_logs")) {
    const rows = fallbackData.system_audit_logs.map(log => {
      const u = fallbackData.users.find(user => user.id === log.user_id);
      return {
        ...log,
        user_name: u ? u.full_name : "System / Anonymous",
        user_role: u ? u.role : "SYSTEM"
      };
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { rows };
  }

  // 9. GENERIC SQL INSERT STRINGS
  const insertMatch = norm.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)/i);
  if (insertMatch) {
    const table = insertMatch[1].toLowerCase();
    const cols = insertMatch[2].split(",").map(c => c.trim());
    const newRow: any = { id: crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2) + "-" + Date.now()) };
    
    cols.forEach((col, idx) => {
      newRow[col] = params?.[idx];
    });
    newRow.created_at = new Date().toISOString();
    newRow.updated_at = new Date().toISOString();

    if (fallbackData[table as keyof LocalDb]) {
      (fallbackData[table as keyof LocalDb] as any[]).push(newRow);
      saveLocalDb();
    }
    return { rows: [newRow] };
  }

  // 10. GENERIC SQL UPDATE STRINGS
  const updateMatch = norm.match(/UPDATE\s+(\w+)\s+SET\s+([^]+?)\s+WHERE\s+(.+)$/i);
  if (updateMatch) {
    const table = updateMatch[1].toLowerCase();
    const whereClause = updateMatch[3];
    const whereMatch = whereClause.match(/(\w+)\s*=\s*\$(\d+)/i);
    
    if (whereMatch) {
      const targetCol = whereMatch[1];
      const targetVal = params?.[parseInt(whereMatch[2]) - 1];
      const record = (fallbackData[table as keyof LocalDb] as any[]).find(r => r[targetCol] === targetVal);
      if (record) {
        const setClause = updateMatch[2];
        const parts = setClause.split(",");
        parts.forEach(part => {
          const [col, formula] = part.split("=").map(s => s.trim());
          if (formula.includes("+")) {
            const prop = formula.split("+")[0].trim();
            record[col] = (record[prop] || 0) + 1;
          } else if (formula.includes("-")) {
            const prop = formula.split("-")[0].trim();
            record[col] = Math.max(0, (record[prop] || 0) - 1);
          } else {
            const paramMatch = formula.match(/\$(\d+)/);
            if (paramMatch) {
              record[col] = params?.[parseInt(paramMatch[1]) - 1];
            } else {
              record[col] = formula.replace(/['"]/g, "").trim();
            }
          }
        });
        saveLocalDb();
        return { rows: [record] };
      }
    }
  }

  // 11. GENERIC SQL DELETE STRINGS
  const deleteMatch = norm.match(/DELETE\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\$(\d+)/i);
  if (deleteMatch) {
    const table = deleteMatch[1].toLowerCase();
    const col = deleteMatch[2];
    const val = params?.[parseInt(deleteMatch[3]) - 1];
    if (fallbackData[table as keyof LocalDb]) {
      fallbackData[table as keyof LocalDb] = (fallbackData[table as keyof LocalDb] as any[]).filter(r => r[col] !== val);
      saveLocalDb();
    }
    return { rows: [] };
  }

  return { rows: [] };
}

// ==========================================
// CENTRAL QUERY & INITIALIZATION INTERFACE
// ==========================================

export async function query(text: string, params?: any[]) {
  if (useLocalFallback) {
    return runLocalQuery(text, params);
  }
  
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === "") {
    useLocalFallback = true;
    loadLocalDb();
    return runLocalQuery(text, params);
  }

  try {
    const p = getPool();
    return await p.query(text, params);
  } catch (err: any) {
    console.warn("PostgreSQL Query execution failed, triggering local fallback:", err.message);
    useLocalFallback = true;
    loadLocalDb();
    return runLocalQuery(text, params);
  }
}

// Initial database schema setup with proper order & dependencies
export async function initDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || connectionString.trim() === "") {
    console.warn("⚠️ DATABASE_URL is not set or has unresolvable host. Running in local file-based database fallback.");
    useLocalFallback = true;
    loadLocalDb();
    return;
  }

  try {
    console.log("Attempting database probe...");
    const p = getPool();
    await p.query("SELECT 1");
    console.log("Database connection successful. Initializing schemas & migrations...");
    
    // Enable UUID extension
    await p.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    const queries = [
      `CREATE TABLE IF NOT EXISTS universities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        location TEXT,
        logo_url TEXT,
        is_frozen BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name TEXT NOT NULL,
        student_id_number TEXT UNIQUE,
        role TEXT NOT NULL CHECK (role IN ('STUDENT', 'UNI_ADMIN', 'DEPT_ADMIN', 'MOE', 'SYSTEM_ADMIN')),
        university_id UUID REFERENCES universities(id),
        username TEXT UNIQUE,
        password TEXT,
        phone TEXT UNIQUE,
        avatar_url TEXT,
        bio TEXT,
        is_verified BOOLEAN DEFAULT FALSE,
        account_status TEXT DEFAULT 'ACTIVE' CHECK (account_status IN ('ACTIVE', 'SUSPENDED', 'BANNED')),
        settings JSONB DEFAULT '{}',
        assigned_category TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS complaints (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES users(id),
        university_id UUID REFERENCES universities(id),
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        upvotes_count INTEGER DEFAULT 0,
        likes_count INTEGER DEFAULT 0,
        dislikes_count INTEGER DEFAULT 0,
        university_response TEXT,
        evidence_url TEXT,
        responded_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS department_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, complaint_id)
      )`,
      `CREATE TABLE IF NOT EXISTS media (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('IMAGE', 'VIDEO', 'AUDIO')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS upvotes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
        UNIQUE(user_id, complaint_id)
      )`,
      `CREATE TABLE IF NOT EXISTS comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        text TEXT NOT NULL,
        is_official BOOLEAN DEFAULT false,
        likes_count INTEGER DEFAULT 0,
        dislikes_count INTEGER DEFAULT 0,
        evidence_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS comment_reactions (
        user_id UUID REFERENCES users(id),
        comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
        reaction_type TEXT CHECK (reaction_type IN ('LIKE', 'DISLIKE')),
        PRIMARY KEY (user_id, comment_id)
      )`,
      `CREATE TABLE IF NOT EXISTS complaint_reactions (
        user_id UUID REFERENCES users(id),
        complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
        reaction_type TEXT CHECK (reaction_type IN ('LIKE', 'DISLIKE')),
        PRIMARY KEY (user_id, complaint_id)
      )`,
      `CREATE TABLE IF NOT EXISTS banned_words (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
        word TEXT UNIQUE NOT NULL, 
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS system_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
        user_id UUID REFERENCES users(id), 
        action TEXT NOT NULL, 
        details JSONB, 
        ip_address TEXT, 
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS category_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
        name TEXT UNIQUE NOT NULL, 
        label TEXT NOT NULL,
        description TEXT, 
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS pre_registered_students (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        university_id UUID REFERENCES universities(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`
    ];

    for (const q of queries) {
      await p.query(q);
    }

    // Now let's run safety alter columns
    const alterQueries = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_category TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'ACTIVE' CHECK (account_status IN ('ACTIVE', 'SUSPENDED', 'BANNED'))`,
      `ALTER TABLE complaints ADD COLUMN IF NOT EXISTS university_response TEXT`,
      `ALTER TABLE complaints ADD COLUMN IF NOT EXISTS evidence_url TEXT`,
      `ALTER TABLE complaints ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0`,
      `ALTER TABLE complaints ADD COLUMN IF NOT EXISTS dislikes_count INTEGER DEFAULT 0`,
      `ALTER TABLE complaints ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0`,
      `ALTER TABLE comments ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0`,
      `ALTER TABLE comments ADD COLUMN IF NOT EXISTS dislikes_count INTEGER DEFAULT 0`,
      `ALTER TABLE comments ADD COLUMN IF NOT EXISTS evidence_url TEXT`,
      `ALTER TABLE universities ADD COLUMN IF NOT EXISTS logo_url TEXT`,
      `ALTER TABLE universities ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT FALSE`
    ];
    for (const q of alterQueries) {
      try {
        await p.query(q);
      } catch (err: any) {
        // Ignore column already exists warnings
      }
    }

    // Seed default universities
    const unis = [
      { name: "Addis Ababa University", logo: "https://api.dicebear.com/7.x/initials/svg?seed=AAU&backgroundColor=003366" },
      { name: "Adama Science and Technology University", logo: "https://api.dicebear.com/7.x/initials/svg?seed=ASTU&backgroundColor=004488" },
      { name: "Hawassa University", logo: "https://api.dicebear.com/7.x/initials/svg?seed=HU&backgroundColor=0055aa" },
      { name: "Dire Dawa University", logo: "https://api.dicebear.com/7.x/initials/svg?seed=DDU&backgroundColor=0066cc" },
      { name: "Bahir Dar University", logo: "https://api.dicebear.com/7.x/initials/svg?seed=BDU&backgroundColor=0077ee" }
    ];
    for (const uni of unis) {
      await p.query("INSERT INTO universities (name, logo_url) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET logo_url = EXCLUDED.logo_url", [uni.name, uni.logo]);
    }

    // Ensure SYSTEM_ADMIN exists
    await p.query(
      "INSERT INTO users (id, full_name, role, username, password, student_id_number, is_verified) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING",
      ["f0000000-0000-4000-8000-000000000000", "Root Administrator", "SYSTEM_ADMIN", "admin", "admin123", "SYS-ADM-001", true]
    );

    // Ensure default categories exist
    const defaultCategories = [
      { name: 'CAFETERIA', label: 'Cafeteria & Food', desc: 'Dining services and food quality' },
      { name: 'DORMITORY', label: 'Dormitory', desc: 'Living conditions and housing' },
      { name: 'ACADEMIC', label: 'Academic', desc: 'Courses, grades and registration' },
      { name: 'SAFETY', label: 'Security & Safety', desc: 'Campus safety and security' },
      { name: 'CLINIC', label: 'Health Clinic', desc: 'Medical services and facilities' }
    ];
    for (const cat of defaultCategories) {
      await p.query(
        "INSERT INTO category_definitions (name, label, description) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [cat.name, cat.label, cat.desc]
      );
    }

    console.log("Database initialized successfully.");
  } catch (err: any) {
    console.warn("PostgreSQL initialization failed. Activating local fallback:", err.message);
    useLocalFallback = true;
    loadLocalDb();
  }
}
