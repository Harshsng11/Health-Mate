// State Management
let state = {
    activeTab: 'dashboard',
    user: null,
    doctors: [],
    reports: [],
    bookings: [],
    userLocation: null,
    loading: false,
    chatMessages: [{ role: 'model', text: "Hello! I'm your AI Medical Assistant. How can I help you today?" }]
};

// Gemini API Setup
// The apiKey is now provided by index.html (injected by the server)
let ai = null;

try {
    const { GoogleGenAI } = await import("@google/genai");
    if (typeof apiKey !== 'undefined' && apiKey && apiKey !== "YOUR_GEMINI_API_KEY") {
        ai = new GoogleGenAI({ apiKey });
    } else {
        console.warn("Gemini API Key is missing or not set.");
    }
} catch (e) {
    console.error("Failed to load Google GenAI SDK:", e);
}

// DOM Elements
const tabContent = document.getElementById('tab-content');
const onboardingModal = document.getElementById('onboarding-modal');
const onboardingForm = document.getElementById('onboarding-form');

// Initialize
async function init() {
    console.log("Initializing app...");
    const savedUser = localStorage.getItem('healthmate_user');
    if (savedUser) {
        try {
            state.user = JSON.parse(savedUser);
            console.log("User loaded from storage:", state.user);
            updateUserProfile();
            await loadData();
            switchTab('dashboard');
        } catch (e) {
            console.error("Error parsing saved user:", e);
            localStorage.removeItem('healthmate_user');
            showOnboarding();
        }
    } else {
        showOnboarding();
    }
}

function showOnboarding() {
    onboardingModal.classList.remove('hidden');
    setTimeout(() => {
        onboardingModal.classList.remove('opacity-0');
        document.getElementById('onboarding-card').classList.remove('scale-95');
    }, 10);
}

function hideOnboarding() {
    onboardingModal.classList.add('opacity-0');
    document.getElementById('onboarding-card').classList.add('scale-95');
    setTimeout(() => {
        onboardingModal.classList.add('hidden');
    }, 500);
}

// Onboarding
onboardingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log("Submitting onboarding form...");
    
    const name = document.getElementById('onboard-name').value;
    const email = document.getElementById('onboard-email').value;
    const role = document.getElementById('onboard-role').value;

    try {
        const res = await fetch('/api/onboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, role })
        });
        
        if (!res.ok) throw new Error('Onboarding failed');
        
        const user = await res.json();
        console.log("Onboarding success:", user);
        
        state.user = user;
        localStorage.setItem('healthmate_user', JSON.stringify(user));
        hideOnboarding();
        updateUserProfile();
        await loadData();
        switchTab('dashboard');
    } catch (err) {
        console.error("Onboarding error:", err);
        alert("Failed to sign in. Please try again.");
    }
});

function updateUserProfile() {
    if (!state.user) return;
    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    if (nameEl) nameEl.textContent = state.user.name;
    if (roleEl) roleEl.textContent = state.user.role.charAt(0).toUpperCase() + state.user.role.slice(1);
    
    const profile = document.getElementById('user-profile');
    if (profile) {
        profile.onclick = (e) => {
            e.preventDefault();
            if (confirm("Do you want to logout?")) {
                localStorage.removeItem('healthmate_user');
                window.location.reload();
            }
        };
    }
}

// Data Loading
async function loadData() {
    const [docsRes, reportsRes, bookingsRes] = await Promise.all([
        fetch('/api/doctors'),
        fetch('/api/reports'),
        fetch('/api/bookings')
    ]);
    state.doctors = await docsRes.json();
    state.reports = await reportsRes.json();
    state.bookings = await bookingsRes.json();
    render();
}

// Navigation
window.switchTab = (tab) => {
    state.activeTab = tab;
    document.querySelectorAll('.nav-item').forEach(el => {
        if (el.dataset.tab === tab) {
            el.classList.add('bg-emerald-600', 'text-white', 'shadow-lg', 'shadow-emerald-600/20', 'scale-[1.02]');
            el.classList.remove('text-slate-500', 'hover:bg-slate-100');
        } else {
            el.classList.remove('bg-emerald-600', 'text-white', 'shadow-lg', 'shadow-emerald-600/20', 'scale-[1.02]');
            el.classList.add('text-slate-500', 'hover:bg-slate-100');
        }
    });
    
    // Animate tab content entrance
    const content = document.getElementById('tab-content');
    content.style.opacity = '0';
    content.style.transform = 'translateY(10px)';
    
    render();
    
    if (window.motion) {
        window.motion.animate(content, { opacity: 1, y: 0 }, { duration: 0.4, easing: "ease-out" });
    } else {
        content.style.opacity = '1';
        content.style.transform = 'translateY(0)';
    }
};

