# Health Mate - AI Health Companion

A modern healthcare management platform with AI-powered symptom analysis, doctor booking, and medical report management.

## Tech Stack
- **Backend:** Python (Flask)
- **Frontend:** HTML5, CSS3 (Tailwind CSS), JavaScript (Vanilla ES6+)
- **Database:** SQLite
- **AI:** Google Gemini API

## Local Setup

### 1. Prerequisites
- Python 3.8+ installed on your machine.
- A Google Gemini API Key (get it from [Google AI Studio](https://aistudio.google.com/app/apikey)).

### 2. Installation
1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd Health-Mate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### 3. Configuration
1. Open `static/js/app.js`.
2. Find the `apiKey` variable at the top of the file.
3. Replace `"YOUR_GEMINI_API_KEY"` with your actual API key.

### 4. Running the App
```bash
python app.py
```
The app will be available at `http://localhost:3000`.

## Features
- **AI Symptom Checker:** Get instant assessments of your symptoms.
- **AI Medical Help:** Chat with a medical-trained AI assistant.
- **Doctor Discovery:** Find and book appointments with specialists.
- **Report Management:** Securely store and view your medical records.
- **Admin Dashboard:** Overview of center activities (for healthcare providers).

## Project Structure
- `app.py`: Flask backend and API routes.
- `templates/`: HTML templates.
- `static/`: CSS, JavaScript, and image assets.
- `healthmate.db`: SQLite database (auto-generated on first run).
