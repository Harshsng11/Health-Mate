import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'static')));

const db = new Database("healthmate.db");

// Initialize Database (matching Python schema)
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
const count = db.prepare("SELECT COUNT(*) as count FROM doctors").get().count;
if (count === 0) {
    const insert = db.prepare("INSERT INTO doctors (name, specialty, location, rating, availability, lat, lng, insurance, reviews_count, next_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const doctors = [
        ["Dr. Rajesh Gupta", "Cardiologist", "Connaught Place, Delhi", 4.9, "Mon, Wed, Fri", 28.6315, 77.2167, "HDFC Ergo, Max Bupa", 124, "2026-02-22"],
        ["Dr. Anjali Sharma", "Orthopedic Surgeon", "Saket, Delhi", 4.8, "Tue, Thu", 28.5244, 77.2100, "Star Health, LIC", 89, "2026-02-23"],
        ["Dr. Vikram Singh", "Neurologist", "Dwarka, Delhi", 4.7, "Mon-Fri", 28.5823, 77.0500, "Apollo Munich, HDFC", 56, "2026-02-21"],
        ["Dr. Meera Reddy", "General Physician", "Hauz Khas, Delhi", 4.6, "Daily", 28.5494, 77.2001, "All Major Insurances", 210, "2026-02-21"],
        ["Dr. Amit Verma", "Pediatrician", "Rohini, Delhi", 4.9, "Mon-Sat", 28.7041, 77.1025, "Max Bupa, Star Health", 145, "2026-02-24"],
        ["Dr. Neha Kapoor", "Dermatologist", "Greater Kailash, Delhi", 4.5, "Wed, Fri", 28.5482, 77.2326, "HDFC Ergo", 78, "2026-02-25"]
    ];
    doctors.forEach(d => insert.run(...d));
}

// API Routes
app.get('/api/config', (req, res) => {
    res.json({ apiKey: process.env.GEMINI_API_KEY || "" });
});

app.get('/api/doctors', (req, res) => {
    res.json(db.prepare("SELECT * FROM doctors").all());
});

app.get('/api/reports', (req, res) => {
    res.json(db.prepare("SELECT * FROM reports ORDER BY date DESC").all());
});

app.post('/api/reports', (req, res) => {
    const { name, type, date, summary, file_path } = req.body;
    const info = db.prepare("INSERT INTO reports (name, type, date, summary, file_path) VALUES (?, ?, ?, ?, ?)").run(name, type, date, summary, file_path || '');
    res.json({ id: info.lastInsertRowid });
});

app.get('/api/bookings', (req, res) => {
    res.json(db.prepare(`
        SELECT b.*, d.name as doctor_name, d.specialty 
        FROM bookings b 
        JOIN doctors d ON b.doctor_id = d.id
    `).all());
});

app.post('/api/bookings', (req, res) => {
    const { doctor_id, date, time } = req.body;
    const info = db.prepare("INSERT INTO bookings (doctor_id, date, time, status) VALUES (?, ?, ?, ?)").run(doctor_id, date, time, 'Confirmed');
    res.json({ id: info.lastInsertRowid });
});

app.post('/api/onboard', (req, res) => {
    const { email, name, role } = req.body;
    try {
        db.prepare("INSERT INTO users (email, name, role) VALUES (?, ?, ?)").run(email, name, role);
        res.json({ email, name, role });
    } catch (e) {
        res.json(db.prepare("SELECT * FROM users WHERE email = ?").get(email));
    }
});

app.get('/api/admin/stats', (req, res) => {
    const totalBookings = db.prepare("SELECT COUNT(*) as count FROM bookings").get().count;
    const totalPatients = db.prepare("SELECT COUNT(DISTINCT email) as count FROM users WHERE role = 'patient'").get().count;
    const recentBookings = db.prepare(`
        SELECT b.*, d.name as doctor_name, d.specialty 
        FROM bookings b 
        JOIN doctors d ON b.doctor_id = d.id
        ORDER BY b.id DESC LIMIT 10
    `).all();
    res.json({ totalBookings, totalPatients, recentBookings });
});

// Serve Frontend
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'templates', 'index.html');
    let content = fs.readFileSync(indexPath, 'utf8');
    
    // Inject API Key safely for the preview environment
    const apiKey = process.env.GEMINI_API_KEY || "";
    content = content.replace('const apiKey = "YOUR_GEMINI_API_KEY";', `const apiKey = "${apiKey}";`);
    
    res.send(content);
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