// Rendering
function render() {
    tabContent.innerHTML = '';
    
    if (state.activeTab === 'dashboard') renderDashboard();
    else if (state.activeTab === 'symptom-checker') renderSymptomChecker();
    else if (state.activeTab === 'ai-help') renderAIHelp();
    else if (state.activeTab === 'doctors') renderDoctors();
    else if (state.activeTab === 'reports') renderReports();
    
    updateUserProfile();
    lucide.createIcons();
}

function renderDashboard() {
    tabContent.innerHTML = `
        <div class="space-y-8">
            <header>
                <h1 class="text-3xl font-bold text-slate-900">Welcome back, ${state.user.name.split(' ')[0]}!</h1>
                <p class="text-slate-500">Here's a quick look at your health status.</p>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm card-hover">
                    <div class="flex items-center justify-between mb-4">
                        <div class="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                            <i data-lucide="calendar" class="w-6 h-6"></i>
                        </div>
                        <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Upcoming</span>
                    </div>
                    <h3 class="text-slate-500 text-sm font-medium">Next Appointment</h3>
                    <p class="text-2xl font-bold text-slate-900">${state.bookings.length > 0 ? state.bookings[0].doctor_name : 'No bookings'}</p>
                </div>
                <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm card-hover">
                    <div class="flex items-center justify-between mb-4">
                        <div class="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                            <i data-lucide="file-text" class="w-6 h-6"></i>
                        </div>
                        <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Reports</span>
                    </div>
                    <h3 class="text-slate-500 text-sm font-medium">Active Reports</h3>
                    <p class="text-2xl font-bold text-slate-900">${state.reports.length}</p>
                </div>
                <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm card-hover">
                    <div class="flex items-center justify-between mb-4">
                        <div class="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600">
                            <i data-lucide="star" class="w-6 h-6"></i>
                        </div>
                        <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Health Score</span>
                    </div>
                    <h3 class="text-slate-500 text-sm font-medium">Wellness Index</h3>
                    <p class="text-2xl font-bold text-slate-900">92/100</p>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="bg-emerald-600 rounded-3xl p-8 text-white shadow-xl shadow-emerald-600/20 relative overflow-hidden">
                    <div class="relative z-10">
                        <h2 class="text-2xl font-bold mb-4">AI Symptom Check</h2>
                        <p class="text-emerald-50 mb-6 opacity-90">Feeling unwell? Our AI engine can help analyze your symptoms in seconds.</p>
                        <button onclick="switchTab('symptom-checker')" class="bg-white text-emerald-600 px-6 py-3 rounded-xl font-bold hover:bg-emerald-50 transition-colors">Start Analysis</button>
                    </div>
                    <i data-lucide="brain" class="absolute -right-8 -bottom-8 w-48 h-48 text-white/10"></i>
                </div>

                <div class="bg-white rounded-3xl border border-slate-200 p-8">
                    <h2 class="text-xl font-bold mb-6">Recent Activity</h2>
                    <div class="space-y-6">
                        ${state.bookings.slice(0, 3).map(b => `
                            <div class="flex items-center gap-4">
                                <div class="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                                    <i data-lucide="clock" class="w-5 h-5"></i>
                                </div>
                                <div class="flex-1">
                                    <p class="text-sm font-bold">Appointment with ${b.doctor_name}</p>
                                    <p class="text-xs text-slate-400">${b.date} at ${b.time}</p>
                                </div>
                                <span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase">${b.status}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderSymptomChecker() {
    tabContent.innerHTML = `
        <div class="max-w-3xl mx-auto space-y-8">
            <header>
                <h1 class="text-3xl font-bold text-slate-900">Symptom Checker</h1>
                <p class="text-slate-500">Our AI engine helps identify potential health issues.</p>
            </header>

            <div class="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl">
                <form id="symptom-form" class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="space-y-2">
                            <label class="text-sm font-semibold text-slate-700">Type of Pain</label>
                            <input type="text" id="pain-type" placeholder="e.g. Sharp, Dull" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 outline-none">
                        </div>
                        <div class="space-y-2">
                            <label class="text-sm font-semibold text-slate-700">Location</label>
                            <input type="text" id="location" placeholder="e.g. Lower Back" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 outline-none">
                        </div>
                        <div class="space-y-2">
                            <label class="text-sm font-semibold text-slate-700">Severity</label>
                            <select id="severity" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 outline-none">
                                <option>Mild</option>
                                <option>Moderate</option>
                                <option>Severe</option>
                            </select>
                        </div>
                        <div class="space-y-2">
                            <label class="text-sm font-semibold text-slate-700">Duration</label>
                            <input type="text" id="duration" placeholder="e.g. 2 days" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 outline-none">
                        </div>
                    </div>
                    <button type="submit" class="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                        <i data-lucide="brain" class="w-5 h-5"></i>
                        Run AI Analysis
                    </button>
                </form>
                <div id="symptom-result" class="mt-8 hidden p-8 bg-white rounded-3xl border border-emerald-100 shadow-lg animate-fade-in">
                    <div class="flex items-center gap-3 mb-6 text-emerald-700 font-bold text-lg">
                        <div class="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                            <i data-lucide="shield-check" class="w-6 h-6"></i>
                        </div>
                        AI Health Assessment
                    </div>
                    <div id="symptom-result-text" class="markdown-body text-slate-700 mb-8 leading-relaxed"></div>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-slate-100">
                        <button onclick="switchTab('ai-help')" class="flex items-center justify-center gap-2 p-4 bg-blue-50 text-blue-700 rounded-2xl font-bold hover:bg-blue-100 transition-all">
                            <i data-lucide="message-square" class="w-5 h-5"></i>
                            Chat with AI Assistant
                        </button>
                        <button onclick="switchTab('doctors')" class="flex items-center justify-center gap-2 p-4 bg-emerald-50 text-emerald-700 rounded-2xl font-bold hover:bg-emerald-100 transition-all">
                            <i data-lucide="user-plus" class="w-5 h-5"></i>
                            Book Specialist Visit
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('symptom-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" class="w-5 h-5 animate-spin"></i> Analyzing...';
        lucide.createIcons();

        const data = {
            pain: document.getElementById('pain-type').value,
            loc: document.getElementById('location').value,
            sev: document.getElementById('severity').value,
            dur: document.getElementById('duration').value
        };

        if (!ai) {
            alert("AI Assistant is not initialized. Please ensure your Gemini API key is set.");
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="brain" class="w-5 h-5"></i> Run AI Analysis';
            lucide.createIcons();
            return;
        }

        try {
            const prompt = `Analyze symptoms: Pain Type: ${data.pain}, Location: ${data.loc}, Severity: ${data.sev}, Duration: ${data.dur}. 
            Provide:
            1. Potential causes (Differential Diagnosis)
            2. Risk level (Low/Medium/High)
            3. Immediate next steps.
            Keep it concise and professional.`;
            
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: prompt
            });
            const text = response.text;

            const resultDiv = document.getElementById('symptom-result');
            const resultText = document.getElementById('symptom-result-text');
            resultDiv.classList.remove('hidden');
            resultText.innerHTML = text.replace(/\n/g, '<br>'); // Simple markdown-ish
        } catch (err) {
            alert("Error analyzing symptoms. Make sure your API key is set.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="brain" class="w-5 h-5"></i> Run AI Analysis';
            lucide.createIcons();
        }
    });
}

function renderAIHelp() {
    tabContent.innerHTML = `
        <div class="max-w-4xl mx-auto h-[calc(100vh-12rem)] flex flex-col">
            <div class="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div class="p-4 border-b bg-slate-50 flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                        <i data-lucide="message-square" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <h2 class="font-semibold">AI Medical Assistant</h2>
                        <p class="text-xs text-blue-600">Online & Ready to Help</p>
                    </div>
                </div>

                <div id="chat-messages" class="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
                    ${state.chatMessages.map((m, i) => `
                        <div class="flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in" style="animation-delay: ${i * 0.1}s">
                            <div class="max-w-[80%] p-4 rounded-2xl shadow-sm ${m.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'}">
                                ${m.text}
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="p-4 border-t">
                    <form id="chat-form" class="flex gap-2">
                        <input type="text" id="chat-input" placeholder="Ask anything about your health..." class="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20">
                        <button type="submit" class="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-700">
                            <i data-lucide="send" class="w-5 h-5"></i>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `;

    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;

        state.chatMessages.push({ role: 'user', text });
        chatInput.value = '';
        renderAIHelp();

        if (!ai) {
            state.chatMessages.push({ role: 'model', text: "AI Assistant is not initialized. Please check your API key configuration." });
            renderAIHelp();
            return;
        }

        try {
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: text
            });
            state.chatMessages.push({ role: 'model', text: response.text });
            renderAIHelp();
            
            // Scroll to bottom
            const msgCont = document.getElementById('chat-messages');
            if (msgCont) msgCont.scrollTop = msgCont.scrollHeight;
        } catch (err) {
            state.chatMessages.push({ role: 'model', text: "Sorry, I encountered an error. Please check your API key." });
            renderAIHelp();
        }
    });
}

