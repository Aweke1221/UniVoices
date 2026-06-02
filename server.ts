import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fileUpload from "express-fileupload";
import nodemailer from "nodemailer";
import { initDb, query } from "./src/lib/db";
import { moderateContent, translateText } from "./src/lib/aiModeration";

dotenv.config();

const isValidUuid = (uuid: any) => typeof uuid === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
const toUuid = (uuid: any) => isValidUuid(uuid) ? uuid : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Database asynchronously without blocking server startup
  initDb()
    .then(() => {
      console.log("Database initialized successfully");
    })
    .catch((err) => {
      console.error("Database initialization failed:", err);
    });

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));
  app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    useTempFiles: false, // Store in memory so file.data is available
  }));

  const otpStore = new Map<string, string>();

  app.use((req, res, next) => {
    console.log(`REQUEST: ${req.method} ${req.url}`);
    next();
  });

  // API Routes
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("GLOBAL API ERROR:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV });
  });

  app.post("/api/translate", async (req, res) => {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required for translation." });
    }
    try {
      const translated = await translateText(text);
      res.json({ translatedText: translated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Translation helper is busy." });
    }
  });

  // Universities
  app.get("/api/universities", async (req, res) => {
    try {
      const result = await query("SELECT * FROM universities ORDER BY name");
      res.json(result.rows);
    } catch (err) {
      console.error("Fetch universities error:", err);
      res.status(500).json({ 
        error: "Database Connection Error", 
        message: "Ensure DATABASE_URL is set correctly in Secrets." 
      });
    }
  });

  // Complaints
  app.get("/api/complaints", async (req, res) => {
    // Debug log
    console.log("SERVER: Received GET /api/complaints", { query: req.query });

    const university_id = toUuid(req.query.university_id);
    const category = req.query.category as string;
    const role = req.query.role as string;
    const requesterId = toUuid(req.query.current_user_id);
    
    console.log("DEBUG: Params", { university_id, category, role, requesterId });
    
    // Fetch user info for DEPT_ADMIN context
    let userContext: any = null;
    if (requesterId) {
      try {
        const userRes = await query("SELECT role, assigned_category, university_id FROM users WHERE id = $1", [requesterId]);
        userContext = userRes.rows[0];
      } catch (err) {
        console.error("DEBUG: User context lookup failed", err);
      }
    }
    
    console.log("DEBUG: UserContext", userContext);

    // Check if current user has upvoted each complaint
    let sql = `
      SELECT c.id, c.student_id, c.university_id, c.category, c.description, c.upvotes_count, c.created_at, c.updated_at, c.university_response, c.responded_at, c.likes_count, c.dislikes_count, c.views_count,
             CASE 
               WHEN c.evidence_url LIKE 'data:image/%' THEN CONCAT('/api/complaints/', c.id, '/evidence?type=image') 
               WHEN c.evidence_url LIKE 'data:video/%' THEN CONCAT('/api/complaints/', c.id, '/evidence?type=video') 
               WHEN c.evidence_url LIKE 'data:application/pdf%' THEN CONCAT('/api/complaints/', c.id, '/evidence?type=pdf') 
               WHEN c.evidence_url IS NOT NULL THEN CONCAT('/api/complaints/', c.id, '/evidence?type=other') 
               ELSE NULL 
             END as evidence_url, 
      u.name as university_name, 
      u.logo_url as university_logo,
      CASE WHEN (s.settings->>'hideIdentity')::boolean = true AND s.id != $1::uuid THEN 'Anonymous Student' ELSE s.full_name END as student_name,
      s.role as poster_role,
      CASE WHEN (s.settings->>'hideIdentity')::boolean = true AND s.id != $1::uuid THEN NULL ELSE s.avatar_url END as student_avatar,
      CASE WHEN (s.settings->>'hideIdentity')::boolean = true AND s.id != $1::uuid THEN NULL ELSE s.bio END as student_bio,
      CASE WHEN $1::uuid IS NOT NULL AND EXISTS(SELECT 1 FROM upvotes WHERE complaint_id = c.id AND user_id = $1::uuid) THEN true ELSE false END as has_upvoted,
      (SELECT reaction_type FROM complaint_reactions WHERE complaint_id = c.id AND user_id = $1::uuid) as user_reaction,
      (SELECT COUNT(*) FROM comments WHERE complaint_id = c.id) as comments_count
      FROM complaints c 
      LEFT JOIN universities u ON c.university_id = u.id 
      JOIN users s ON c.student_id = s.id
    `;
    
    const params = [requesterId];
    const conditions = [];

    // Filter by role context
    if (userContext?.role === 'DEPT_ADMIN') {
      params.push(userContext.university_id);
      conditions.push(`c.university_id = $${params.length}`);
      params.push(userContext.assigned_category);
      conditions.push(`c.category = $${params.length}`);
    } else if (role === 'MOE') {
        // MOE can see all complaints, no additional conditions needed
    } else if (university_id) {
      params.push(university_id);
      conditions.push(`c.university_id = $${params.length}`);
    }

    if (category && (!userContext || userContext.role !== 'DEPT_ADMIN')) {
      params.push(category);
      conditions.push(`c.category = $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY c.created_at ASC";

    try {
      const result = await query(sql, params);
      console.log("DEBUG: Complaints fetched successfully");
      return res.json(result.rows);
    } catch (err) {
      console.error("Fetch complaints error:", err);
      return res.status(500).json({ error: "Failed to fetch complaints", details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/complaints/:id/evidence", async (req, res) => {
    const id = toUuid(req.params.id);
    if (!id) return res.status(400).send("Invalid ID");
    try {
      const result = await query("SELECT evidence_url FROM complaints WHERE id = $1", [id]);
      const evidence = result.rows[0]?.evidence_url;
      if (!evidence) {
        return res.status(404).send("Not found");
      }
      
      const match = evidence.match(/^data:(.*?);base64,(.*)$/);
      if (match) {
        const mimeType = match[1];
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');
        res.setHeader('Content-Type', mimeType);
        res.send(buffer);
      } else {
        res.send(evidence);
      }
    } catch (err) {
      console.error(err);
      res.status(500).send("Server Error");
    }
  });

  app.get("/api/complaints/new-count", async (req, res) => {
    const since = req.query.since as string;
    if (!since) return res.status(400).json({ error: "Missing since parameter" });

    try {
      const result = await query(
        `SELECT university_id, COUNT(*) as count 
         FROM complaints 
         WHERE created_at > $1 
         GROUP BY university_id`,
         [since]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch new count" });
    }
  });

  app.post("/api/complaints/unread-counts", async (req, res) => {
    const { lastSeenMap } = req.body;
    if (!lastSeenMap) return res.status(400).json({ error: "Missing lastSeenMap" });

    try {
      // Get all universities latest complaint count after their respective last seen time
      const result = await query("SELECT id, created_at, university_id FROM complaints ORDER BY created_at DESC LIMIT 1000"); // Just get recent 1000 to count
      const counts: Record<string, number> = {};
      
      for (const complaint of result.rows) {
        const uniId = complaint.university_id;
        if (!uniId) continue;
        const lastSeenStr = lastSeenMap[uniId] || lastSeenMap["ALL"];
        const lastSeen = lastSeenStr ? new Date(lastSeenStr).getTime() : 0;
        const complaintTime = new Date(complaint.created_at).getTime();
        
        if (complaintTime > lastSeen) {
          counts[uniId] = (counts[uniId] || 0) + 1;
        }
      }
      res.json(counts);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch unread counts" });
    }
  });

  // Delete Complaint
  app.delete("/api/complaints/:id", async (req, res) => {
    const id = toUuid(req.params.id);
    const userId = toUuid(req.query.userId);
    if (!id) return res.status(400).json({ error: "Invalid Complaint ID" });
    if (!userId) return res.status(400).json({ error: "Unauthorized: User ID required" });
    
    try {
      // Check ownership or admin role
      const compRes = await query("SELECT student_id FROM complaints WHERE id = $1", [id]);
      if (compRes.rows.length === 0) return res.status(404).json({ error: "Report not found" });
      
      const userRes = await query("SELECT role FROM users WHERE id = $1", [userId]);
      const user = userRes.rows[0];
      
      if (compRes.rows[0].student_id !== userId && user?.role !== 'MOE' && user?.role !== 'SYSTEM_ADMIN') {
        return res.status(403).json({ error: "Permission denied: You do not own this report" });
      }

      await query("DELETE FROM department_notifications WHERE complaint_id = $1", [id]);
      await query("DELETE FROM complaint_reactions WHERE complaint_id = $1", [id]);
      await query("DELETE FROM comment_reactions WHERE comment_id IN (SELECT id FROM comments WHERE complaint_id = $1)", [id]);
      await query("DELETE FROM comments WHERE complaint_id = $1", [id]);
      await query("DELETE FROM upvotes WHERE complaint_id = $1", [id]);
      await query("DELETE FROM media WHERE complaint_id = $1", [id]);
      await query("DELETE FROM complaints WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete complaint" });
    }
  });

  // Edit Complaint
  app.patch("/api/complaints/:id", async (req, res) => {
    const id = toUuid(req.params.id);
    const { category, description, userId } = req.body;
    const uId = toUuid(userId);

    if (!id || !uId) return res.status(400).json({ error: "Invalid parameters" });

    try {
      const compRes = await query("SELECT student_id FROM complaints WHERE id = $1", [id]);
      if (compRes.rows.length === 0) return res.status(404).json({ error: "Report not found" });
      
      if (compRes.rows[0].student_id !== uId) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const result = await query(
        "UPDATE complaints SET category = $1, description = $2, updated_at = NOW() WHERE id = $3 RETURNING *",
        [category, description, id]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update report" });
    }
  });

  app.post("/api/complaints/:id/view", async (req, res) => {
    const id = toUuid(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid ID" });

    try {
      const result = await query("UPDATE complaints SET views_count = COALESCE(views_count, 0) + 1 WHERE id = $1 RETURNING views_count", [id]);
      res.json({ success: true, views_count: result.rows[0].views_count });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to increment view count" });
    }
  });

  // Helper to send real SMS verification codes via Twilio or Infobip
  const sendSmsOtp = async (phone: string, otp: string): Promise<{ success: boolean; provider: string; details?: string }> => {
    let formattedPhone = phone.trim();
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "+251" + formattedPhone.slice(1);
    } else if (formattedPhone.startsWith("7") || formattedPhone.startsWith("9")) {
      formattedPhone = "+251" + formattedPhone;
    } else if (!formattedPhone.startsWith("+")) {
      formattedPhone = "+" + formattedPhone;
    }

    const messageText = `Your university portal registration verification code is: ${otp}. Do not share this OTP with anyone.`;

    // 1. Try Twilio Gateway
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (twilioSid && twilioToken && twilioPhone) {
      try {
        const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
        const body = new URLSearchParams({
          To: formattedPhone,
          From: twilioPhone,
          Body: messageText
        });

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: body.toString()
          }
        );

        if (response.ok) {
          console.log(`[Twilio SMS] Real OTP sent success to ${formattedPhone}`);
          return { success: true, provider: "Twilio" };
        } else {
          const errText = await response.text();
          console.error(`[Twilio SMS Error]`, errText);
          
          let parsedError;
          try {
            parsedError = JSON.parse(errText);
          } catch(e) {}

          if (parsedError?.code === 21608) {
            console.log(`[SMS Simulation] Twilio Trial Limit hit, simulation OTP for ${formattedPhone}: ${otp}`);
            return { success: true, provider: "Simulation (Twilio Limit)" };
          }
          
          return { success: false, provider: "Twilio", details: errText };
        }
      } catch (err: any) {
        console.error(`[Twilio Exception]`, err);
        return { success: false, provider: "Twilio", details: err.message };
      }
    }

    // 2. Try Infobip Gateway (Highly optimal for East Africa)
    const infobipKey = process.env.INFOBIP_API_KEY;
    const infobipUrl = process.env.INFOBIP_BASE_URL;
    const infobipSender = process.env.INFOBIP_SENDER || "InfoSMS";

    if (infobipKey && infobipUrl) {
      try {
        const cleanUrl = infobipUrl.endsWith("/") ? infobipUrl.slice(0, -1) : infobipUrl;
        const response = await fetch(`${cleanUrl}/sms/2/text/advanced`, {
          method: "POST",
          headers: {
            "Authorization": `App ${infobipKey}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            messages: [
              {
                from: infobipSender,
                destinations: [{ to: formattedPhone }],
                text: messageText
              }
            ]
          })
        });

        if (response.ok) {
          console.log(`[Infobip SMS] Real OTP sent success to ${formattedPhone}`);
          return { success: true, provider: "Infobip" };
        } else {
          const errText = await response.text();
          console.error(`[Infobip SMS Error]`, errText);
          return { success: false, provider: "Infobip", details: errText };
        }
      } catch (err: any) {
        console.error(`[Infobip Exception]`, err);
        return { success: false, provider: "Infobip", details: err.message };
      }
    }

    // 3. Fallback to terminal/CLI Console Simulation
    console.log(`[SMS Simulation] OTP for ${formattedPhone}: ${otp}`);
    return { success: true, provider: "Simulation (No Credentials Set)" };
  };

  // Helper to send email OTP
  const sendEmailOtp = async (email: string, otp: string): Promise<{ success: boolean; provider: string; details?: string }> => {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log(`[Email Simulation] OTP for ${email}: ${otp}`);
      return { success: true, provider: "Simulation (No SMTP Credentials)" };
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: "University Portal Verification Code",
        text: `Your university portal registration verification code is: ${otp}. Do not share this OTP with anyone.`,
      });
      console.log(`[Email OTP] Sent success to ${email}`);
      return { success: true, provider: "SMTP" };
    } catch (err: any) {
      console.error(`[Email Exception]`, err);
      return { success: false, provider: "SMTP", details: err.message };
    }
  };

  // Register - Stage 1: Phone or Email Verification
  app.post("/api/auth/send-otp", async (req, res) => {
    const { phone, email } = req.body;
    if (!phone && !email) return res.status(400).json({ error: "Phone number or email required" });
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const identifier = phone || email;
    otpStore.set(identifier, otp);
    
    let result;
    if (phone) {
        result = await sendSmsOtp(phone, otp);
    } else {
        result = await sendEmailOtp(email, otp);
    }

    if (!result.success) {
      return res.status(400).json({ error: result.details || "Failed to send verification code." });
    }
    
    res.json({ 
      message: result.provider.includes("Simulation") 
        ? "Verification code simulated in Console log (To send real messages, configure your credentials)." 
        : `Verification dispatched successfully via ${result.provider}!`,
      identifier,
      provider: result.provider,
      simulated: result.provider.includes("Simulation"),
      code: result.provider.includes("Simulation") ? otp : undefined 
    });
  });

  // Register - Stage 2: Verify OTP
  app.post("/api/auth/verify-otp", async (req, res) => {
    const { identifier, otp } = req.body;
    const storedOtp = otpStore.get(identifier);
    
    if (storedOtp && storedOtp === otp) {
      res.json({ success: true, message: "Verification successful" });
    } else {
      res.status(400).json({ error: "Invalid or expired OTP" });
    }
  });

  // Register - Stage 3: Complete registration
  app.post("/api/auth/register", async (req, res) => {
    const { username, password, phone, email, fullName, studentId, universityId, role, assignedCategory } = req.body;
    try {
      // Check if unique fields already exist
      const existing = await query(
        "SELECT id FROM users WHERE username = $1 OR ($2::TEXT IS NOT NULL AND phone = $2) OR ($3::TEXT IS NOT NULL AND email = $3) OR student_id_number = $4", 
        [username, phone, email, studentId]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: "Username, Phone, Email, or Student ID already registered" });
      }

      const result = await query(
        `INSERT INTO users (full_name, username, password, phone, email, student_id_number, role, university_id, assigned_category, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
         RETURNING *`,
        [fullName, username, password, phone, email, studentId, role || 'STUDENT', toUuid(universityId), assignedCategory || null]
      );
      
      otpStore.delete(phone || email);
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    console.log("LOGIN REQUEST BODY:", req.body);
    const { username, password } = req.body;
    try {
      const result = await query("SELECT * FROM users WHERE username = $1 AND password = $2", [username, password]);
      console.log("LOGIN QUERY RESULT:", result.rows.length);
      if (result.rows.length === 0) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      const user = result.rows[0];
      if (user.account_status !== 'ACTIVE') {
        return res.status(403).json({ error: `Account ${user.account_status}. Access denied.` });
      }
      res.json(user);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/student", async (req, res) => {
    const { fullName, studentId, universityId } = req.body;
    try {
      // Upsert student
      const result = await query(
        `INSERT INTO users (full_name, student_id_number, role, university_id)
         VALUES ($1, $2, 'STUDENT', $3)
         ON CONFLICT (student_id_number) DO UPDATE SET full_name = $1, university_id = $3
         RETURNING *`,
        [fullName, studentId, toUuid(universityId)]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  app.post("/api/complaints", async (req, res) => {
    const { category, description, mediaUrls } = req.body;
    const studentId = toUuid(req.body.studentId);
    const universityId = toUuid(req.body.universityId);
    let evidenceUrl = req.body.evidenceUrl || null;

    if (req.files && req.files.evidenceFile) {
      const file = req.files.evidenceFile as any;
      const base64Content = file.data.toString('base64');
      evidenceUrl = `data:${file.mimetype};base64,${base64Content}`;
    }
    
    try {
      // 1. Check if University is frozen
      const uniCheck = await query("SELECT is_frozen FROM universities WHERE id = $1", [universityId]);
      if (uniCheck.rows[0]?.is_frozen) {
        return res.status(403).json({ error: "This institution's portal is restricted. Submissions suspended." });
      }

      // 1.5 Real-Time AI Content Moderation for Abuse and Rice/Spam reports
      const modResult = await moderateContent(description);
      if (modResult.blocked) {
        await query(
          "INSERT INTO system_audit_logs (user_id, action, details) VALUES ($1, $2, $3)",
          [studentId, 'CONTENT_FLAGGED', { 
            text: description, 
            universityId, 
            category: modResult.category, 
            reason: modResult.reason,
            confidence: modResult.confidence,
            aiBlocked: true
          }]
        );
        return res.status(400).json({ error: `Blocked by AI Guardrails: ${modResult.reason}` });
      }

      // 2. Content Moderation (Banned Words)
      const bannedWordsRes = await query("SELECT word FROM banned_words");
      const bannedWords = bannedWordsRes.rows.map(r => r.word);
      const containsBanned = bannedWords.some(word => 
        new RegExp(word.split('').join('[-_\\s]?'), 'i').test(description)
      );

      if (containsBanned) {
        // Shadow ban vs Quarantine behavior
        // Moving to quarantine queue (hidden)
        await query(
          "INSERT INTO system_audit_logs (user_id, action, details) VALUES ($1, $2, $3)",
          [studentId, 'CONTENT_FLAGGED', { text: description, universityId }]
        );
        return res.status(400).json({ error: "Your report contains restricted vocabulary. It has been flagged for audit." });
      }

      // 3. Verify user ID exists before inserting (Foreign Key protection)
      if (studentId) {
        const userCheck = await query("SELECT id FROM users WHERE id = $1", [studentId]);
        if (userCheck.rows.length === 0) {
            console.log(`[Complaint Submission] User ID ${studentId} not found in DB.`);
            return res.status(400).json({ error: "Invalid User session." });
        }
      }

      console.log(`[Complaint Submission] StudentID: ${studentId}, UnivID: ${universityId}, Category: ${category}`);
      const result = await query(
        "INSERT INTO complaints (student_id, university_id, category, description, evidence_url) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [studentId, universityId, category, description, evidenceUrl || null]
      );
      const complaint = result.rows[0];

      // Route notification to department admins
      const deptAdminsRes = await query(
        "SELECT id FROM users WHERE role = 'DEPT_ADMIN' AND university_id = $1 AND assigned_category = $2",
        [universityId, category]
      );
      for (const admin of deptAdminsRes.rows) {
        await query(
          "INSERT INTO department_notifications (user_id, complaint_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [admin.id, complaint.id]
        );
      }

      // Route notification to university admins (UNI_ADMIN)
      const uniAdminsRes = await query(
        "SELECT id FROM users WHERE role = 'UNI_ADMIN' AND university_id = $1",
        [universityId]
      );
      for (const admin of uniAdminsRes.rows) {
        await query(
          "INSERT INTO department_notifications (user_id, complaint_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [admin.id, complaint.id]
        );
      }

      if (mediaUrls && Array.isArray(mediaUrls)) {
        for (const url of mediaUrls) {
          await query("INSERT INTO media (complaint_id, url, type) VALUES ($1, $2, 'IMAGE')", [complaint.id, url]);
        }
      }

      res.json(complaint);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to submit complaint" });
    }
  });

  app.post("/api/complaints/:id/react", async (req, res) => {
    const userId = toUuid(req.body.userId);
    const reactionType = req.body.reactionType;
    const complaintId = toUuid(req.params.id);
    
    if (!userId || !complaintId) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    try {
      const existing = await query("SELECT reaction_type FROM complaint_reactions WHERE user_id = $1 AND complaint_id = $2", [userId, complaintId]);
      const prevType = existing.rows[0]?.reaction_type;

      if (prevType === reactionType) {
        await query("DELETE FROM complaint_reactions WHERE user_id = $1 AND complaint_id = $2", [userId, complaintId]);
        const col = prevType === 'LIKE' ? 'likes_count' : 'dislikes_count';
        await query(`UPDATE complaints SET ${col} = GREATEST(0, ${col} - 1) WHERE id = $1`, [complaintId]);
      } else {
        if (prevType) {
          const colOff = prevType === 'LIKE' ? 'likes_count' : 'dislikes_count';
          await query(`UPDATE complaints SET ${colOff} = GREATEST(0, ${colOff} - 1) WHERE id = $1`, [complaintId]);
        }
        
        await query(
          "INSERT INTO complaint_reactions (user_id, complaint_id, reaction_type) VALUES ($1, $2, $3) ON CONFLICT (user_id, complaint_id) DO UPDATE SET reaction_type = EXCLUDED.reaction_type",
          [userId, complaintId, reactionType]
        );
        
        const colOn = reactionType === 'LIKE' ? 'likes_count' : 'dislikes_count';
        await query(`UPDATE complaints SET ${colOn} = ${colOn} + 1 WHERE id = $1`, [complaintId]);
      }

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Reaction update failed" });
    }
  });

  app.post("/api/complaints/:id/upvote", async (req, res) => {
    const userId = toUuid(req.body.userId);
    const complaintId = toUuid(req.params.id);
    
    if (!userId || !complaintId) {
      return res.status(400).json({ error: "Invalid Identification Format" });
    }
    
    try {
      await query("INSERT INTO upvotes (user_id, complaint_id) VALUES ($1, $2)", [userId, complaintId]);
      await query("UPDATE complaints SET upvotes_count = upvotes_count + 1 WHERE id = $1", [complaintId]);
      res.json({ success: true });
    } catch (err: any) {
      if (err.code === "23505") { // Unique violation
        return res.status(400).json({ error: "You have already endorsed this report." });
      }
      res.status(500).json({ error: "Upvote failed" });
    }
  });

  // University Response (Official Announcement)
  app.post("/api/complaints/:id/response", async (req, res) => {
    const { responseText } = req.body;
    const adminId = toUuid(req.body.adminId);
    const id = toUuid(req.params.id);
    let evidenceUrl = req.body.evidenceUrl || null;

    if (req.files && req.files.evidenceFile) {
      const file = req.files.evidenceFile as any;
      const base64Content = file.data.toString('base64');
      evidenceUrl = `data:${file.mimetype};base64,${base64Content}`;
    }

    if (!id) return res.status(400).json({ error: "Invalid Complaint ID" });

    try {
      const result = await query(
        "UPDATE complaints SET university_response = $1, evidence_url = $2, responded_at = NOW(), updated_at = NOW() WHERE id = $3 RETURNING *",
        [responseText, evidenceUrl, id]
      );

      // Create an official comment as well for the feed view
      if (adminId) {
        await query(
          "INSERT INTO comments (complaint_id, user_id, text, is_official, evidence_url) VALUES ($1, $2, $3, true, $4)",
          [id, adminId, responseText, evidenceUrl || null]
        );
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to submit response" });
    }
  });

  // Departmental User Management (Super Admin)
  app.get("/api/university/:id/department-heads", async (req, res) => {
    const universityId = toUuid(req.params.id);
    if (!universityId) return res.status(400).json({ error: "Invalid University ID" });
    try {
      const result = await query(
        "SELECT id, full_name, username, assigned_category, account_status FROM users WHERE university_id = $1 AND role = 'DEPT_ADMIN'",
        [universityId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Fetch department heads failed" });
    }
  });

  app.post("/api/university/:id/department-heads", async (req, res) => {
    const universityId = toUuid(req.params.id);
    const { fullName, username, password, category } = req.body;
    if (!universityId) return res.status(400).json({ error: "Invalid University ID" });
    try {
      const result = await query(
        "INSERT INTO users (full_name, username, password, role, university_id, assigned_category, is_verified) VALUES ($1, $2, $3, 'DEPT_ADMIN', $4, $5, true) RETURNING *",
        [fullName, username, password, universityId, category]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create department head" });
    }
  });

  // Notifications for DEPT_ADMIN
  app.get("/api/notifications/:userId", async (req, res) => {
    const userId = toUuid(req.params.userId);
    if (!userId) return res.status(400).json({ error: "Invalid User ID" });
    try {
      const result = await query(
        `SELECT dn.*, c.description, c.category, s.full_name as student_name
         FROM department_notifications dn
         JOIN complaints c ON dn.complaint_id = c.id
         JOIN users s ON c.student_id = s.id
         WHERE dn.user_id = $1
         ORDER BY dn.created_at DESC`,
        [userId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Fetch notifications failed" });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    const id = toUuid(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid Notification ID" });
    try {
      await query("UPDATE department_notifications SET is_read = true, read_at = NOW() WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Update notification failed" });
    }
  });

  // Comments
  app.get("/api/complaints/:id/comments", async (req, res) => {
    const complaintId = toUuid(req.params.id);
    const requesterId = toUuid(req.query.current_user_id);
    
    if (!complaintId) return res.status(400).json({ error: "Invalid Complaint ID" });

    try {
      const result = await query(
        `SELECT c.id, c.complaint_id, c.user_id, c.text, c.is_official, c.created_at, c.likes_count, c.dislikes_count,
         CASE 
           WHEN c.evidence_url LIKE 'data:image/%' THEN CONCAT('/api/comments/', c.id, '/evidence?type=image') 
           WHEN c.evidence_url IS NOT NULL THEN CONCAT('/api/comments/', c.id, '/evidence?type=other') 
           ELSE NULL 
         END as evidence_url,
         CASE WHEN (u.settings->>'hideIdentity')::boolean = true AND u.id != $2::uuid THEN 'Anonymous' ELSE u.full_name END as user_name,
         u.role as user_role, 
         CASE WHEN (u.settings->>'hideIdentity')::boolean = true AND u.id != $2::uuid THEN NULL ELSE u.avatar_url END as user_avatar,
         (SELECT reaction_type FROM comment_reactions WHERE comment_id = c.id AND user_id = $2) as user_reaction
         FROM comments c 
         JOIN users u ON c.user_id = u.id 
         WHERE c.complaint_id = $1 
         ORDER BY c.created_at ASC`,
        [complaintId, requesterId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.get("/api/comments/:id/evidence", async (req, res) => {
    const id = toUuid(req.params.id);
    if (!id) return res.status(400).send("Invalid ID");
    try {
      const result = await query("SELECT evidence_url FROM comments WHERE id = $1", [id]);
      const evidence = result.rows[0]?.evidence_url;
      if (!evidence) {
        return res.status(404).send("Not found");
      }
      
      const match = evidence.match(/^data:(.*?);base64,(.*)$/);
      if (match) {
        const mimeType = match[1];
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');
        res.setHeader('Content-Type', mimeType);
        res.send(buffer);
      } else {
        res.send(evidence);
      }
    } catch (err) {
      console.error(err);
      res.status(500).send("Server Error");
    }
  });

  app.post("/api/comments/:id/react", async (req, res) => {
    const userId = toUuid(req.body.userId);
    const reactionType = req.body.reactionType;
    const commentId = toUuid(req.params.id);
    
    if (!userId || !commentId) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    try {
      // Get existing reaction
      const existing = await query("SELECT reaction_type FROM comment_reactions WHERE user_id = $1 AND comment_id = $2", [userId, commentId]);
      const prevType = existing.rows[0]?.reaction_type;

      if (prevType === reactionType) {
        // Toggle off
        await query("DELETE FROM comment_reactions WHERE user_id = $1 AND comment_id = $2", [userId, commentId]);
        const col = prevType === 'LIKE' ? 'likes_count' : 'dislikes_count';
        await query(`UPDATE comments SET ${col} = GREATEST(0, ${col} - 1) WHERE id = $1`, [commentId]);
      } else {
        // Change or New
        if (prevType) {
          const colOff = prevType === 'LIKE' ? 'likes_count' : 'dislikes_count';
          await query(`UPDATE comments SET ${colOff} = GREATEST(0, ${colOff} - 1) WHERE id = $1`, [commentId]);
        }
        
        await query(
          "INSERT INTO comment_reactions (user_id, comment_id, reaction_type) VALUES ($1, $2, $3) ON CONFLICT (user_id, comment_id) DO UPDATE SET reaction_type = EXCLUDED.reaction_type",
          [userId, commentId, reactionType]
        );
        
        const colOn = reactionType === 'LIKE' ? 'likes_count' : 'dislikes_count';
        await query(`UPDATE comments SET ${colOn} = ${colOn} + 1 WHERE id = $1`, [commentId]);
      }

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Reaction update failed" });
    }
  });

  app.post("/api/complaints/:id/comments", async (req, res) => {
    const { text, isOfficial, evidenceUrl } = req.body;
    const userId = toUuid(req.body.userId);
    const complaintId = toUuid(req.params.id);

    if (!complaintId || !userId) return res.status(400).json({ error: "Invalid Credentials or ID" });
    try {
      // Real-Time AI Content Moderation for Comments
      const modResult = await moderateContent(text);
      if (modResult.blocked) {
        await query(
          "INSERT INTO system_audit_logs (user_id, action, details) VALUES ($1, $2, $3)",
          [userId, 'CONTENT_FLAGGED', { 
            text: text, 
            complaintId, 
            category: modResult.category, 
            reason: modResult.reason,
            confidence: modResult.confidence,
            aiBlocked: true,
            target: 'comment'
          }]
        );
        return res.status(400).json({ error: `Blocked by AI Guardrails: ${modResult.reason}` });
      }

      const result = await query(
        "INSERT INTO comments (complaint_id, user_id, text, is_official, evidence_url) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [complaintId, userId, text, isOfficial || false, evidenceUrl || null]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to post comment" });
    }
  });

  // System Admin Management Endpoints
  app.get("/api/system/universities", async (req, res) => {
    try {
      const result = await query("SELECT * FROM universities ORDER BY name");
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Failed to fetch unis" }); }
  });

  app.post("/api/system/universities", async (req, res) => {
    const { name, location, adminName, adminUser, adminPass } = req.body;
    try {
      // 0. Check if university already exists
      const existing = await query("SELECT id FROM universities WHERE name = $1", [name]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: `University '${name}' already exists in the system.` });
      }

      // 1. Create the University
      const uniRes = await query("INSERT INTO universities (name, location) VALUES ($1, $2) RETURNING *", [name, location]);
      const university = uniRes.rows[0];

      // 2. Provision Root Super Admin (The Onboarding Pipeline)
      const adminUsername = adminUser || `${name.split(" ")[0].toLowerCase()}_admin_${Math.floor(1000 + Math.random() * 9000)}`;
      const temporaryPassword = adminPass || Math.random().toString(36).slice(-10);
      const studentIdCode = `ROOT-${Math.floor(100000 + Math.random() * 900000)}`;

      await query(
        `INSERT INTO users (full_name, username, password, role, university_id, student_id_number, is_verified) 
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [adminName || `Super Admin @ ${name}`, adminUsername, temporaryPassword, "UNI_ADMIN", university.id, studentIdCode]
      );

      // 3. Log the onboarding event
      await query(
        "INSERT INTO system_audit_logs (action, details) VALUES ($1, $2)",
        ['INSTITUTION_PROVISIONED', { universityName: name, adminUsername }]
      );

      res.json({ 
        university, 
        credentials: { 
          username: adminUsername, 
          password: temporaryPassword,
          role: "UNI_ADMIN",
          note: "This is a one-time cryptographic token sequence. Secure it immediately."
        } 
      });
    } catch (err) { 
      console.error(err);
      res.status(500).json({ error: "Onboarding pipeline failed. Namespace conflict or database error." }); 
    }
  });

  app.patch("/api/system/universities/:id", async (req, res) => {
    const { is_frozen } = req.body;
    const id = toUuid(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid University ID" });
    try {
      const result = await query("UPDATE universities SET is_frozen = $1 WHERE id = $2 RETURNING *", [is_frozen, id]);
      res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Update failed" }); }
  });

  app.get("/api/system/categories", async (req, res) => {
    try {
      const result = await query("SELECT * FROM category_definitions ORDER BY created_at DESC");
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Failed to fetch categories" }); }
  });

  app.post("/api/system/categories", async (req, res) => {
    const { name, label, description } = req.body;
    try {
      const result = await query("INSERT INTO category_definitions (name, label, description) VALUES ($1, $2, $3) RETURNING *", [name.toUpperCase().replace(/\s+/g, '_'), label, description]);
      res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Failed to create category" }); }
  });

  app.delete("/api/system/categories/:id", async (req, res) => {
    try {
      await query("DELETE FROM category_definitions WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed to delete category" }); }
  });

  app.get("/api/system/banned-words", async (req, res) => {
    try {
      const result = await query("SELECT * FROM banned_words ORDER BY word ASC");
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Failed to fetch banned words" }); }
  });

  app.post("/api/system/banned-words", async (req, res) => {
    const { word } = req.body;
    try {
      const result = await query("INSERT INTO banned_words (word) VALUES ($1) ON CONFLICT DO NOTHING RETURNING *", [word]);
      res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Failed to add word" }); }
  });

  app.delete("/api/system/banned-words/:id", async (req, res) => {
    const id = toUuid(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid Word ID" });
    try {
      await query("DELETE FROM banned_words WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Delete failed" }); }
  });

  app.get("/api/system/audit-logs", async (req, res) => {
    try {
      const result = await query(`
        SELECT l.*, u.full_name as user_name, u.role as user_role 
        FROM system_audit_logs l 
        LEFT JOIN users u ON l.user_id = u.id 
        ORDER BY l.created_at DESC 
        LIMIT 100
      `);
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Audit logs failed" }); }
  });

  // MOE User Management (Root Scope)
  app.get("/api/system/moe-users", async (req, res) => {
    try {
      const result = await query(
        "SELECT id, full_name, username, role, created_at FROM users WHERE role = 'MOE' ORDER BY created_at DESC"
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Fetch MOE users failed" });
    }
  });

  app.post("/api/system/moe-users", async (req, res) => {
    const { fullName, username, password } = req.body;
    try {
      const result = await query(
        "INSERT INTO users (full_name, username, password, role, is_verified) VALUES ($1, $2, $3, 'MOE', true) RETURNING *",
        [fullName, username, password]
      );
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: "Failed to create MOE account" });
    }
  });

  // Institutional User Management (System Admin scope)
  app.get("/api/system/universities/:id/users", async (req, res) => {
    const id = toUuid(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid University ID" });
    try {
      const result = await query(
        "SELECT id, full_name, username, role, student_id_number, assigned_category, created_at FROM users WHERE university_id = $1 ORDER BY role, full_name",
        [id]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Fetch university users failed" });
    }
  });

  app.post("/api/system/users/:id/reset-password", async (req, res) => {
    const { newPassword } = req.body;
    const id = toUuid(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid User ID" });
    try {
      await query("UPDATE users SET password = $1 WHERE id = $2", [newPassword, id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Password reset failed" });
    }
  });

  app.delete("/api/system/users/:id", async (req, res) => {
    const id = toUuid(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid User ID" });
    try {
      await query("DELETE FROM department_notifications WHERE user_id = $1", [id]);
      await query("DELETE FROM users WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "User deletion failed" });
    }
  });

  // Pre-registered students endpoints
  app.get("/api/system/pre-registered-students", async (req, res) => {
    try {
      const result = await query(`
        SELECT p.*, uni.name as university_name 
        FROM pre_registered_students p
        LEFT JOIN universities uni ON p.university_id = uni.id
        ORDER BY p.created_at DESC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error("Fetch pre-registered students failed:", err);
      res.status(500).json({ error: "Fetch pre-registered students failed" });
    }
  });

  app.post("/api/system/pre-registered-students/bulk", async (req, res) => {
    const { students } = req.body;
    if (!students || !Array.isArray(students)) {
      return res.status(400).json({ error: "Invalid payload. 'students' array is required." });
    }
    try {
      let insertedCount = 0;
      let updatedCount = 0;
      
      const unis = await query("SELECT id, name FROM universities");
      
      for (const student of students) {
        if (!student.student_id || !student.full_name) {
          continue;
        }

        let universityId = student.university_id || null;
        
        // Auto detect if requested
        if (!universityId || universityId === "AUTO") {
          const cleanId = student.student_id.trim().toLowerCase();
          if (cleanId.startsWith("ddu")) {
            universityId = unis.rows.find(u => u.name.toLowerCase().includes("dire dawa"))?.id || null;
          } else if (cleanId.startsWith("aau")) {
            universityId = unis.rows.find(u => u.name.toLowerCase().includes("addis ababa"))?.id || null;
          } else if (cleanId.startsWith("astu")) {
            universityId = unis.rows.find(u => u.name.toLowerCase().includes("adama"))?.id || null;
          } else if (cleanId.startsWith("uog")) {
            // Find Gondar
            let gondar = unis.rows.find(u => u.name.toLowerCase().includes("gondar"));
            if (!gondar) {
              // Create Gondar University automatically
              const createdUni = await query("INSERT INTO universities (name, location) VALUES ($1, $2) RETURNING *", ["University of Gondar", "Gondar"]);
              if (createdUni.rows.length > 0) {
                gondar = createdUni.rows[0];
                unis.rows.push(gondar); // Add to local cache for subsequent rows
              }
            }
            universityId = gondar?.id || null;
          } else if (cleanId.startsWith("bdu")) {
            universityId = unis.rows.find(u => u.name.toLowerCase().includes("bahir dar"))?.id || null;
          } else if (cleanId.startsWith("hu") || cleanId.startsWith("hwu")) {
            universityId = unis.rows.find(u => u.name.toLowerCase().includes("hawassa"))?.id || null;
          }
        }

        // Check if student already pre-registered
        const check = await query("SELECT id FROM pre_registered_students WHERE student_id = $1", [student.student_id]);
        if (check.rows.length > 0) {
          await query("UPDATE pre_registered_students SET full_name = $1, university_id = $2 WHERE student_id = $3", [student.full_name, toUuid(universityId), student.student_id]);
          updatedCount++;
        } else {
          await query("INSERT INTO pre_registered_students (student_id, full_name, university_id) VALUES ($1, $2, $3)", [student.student_id, student.full_name, toUuid(universityId)]);
          insertedCount++;
        }
      }

      res.json({ success: true, insertedCount, updatedCount });
    } catch (err) {
      console.error("Bulk pre-registration upload failed:", err);
      res.status(500).json({ error: "Bulk upload failed" });
    }
  });

  app.delete("/api/system/pre-registered-students/:id", async (req, res) => {
    const id = toUuid(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid record ID" });
    try {
      await query("DELETE FROM pre_registered_students WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error("Delete pre-registered student failed:", err);
      res.status(500).json({ error: "Deletion failed" });
    }
  });

  app.get("/api/auth/verify-student-id", async (req, res) => {
    const studentId = req.query.studentId as string;
    if (!studentId) {
      return res.status(400).json({ error: "Student ID is required" });
    }
    try {
      const studentRes = await query("SELECT * FROM pre_registered_students WHERE student_id = $1", [studentId.trim()]);
      if (studentRes.rows.length === 0) {
        return res.json({ found: false });
      }
      
      const s = studentRes.rows[0];
      const uniRes = await query("SELECT name FROM universities WHERE id = $1", [s.university_id]);
      const uniName = uniRes.rows.length > 0 ? uniRes.rows[0].name : "Unknown University";
      
      res.json({
        found: true,
        fullName: s.full_name,
        universityId: s.university_id,
        universityName: uniName
      });
    } catch (err) {
      console.error("Verify student ID failed:", err);
      res.status(500).json({ error: "Verification failed" });
    }
  });

  app.get("/api/system/users", async (req, res) => {
    try {
      const result = await query(`
        SELECT u.*, uni.name as university_name 
        FROM users u 
        LEFT JOIN universities uni ON u.university_id = uni.id 
        ORDER BY u.created_at DESC
      `);
      res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Fetch users failed" }); }
  });

  app.get("/api/system/export-zip", async (req, res) => { res.status(410).json({ error: "This feature has been removed." }); });

  app.patch("/api/system/users/:id/status", async (req, res) => {
    const { account_status } = req.body;
    const id = toUuid(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid User ID" });
    try {
      const result = await query("UPDATE users SET account_status = $1 WHERE id = $2 RETURNING *", [account_status, id]);
      res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Update user failed" }); }
  });

  // User Profile Update
  app.patch("/api/users/:id/profile", async (req, res) => {
    const { fullName, bio, avatarUrl } = req.body;
    const id = toUuid(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid User ID" });
    try {
      const result = await query(
        "UPDATE users SET full_name = $1, bio = $2, avatar_url = $3, updated_at = NOW() WHERE id = $4 RETURNING *",
        [fullName, bio, avatarUrl, id]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Profile update failed" });
    }
  });

  app.patch("/api/users/:id/password", async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const id = toUuid(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid User ID" });
    try {
      // First verify current password
      const userRes = await query("SELECT password FROM users WHERE id = $1", [id]);
      if (userRes.rows.length === 0) return res.status(404).json({ error: "User not found" });
      
      if (userRes.rows[0].password !== currentPassword) {
        return res.status(401).json({ error: "Incorrect current password" });
      }

      await query("UPDATE users SET password = $1 WHERE id = $2", [newPassword, id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Password update failed" });
    }
  });

  app.patch("/api/universities/:id/logo", async (req, res) => {
    const { logoUrl } = req.body;
    const id = toUuid(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid University ID" });
    try {
      const result = await query(
        "UPDATE universities SET logo_url = $1 WHERE id = $2 RETURNING *",
        [logoUrl, id]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "University logo update failed" });
    }
  });

  app.patch("/api/users/:id/settings", async (req, res) => {
    const { settings } = req.body;
    const id = toUuid(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid User ID" });
    try {
      console.log(`[PATCH Settings] Updating user ${id} with:`, settings);
      const result = await query(
        "UPDATE users SET settings = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *",
        [JSON.stringify(settings), id]
      );
      console.log(`[PATCH Settings] User ${id} updated:`, result.rows[0]);
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Settings update failed" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    const id = toUuid(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid User ID" });
    try {
      const result = await query("SELECT id, full_name, username, role, university_id, avatar_url, bio, student_id_number, phone, account_status, settings, created_at FROM users WHERE id = $1", [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: "Fetch user failed" });
    }
  });

  // Analytics (MoE)
  app.get("/api/analytics", async (req, res) => {
    try {
      const statsByCategory = await query(`
        SELECT category, COUNT(*) as count 
        FROM complaints 
        GROUP BY category
      `);
      
      const statsByUniversity = await query(`
        SELECT u.name as university_name, 
               COUNT(*) as total_complaints
        FROM complaints c
        JOIN universities u ON c.university_id = u.id
        GROUP BY u.name
      `);

      res.json({
        byCategory: statsByCategory.rows,
        byUniversity: statsByUniversity.rows
      });
    } catch (err) {
      console.error("Analytics error:", err);
      res.status(500).json({ error: "Analytics failed" });
    }
  });

  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Express Global Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal Server Error", message: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
