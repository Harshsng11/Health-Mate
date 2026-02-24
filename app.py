from flask import Flask, render_template, request, jsonify
import sqlite3
import os

app = Flask(__name__)
DATABASE = 'healthmate.db'

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as db:
        db.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE,
                name TEXT,
                role TEXT
            )
        ''')
        db.execute('''
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                type TEXT,
                date TEXT,
                summary TEXT,
                file_path TEXT
            )
        ''')
        db.execute('''
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
            )
        ''')
        db.execute('''
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doctor_id INTEGER,
                date TEXT,
                time TEXT,
                status TEXT,
                FOREIGN KEY(doctor_id) REFERENCES doctors(id)
            )
        ''')
        
        # Seed doctors if empty
        cursor = db.execute("SELECT COUNT(*) FROM doctors")
        if cursor.fetchone()[0] == 0:
            doctors = [
                ("Dr. Rajesh Gupta", "Cardiologist", "Connaught Place, Delhi", 4.9, "Mon, Wed, Fri", 28.6315, 77.2167, "HDFC Ergo, Max Bupa", 124, "2026-02-22"),
                ("Dr. Anjali Sharma", "Orthopedic Surgeon", "Saket, Delhi", 4.8, "Tue, Thu", 28.5244, 77.2100, "Star Health, LIC", 89, "2026-02-23"),
                ("Dr. Vikram Singh", "Neurologist", "Dwarka, Delhi", 4.7, "Mon-Fri", 28.5823, 77.0500, "Apollo Munich, HDFC", 56, "2026-02-21"),
                ("Dr. Meera Reddy", "General Physician", "Hauz Khas, Delhi", 4.6, "Daily", 28.5494, 77.2001, "All Major Insurances", 210, "2026-02-21"),
                ("Dr. Amit Verma", "Pediatrician", "Rohini, Delhi", 4.9, "Mon-Sat", 28.7041, 77.1025, "Max Bupa, Star Health", 145, "2026-02-24"),
                ("Dr. Neha Kapoor", "Dermatologist", "Greater Kailash, Delhi", 4.5, "Wed, Fri", 28.5482, 77.2326, "HDFC Ergo", 78, "2026-02-25")
            ]
            db.executemany("INSERT INTO doctors (name, specialty, location, rating, availability, lat, lng, insurance, reviews_count, next_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", doctors)
        db.commit()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/doctors')
def get_doctors():
    with get_db() as db:
        doctors = db.execute("SELECT * FROM doctors").fetchall()
        return jsonify([dict(row) for row in doctors])

@app.route('/api/reports', methods=['GET', 'POST'])
def handle_reports():
    if request.method == 'POST':
        data = request.json
        with get_db() as db:
            cursor = db.execute("INSERT INTO reports (name, type, date, summary, file_path) VALUES (?, ?, ?, ?, ?)",
                               (data['name'], data['type'], data['date'], data['summary'], data.get('file_path', '')))
            db.commit()
            return jsonify({"id": cursor.lastrowid})
    else:
        with get_db() as db:
            reports = db.execute("SELECT * FROM reports ORDER BY date DESC").fetchall()
            return jsonify([dict(row) for row in reports])

@app.route('/api/bookings', methods=['GET', 'POST'])
def handle_bookings():
    if request.method == 'POST':
        data = request.json
        with get_db() as db:
            cursor = db.execute("INSERT INTO bookings (doctor_id, date, time, status) VALUES (?, ?, ?, ?)",
                               (data['doctor_id'], data['date'], data['time'], 'Confirmed'))
            db.commit()
            return jsonify({"id": cursor.lastrowid})
    else:
        with get_db() as db:
            bookings = db.execute('''
                SELECT b.*, d.name as doctor_name, d.specialty 
                FROM bookings b 
                JOIN doctors d ON b.doctor_id = d.id
            ''').fetchall()
            return jsonify([dict(row) for row in bookings])

@app.route('/api/onboard', methods=['POST'])
def onboard():
    data = request.json
    try:
        with get_db() as db:
            db.execute("INSERT INTO users (email, name, role) VALUES (?, ?, ?)",
                       (data['email'], data['name'], data['role']))
            db.commit()
            return jsonify(data)
    except sqlite3.IntegrityError:
        with get_db() as db:
            user = db.execute("SELECT * FROM users WHERE email = ?", (data['email'],)).fetchone()
            return jsonify(dict(user))

@app.route('/api/admin/stats')
def get_stats():
    with get_db() as db:
        total_bookings = db.execute("SELECT COUNT(*) FROM bookings").fetchone()[0]
        total_patients = db.execute("SELECT COUNT(DISTINCT email) FROM users WHERE role = 'patient'").fetchone()[0]
        recent_bookings = db.execute('''
            SELECT b.*, d.name as doctor_name, d.specialty 
            FROM bookings b 
            JOIN doctors d ON b.doctor_id = d.id
            ORDER BY b.id DESC LIMIT 10
        ''').fetchall()
        return jsonify({
            "totalBookings": total_bookings,
            "totalPatients": total_patients,
            "recentBookings": [dict(row) for row in recent_bookings]
        })

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=3000, debug=True)