function renderDoctors() {
    tabContent.innerHTML = `
        <div class="space-y-8">
            <header class="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 class="text-3xl font-bold text-slate-900">Find a Specialist</h1>
                    <p class="text-slate-500">Book an appointment with top-rated doctors near you.</p>
                </div>
                <div class="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    <button id="view-list" class="px-4 py-2 rounded-lg text-sm font-bold bg-slate-900 text-white">List View</button>
                    <button id="view-map" class="px-4 py-2 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-50">Map View</button>
                </div>
            </header>

            <div id="doctors-container">
                <div id="doctors-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${state.doctors.map(d => `
                        <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group card-hover">
                            <div class="flex items-start justify-between mb-4">
                                <div class="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                                    <i data-lucide="user" class="w-8 h-8"></i>
                                </div>
                                <div class="flex items-center gap-1 bg-orange-50 text-orange-600 px-2 py-1 rounded-lg text-xs font-bold">
                                    <i data-lucide="star" class="w-3 h-3 fill-current"></i>
                                    ${d.rating}
                                </div>
                            </div>
                            <h3 class="text-lg font-bold text-slate-900">${d.name}</h3>
                            <p class="text-emerald-600 text-sm font-semibold mb-2">${d.specialty}</p>
                            <p class="text-slate-400 text-xs flex items-center gap-1 mb-4">
                                <i data-lucide="map-pin" class="w-3 h-3"></i>
                                ${d.location}
                            </p>
                            <div class="flex items-center gap-2 mb-4">
                                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Insurance:</span>
                                <span class="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">${d.insurance.split(',')[0]}</span>
                            </div>
                            <button onclick="bookDoctor(${d.id})" class="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-all active:scale-95">Book Appointment</button>
                        </div>
                    `).join('')}
                </div>
                <div id="doctors-map-container" class="hidden animate-fade-in">
                    <div id="map" class="w-full h-[500px] rounded-3xl border-4 border-white shadow-xl"></div>
                </div>
            </div>
        </div>
    `;

    const btnList = document.getElementById('view-list');
    const btnMap = document.getElementById('view-map');
    const listCont = document.getElementById('doctors-list');
    const mapCont = document.getElementById('doctors-map-container');

    btnList.onclick = () => {
        btnList.className = "px-4 py-2 rounded-lg text-sm font-bold bg-slate-900 text-white";
        btnMap.className = "px-4 py-2 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-50";
        listCont.classList.remove('hidden');
        mapCont.classList.add('hidden');
    };

    btnMap.onclick = () => {
        btnMap.className = "px-4 py-2 rounded-lg text-sm font-bold bg-slate-900 text-white";
        btnList.className = "px-4 py-2 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-50";
        listCont.classList.add('hidden');
        mapCont.classList.remove('hidden');
        initMap();
    };
}

