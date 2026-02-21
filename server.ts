import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("healthmate.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    name TEXT,
    role TEXT
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    type TEXT,
    date TEXT,
    summary TEXT,
    file_path TEXT
  );

  CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    specialty TEXT,
    location TEXT,
    rating REAL,
    availability TEXT,
    lat REAL,
    lng REAL,
    insurance TEXT,
    reviews_count INTEGER,
    next_available TEXT
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doctor_id INTEGER,
    date TEXT,
    time TEXT,
    status TEXT,
    FOREIGN KEY(doctor_id) REFERENCES doctors(id)
  );
`);

// Seed doctors if empty
const doctorCount = db.prepare("SELECT COUNT(*) as count FROM doctors").get() as { count: number };
if (doctorCount.count === 0) {
  const insert = db.prepare("INSERT INTO doctors (name, specialty, location, rating, availability, lat, lng, insurance, reviews_count, next_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  insert.run("Dr. Rajesh Gupta", "Cardiologist", "Connaught Place, Delhi", 4.9, "Mon, Wed, Fri", 28.6315, 77.2167, "HDFC Ergo, Max Bupa", 124, "2026-02-22");
  insert.run("Dr. Anjali Sharma", "Orthopedic Surgeon", "Saket, Delhi", 4.8, "Tue, Thu", 28.5244, 77.2100, "Star Health, LIC", 89, "2026-02-23");
  insert.run("Dr. Vikram Singh", "Neurologist", "Dwarka, Delhi", 4.7, "Mon-Fri", 28.5823, 77.0500, "Apollo Munich, HDFC", 56, "2026-02-21");
  insert.run("Dr. Meera Reddy", "General Physician", "Hauz Khas, Delhi", 4.6, "Daily", 28.5494, 77.2001, "All Major Insurances", 210, "2026-02-21");
  insert.run("Dr. Amit Verma", "Pediatrician", "Rohini, Delhi", 4.9, "Mon-Sat", 28.7041, 77.1025, "Max Bupa, Star Health", 145, "2026-02-24");
  insert.run("Dr. Neha Kapoor", "Dermatologist", "Greater Kailash, Delhi", 4.5, "Wed, Fri", 28.5482, 77.2326, "HDFC Ergo", 78, "2026-02-25");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/doctors", (req, res) => {
    const doctors = db.prepare("SELECT * FROM doctors").all();
    res.json(doctors);
  });

  app.get("/api/reports", (req, res) => {
    const reports = db.prepare("SELECT * FROM reports ORDER BY date DESC").all();
    res.json(reports);
  });

  app.post("/api/reports", (req, res) => {
    const { name, type, date, summary, file_path } = req.body;
    const info = db.prepare("INSERT INTO reports (name, type, date, summary, file_path) VALUES (?, ?, ?, ?, ?)").run(name, type, date, summary, file_path);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/bookings", (req, res) => {
    const bookings = db.prepare(`
      SELECT b.*, d.name as doctor_name, d.specialty 
      FROM bookings b 
      JOIN doctors d ON b.doctor_id = d.id
    `).all();
    res.json(bookings);
  });

  app.post("/api/bookings", (req, res) => {
    const { doctor_id, date, time } = req.body;
    const info = db.prepare("INSERT INTO bookings (doctor_id, date, time, status) VALUES (?, ?, ?, ?)").run(doctor_id, date, time, 'Confirmed');
    res.json({ id: info.lastInsertRowid });
  });

  app.post("/api/onboard", (req, res) => {
    const { email, name, role } = req.body;
    try {
      const info = db.prepare("INSERT INTO users (email, name, role) VALUES (?, ?, ?)").run(email, name, role);
      res.json({ id: info.lastInsertRowid, email, name, role });
    } catch (e) {
      const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
      res.json(user);
    }
  });

  app.get("/api/admin/stats", (req, res) => {
    const totalBookings = db.prepare("SELECT COUNT(*) as count FROM bookings").get() as any;
    const totalPatients = db.prepare("SELECT COUNT(DISTINCT email) as count FROM users WHERE role = 'patient'").get() as any;
    const recentBookings = db.prepare(`
      SELECT b.*, d.name as doctor_name, d.specialty 
      FROM bookings b 
      JOIN doctors d ON b.doctor_id = d.id
      ORDER BY b.id DESC LIMIT 10
    `).all();
    res.json({
      totalBookings: totalBookings.count,
      totalPatients: totalPatients.count,
      recentBookings
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