function initMap() {
    if (!window.L) return;
    const map = L.map('map').setView([28.6139, 77.2090], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    state.doctors.forEach(d => {
        if (d.lat && d.lng) {
            const marker = L.marker([d.lat, d.lng]).addTo(map);
            marker.bindPopup(`
                <div class="p-2">
                    <p class="font-bold text-slate-900">${d.name}</p>
                    <p class="text-xs text-emerald-600 font-semibold">${d.specialty}</p>
                    <button onclick="bookDoctor(${d.id})" class="mt-2 w-full py-1 bg-slate-900 text-white text-[10px] rounded font-bold">Book Now</button>
                </div>
            `);
        }
    });
}

window.bookDoctor = async (id) => {
    const date = new Date().toISOString().split('T')[0];
    const time = "10:00 AM";
    await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctor_id: id, date, time })
    });
    alert("Appointment booked successfully!");
    loadData();
};

function renderReports() {
    tabContent.innerHTML = `
        <div class="space-y-8">
            <header class="flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-bold text-slate-900">Medical Reports</h1>
                    <p class="text-slate-500">Manage and analyze your medical documentation.</p>
                </div>
                <button onclick="document.getElementById('report-upload').click()" class="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20">
                    <i data-lucide="plus" class="w-5 h-5"></i>
                    Upload New
                </button>
                <input type="file" id="report-upload" class="hidden" onchange="uploadReport(event)">
            </header>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                ${state.reports.map(r => `
                    <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <div class="flex items-start gap-4 mb-4">
                            <div class="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                                <i data-lucide="file-text" class="w-6 h-6"></i>
                            </div>
                            <div class="flex-1">
                                <h3 class="font-bold text-slate-900">${r.name}</h3>
                                <p class="text-xs text-slate-400">${r.type} • ${r.date}</p>
                            </div>
                        </div>
                        <div class="bg-slate-50 p-4 rounded-2xl mb-4">
                            <p class="text-sm text-slate-600 italic">"${r.summary}"</p>
                        </div>
                        <button class="w-full py-2 text-emerald-600 font-bold text-sm hover:bg-emerald-50 rounded-xl transition-colors">View Details</button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

window.uploadReport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const report = {
        name: file.name,
        type: file.type.split('/')[1].toUpperCase(),
        date: new Date().toISOString().split('T')[0],
        summary: "Processing report...",
        file_path: ""
    };

    await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report)
    });
    loadData();
};

init();
