import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Calendar, 
  FileText, 
  User, 
  Search, 
  Plus, 
  Upload, 
  MessageSquare, 
  Clock, 
  MapPin, 
  Star,
  ChevronRight,
  Stethoscope,
  AlertCircle,
  X,
  CheckCircle2,
  Brain,
  Filter,
  Map as MapIcon,
  List as ListIcon,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { analyzeSymptoms, analyzeReport, askAIHelp } from './services/geminiService';
import { Doctor, Report, Booking } from './types';
import { cn, fileToBase64, calculateDistance } from './lib/utils';

// Fix Leaflet icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'symptom-checker' | 'ai-help' | 'doctors' | 'reports' | 'admin'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  
  // New States
  const [currentUser, setCurrentUser] = useState<{ email: string, name: string, role: string } | null>(null);
  const [showConfirmation, setShowConfirmation] = useState<{ doctor: Doctor, date: string, time: string } | null>(null);
  const [adminStats, setAdminStats] = useState<{ totalBookings: number, totalPatients: number, recentBookings: any[] } | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    specialty: '',
    minRating: 0,
    insurance: '',
    availability: 'any'
  });

  // Symptom Checker State (ML Simulation)
  const [symptomForm, setSymptomForm] = useState({
    painType: '',
    severity: 'Mild',
    duration: '',
    location: ''
  });
  const [symptomResult, setSymptomResult] = useState<string | null>(null);

  // AI Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Report Upload State
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reportAnalysis, setReportAnalysis] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    getUserLocation();
  }, []);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          // Default to Delhi if location is denied
          setUserLocation({ lat: 28.6139, lng: 77.2090 });
        }
      );
    } else {
      // Default to Delhi
      setUserLocation({ lat: 28.6139, lng: 77.2090 });
    }
  };

  useEffect(() => {
    let result = [...doctors];

    if (userLocation) {
      result = result.map(doc => ({
        ...doc,
        distance: calculateDistance(userLocation.lat, userLocation.lng, doc.lat, doc.lng)
      })).sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }

    if (filters.specialty) {
      result = result.filter(d => d.specialty.toLowerCase().includes(filters.specialty.toLowerCase()));
    }
    if (filters.minRating > 0) {
      result = result.filter(d => d.rating >= filters.minRating);
    }
    if (filters.insurance) {
      result = result.filter(d => d.insurance.toLowerCase().includes(filters.insurance.toLowerCase()));
    }
    if (filters.availability === 'today') {
      const today = new Date().toISOString().split('T')[0];
      result = result.filter(d => d.next_available === today);
    }

    setFilteredDoctors(result);
  }, [userLocation, doctors, filters]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const fetchData = async () => {
    try {
      const [docsRes, reportsRes, bookingsRes, adminRes] = await Promise.all([
        fetch('/api/doctors'),
        fetch('/api/reports'),
        fetch('/api/bookings'),
        fetch('/api/admin/stats')
      ]);
      const docs = await docsRes.json();
      setDoctors(docs);
      setReports(await reportsRes.json());
      setBookings(await bookingsRes.json());
      setAdminStats(await adminRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleStructuredSymptomCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const prompt = `Patient reports ${symptomForm.severity} ${symptomForm.painType} pain in the ${symptomForm.location} for ${symptomForm.duration}. Provide a structured assessment.`;
      const aiResponse = await analyzeSymptoms(prompt);
      setSymptomResult(aiResponse);
    } catch (error) {
      setSymptomResult('Error analyzing symptoms.');
    } finally {
      setLoading(false);
    }
  };

  const handleSymptomCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const aiResponse = await askAIHelp(userMsg);
      setChatHistory(prev => [...prev, { role: 'ai', text: aiResponse || 'Sorry, I could not analyze that.' }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'ai', text: 'Error connecting to AI service.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setUploading(true);

    try {
      const base64 = await fileToBase64(file);
      const analysis = await analyzeReport(base64, file.type);
      setReportAnalysis(analysis || 'No analysis available.');
      
      // Save to DB
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          type: file.type.split('/')[1].toUpperCase(),
          date: new Date().toISOString().split('T')[0],
          summary: analysis,
          file_path: base64 // In a real app, this would be a URL
        })
      });
      fetchData();
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleOnboard = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get('email') as string,
      name: formData.get('name') as string,
      role: formData.get('role') as string
    };

    setLoading(true);
    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const user = await res.json();
      setCurrentUser(user);
      fetchData();
      if (user.role === 'owner') setActiveTab('admin');
    } catch (error) {
      console.error('Onboarding error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookDoctor = async (doctorId: number) => {
    const doctor = doctors.find(d => d.id === doctorId);
    if (!doctor) return;

    const date = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const time = '10:00 AM';

    try {
      await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_id: doctorId,
          date,
          time
        })
      });
      fetchData();
      setShowConfirmation({ doctor, date, time });
    } catch (error) {
      console.error('Booking error:', error);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white w-full max-w-md p-8 rounded-3xl shadow-xl border border-slate-200"
        >
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
              <Activity className="w-10 h-10" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-slate-900">Welcome to Health Mate</h1>
              <p className="text-slate-500 flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                Real-time connection active
              </p>
            </div>
          </div>

          <form onSubmit={handleOnboard} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Full Name</label>
              <input 
                name="name"
                type="text" 
                placeholder="John Doe"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Email Address</label>
              <input 
                name="email"
                type="email" 
                placeholder="john@example.com"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">I am a...</label>
              <select 
                name="role"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              >
                <option value="patient">Patient</option>
                <option value="owner">Health Center Owner</option>
              </select>
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Get Started"}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F8FAFC]">
      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmation && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Booking Confirmed!</h2>
                  <p className="text-slate-500">Your appointment has been successfully scheduled.</p>
                </div>

                <div className="w-full bg-slate-50 rounded-2xl p-6 space-y-4 text-left">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Doctor</p>
                      <p className="font-semibold text-slate-900">{showConfirmation.doctor.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Date & Time</p>
                      <p className="font-semibold text-slate-900">{showConfirmation.date} at {showConfirmation.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Location</p>
                      <p className="font-semibold text-slate-900">{showConfirmation.doctor.location}</p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setShowConfirmation(null)}
                  className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2 text-emerald-600 font-bold text-lg">
          <Activity className="w-6 h-6" />
          <span>Health Mate</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-600">
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <nav className={cn(
        "fixed inset-0 z-40 bg-white md:relative md:z-0 md:flex md:w-64 border-r border-slate-200 p-6 flex-col gap-8 transition-transform duration-300 md:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="hidden md:flex items-center gap-2 text-emerald-600 font-bold text-xl">
          <Activity className="w-8 h-8" />
          <span>Health Mate</span>
        </div>

        <div className="flex flex-col gap-2">
          <NavItem 
            icon={<Activity className="w-5 h-5" />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} 
          />
          <NavItem 
            icon={<Brain className="w-5 h-5" />} 
            label="Symptom Checker" 
            active={activeTab === 'symptom-checker'} 
            onClick={() => { setActiveTab('symptom-checker'); setIsMobileMenuOpen(false); }} 
          />
          <NavItem 
            icon={<MessageSquare className="w-5 h-5" />} 
            label="AI Help" 
            active={activeTab === 'ai-help'} 
            onClick={() => { setActiveTab('ai-help'); setIsMobileMenuOpen(false); }} 
          />
          <NavItem 
            icon={<Stethoscope className="w-5 h-5" />} 
            label="Find Doctors" 
            active={activeTab === 'doctors'} 
            onClick={() => { setActiveTab('doctors'); setIsMobileMenuOpen(false); }} 
          />
          <NavItem 
            icon={<FileText className="w-5 h-5" />} 
            label="Medical Reports" 
            active={activeTab === 'reports'} 
            onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }} 
          />
          {currentUser.role === 'owner' && (
            <NavItem 
              icon={<ShieldCheck className="w-5 h-5" />} 
              label="Admin Panel" 
              active={activeTab === 'admin'} 
              onClick={() => { setActiveTab('admin'); setIsMobileMenuOpen(false); }} 
            />
          )}
        </div>

        <div className="mt-auto p-4 bg-emerald-50 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <User className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-900">{currentUser.name}</p>
              <p className="text-xs text-emerald-600 capitalize">{currentUser.role}</p>
            </div>
          </div>
          <button 
            onClick={() => setCurrentUser(null)}
            className="w-full mt-2 text-xs font-bold text-emerald-700 hover:text-emerald-900 uppercase tracking-widest"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-5xl mx-auto space-y-8"
            >
              <header>
                <h1 className="text-3xl font-bold text-slate-900">Welcome back, {currentUser.name}</h1>
                <p className="text-slate-500">Here's an overview of your health status.</p>
              </header>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <StatCard title="Upcoming Appointments" value={bookings.length.toString()} icon={<Calendar className="text-blue-500" />} />
                <StatCard title="Medical Reports" value={reports.length.toString()} icon={<FileText className="text-emerald-500" />} />
                <StatCard title="Health Score" value="92/100" icon={<Activity className="text-orange-500" />} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-slate-400" />
                      Recent Bookings
                    </h2>
                    <div className="space-y-4">
                      {bookings.slice(0, 3).map(booking => (
                        <div key={booking.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                          <div>
                            <p className="font-medium">{booking.doctor_name}</p>
                            <p className="text-sm text-slate-500">{booking.specialty}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{booking.date}</p>
                            <p className="text-xs text-slate-400">{booking.time}</p>
                          </div>
                        </div>
                      ))}
                      {bookings.length === 0 && <p className="text-slate-400 text-center py-4">No recent bookings.</p>}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-slate-400" />
                      Latest Reports
                    </h2>
                    <div className="space-y-4">
                      {reports.slice(0, 3).map(report => (
                        <div key={report.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-slate-200">
                            <FileText className="w-5 h-5 text-emerald-500" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{report.name}</p>
                            <p className="text-xs text-slate-400">{report.date} • {report.type}</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300" />
                        </div>
                      ))}
                      {reports.length === 0 && <p className="text-slate-400 text-center py-4">No reports uploaded yet.</p>}
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  {!userLocation && (
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-3 text-slate-400 mb-4">
                        <MapPin className="w-6 h-6" />
                        <h2 className="font-bold">Nearest Doctor</h2>
                      </div>
                      <p className="text-sm text-slate-500 mb-4">Enable location to see the closest medical help.</p>
                      <button 
                        onClick={getUserLocation}
                        className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                      >
                        Enable Location
                      </button>
                    </div>
                  )}
                  {userLocation && doctors.length > 0 && (
                    <div className="bg-emerald-600 p-6 rounded-3xl text-white shadow-xl shadow-emerald-600/20">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold">Nearest Doctor</h2>
                        <MapPin className="w-5 h-5 opacity-50" />
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                            <User className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-bold text-lg">{doctors[0].name}</p>
                            <p className="text-emerald-100 text-sm">{doctors[0].specialty}</p>
                          </div>
                        </div>
                        <div className="pt-4 border-t border-white/10 space-y-2">
                          <p className="text-sm flex items-center gap-2 text-emerald-50">
                            <MapPin className="w-4 h-4" />
                            {doctors[0].location}
                          </p>
                          <p className="text-xs font-bold uppercase tracking-widest text-emerald-200">
                            {doctors[0].distance?.toFixed(1)} KM FROM YOU
                          </p>
                        </div>
                        <button 
                          onClick={() => setActiveTab('doctors')}
                          className="w-full py-3 bg-white text-emerald-600 rounded-xl font-bold text-sm hover:bg-emerald-50 transition-colors mt-2"
                        >
                          Book Now
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'symptom-checker' && (
            <motion.div 
              key="symptom-checker"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-3xl mx-auto space-y-8"
            >
              <header>
                <h1 className="text-3xl font-bold text-slate-900">Symptom Checker</h1>
                <p className="text-slate-500">Our ML-driven engine helps identify potential health issues.</p>
              </header>

              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
                <form onSubmit={handleStructuredSymptomCheck} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Type of Pain</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Sharp, Dull, Throbbing"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                        value={symptomForm.painType}
                        onChange={e => setSymptomForm({...symptomForm, painType: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Location</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Lower Back, Chest, Head"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                        value={symptomForm.location}
                        onChange={e => setSymptomForm({...symptomForm, location: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Severity</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                        value={symptomForm.severity}
                        onChange={e => setSymptomForm({...symptomForm, severity: e.target.value})}
                      >
                        <option>Mild</option>
                        <option>Moderate</option>
                        <option>Severe</option>
                        <option>Unbearable</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Duration (From when?)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 2 days ago, 1 week"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                        value={symptomForm.duration}
                        onChange={e => setSymptomForm({...symptomForm, duration: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Activity className="w-5 h-5" />
                        Analyze Symptoms
                      </>
                    )}
                  </button>
                </form>

                <AnimatePresence>
                  {symptomResult && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-8 p-6 bg-emerald-50 rounded-2xl border border-emerald-100 relative"
                    >
                      <button 
                        onClick={() => setSymptomResult(null)}
                        className="absolute top-4 right-4 text-emerald-400 hover:text-emerald-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                      <div className="flex items-center gap-2 mb-4 text-emerald-700 font-bold">
                        <CheckCircle2 className="w-5 h-5" />
                        ML Assessment Result
                      </div>
                      <div className="markdown-body">
                        <Markdown>{symptomResult}</Markdown>
                      </div>
                      <div className="mt-6 pt-6 border-t border-emerald-100 flex flex-col sm:flex-row gap-3">
                        <button 
                          onClick={() => setActiveTab('doctors')}
                          className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <MapPin className="w-4 h-4" />
                          Find Nearest Specialist
                        </button>
                        <button 
                          onClick={() => setActiveTab('ai-help')}
                          className="flex-1 bg-white text-emerald-600 border border-emerald-200 py-3 rounded-xl font-bold text-sm hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Ask AI Follow-up
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {activeTab === 'ai-help' && (
            <motion.div 
              key="ai-help"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)] flex flex-col"
            >
              <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-bottom bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="font-semibold">AI Medical Assistant</h2>
                      <p className="text-xs text-blue-600 flex items-center gap-1">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                        Advanced AI Help
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {chatHistory.length === 0 && (
                    <div className="text-center py-12 space-y-4">
                      <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                        <MessageSquare className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-semibold">How are you feeling today?</h3>
                      <p className="text-slate-500 max-w-sm mx-auto">Describe your symptoms in detail. For example: "I have a sharp pain in my lower back that radiates to my leg."</p>
                    </div>
                  )}
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[80%] p-4 rounded-2xl",
                        msg.role === 'user' ? "bg-emerald-600 text-white rounded-tr-none" : "bg-slate-100 text-slate-900 rounded-tl-none"
                      )}>
                        <div className="markdown-body">
                          <Markdown>{msg.text}</Markdown>
                        </div>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none flex gap-2">
                        <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                        <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleSymptomCheck} className="p-4 border-t border-slate-100 bg-white">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Describe your symptoms..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                    <button 
                      disabled={loading || !chatInput.trim()}
                      className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-6 h-6 rotate-45" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 text-center uppercase tracking-wider font-medium">
                    AI can make mistakes. Consult a doctor for medical advice.
                  </p>
                </form>
              </div>
            </motion.div>
          )}

          {activeTab === 'doctors' && (
            <motion.div 
              key="doctors"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-6xl mx-auto space-y-6"
            >
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">Find a Specialist</h1>
                  <p className="text-slate-500">Book an appointment with top-rated doctors in Delhi.</p>
                </div>
                <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                  <button 
                    onClick={() => setViewMode('list')}
                    className={cn("p-2 rounded-lg transition-all", viewMode === 'list' ? "bg-emerald-600 text-white" : "text-slate-400 hover:bg-slate-50")}
                  >
                    <ListIcon className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setViewMode('map')}
                    className={cn("p-2 rounded-lg transition-all", viewMode === 'map' ? "bg-emerald-600 text-white" : "text-slate-400 hover:bg-slate-50")}
                  >
                    <MapIcon className="w-5 h-5" />
                  </button>
                </div>
              </header>

              {/* Filters */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Specialty..." 
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={filters.specialty}
                    onChange={e => setFilters({...filters, specialty: e.target.value})}
                  />
                </div>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Insurance..." 
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={filters.insurance}
                    onChange={e => setFilters({...filters, insurance: e.target.value})}
                  />
                </div>
                <select 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={filters.minRating}
                  onChange={e => setFilters({...filters, minRating: Number(e.target.value)})}
                >
                  <option value="0">Any Rating</option>
                  <option value="4">4.0+ Stars</option>
                  <option value="4.5">4.5+ Stars</option>
                </select>
                <select 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={filters.availability}
                  onChange={e => setFilters({...filters, availability: e.target.value})}
                >
                  <option value="any">Any Availability</option>
                  <option value="today">Available Today</option>
                </select>
              </div>

              {!userLocation && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-amber-800">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  <p className="text-sm font-medium">Enable location access to find doctors nearest to you in Delhi.</p>
                  <button 
                    onClick={getUserLocation}
                    className="ml-auto text-xs font-bold uppercase tracking-wider bg-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-300 transition-colors"
                  >
                    Allow Access
                  </button>
                </div>
              )}

              {viewMode === 'list' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {filteredDoctors.map((doctor, index) => (
                    <div key={doctor.id} className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group flex flex-col">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                          <User className="w-8 h-8" />
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-1 bg-orange-50 text-orange-600 px-2 py-1 rounded-lg text-xs font-bold">
                            <Star className="w-3 h-3 fill-current" />
                            {doctor.rating}
                          </div>
                          {doctor.distance !== undefined && (
                            <div className="flex flex-col items-end gap-1">
                              {index === 0 && (
                                <span className="bg-emerald-100 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  Nearest
                                </span>
                              )}
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                {doctor.distance.toFixed(1)} km away
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <h3 className="font-bold text-lg">{doctor.name}</h3>
                      <p className="text-emerald-600 text-sm font-medium mb-2">{doctor.specialty}</p>
                      
                      <div className="space-y-2 mb-4 flex-1">
                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                          <MapPin className="w-4 h-4" />
                          {doctor.location}
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                          <ShieldCheck className="w-4 h-4" />
                          <span className="truncate">{doctor.insurance}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                          <MessageSquare className="w-4 h-4" />
                          {doctor.reviews_count} Patient Reviews
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 mt-auto">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-bold text-slate-400 uppercase">Next Available</span>
                          <span className="text-xs font-bold text-emerald-600">{doctor.next_available}</span>
                        </div>
                        <button 
                          onClick={() => handleBookDoctor(doctor.id)}
                          className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors"
                        >
                          Book Appointment
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[600px] rounded-3xl overflow-hidden border border-slate-200 shadow-lg z-0">
                  <MapContainer center={userLocation || [28.6139, 77.2090]} zoom={12} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {userLocation && (
                      <Marker position={[userLocation.lat, userLocation.lng]}>
                        <Popup>Your Location (Delhi)</Popup>
                      </Marker>
                    )}
                    {filteredDoctors.map(doctor => (
                      <Marker key={doctor.id} position={[doctor.lat, doctor.lng]}>
                        <Popup>
                          <div className="p-1">
                            <p className="font-bold text-slate-900">{doctor.name}</p>
                            <p className="text-xs text-emerald-600 font-medium">{doctor.specialty}</p>
                            <p className="text-[10px] text-slate-500 mt-1">{doctor.location}</p>
                            <button 
                              onClick={() => handleBookDoctor(doctor.id)}
                              className="w-full mt-2 py-1 bg-slate-900 text-white text-[10px] rounded font-bold"
                            >
                              Book Now
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                    <MapUpdater center={userLocation || [28.6139, 77.2090]} />
                  </MapContainer>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div 
              key="reports"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-5xl mx-auto space-y-8"
            >
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">Medical Reports</h1>
                  <p className="text-slate-500">Securely store and analyze your medical documents.</p>
                </div>
                <label className="cursor-pointer bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload Report
                  <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,application/pdf" />
                </label>
              </header>

              {uploading && (
                <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl flex items-center gap-4 animate-pulse">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                    <Brain className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-emerald-900">Analyzing your report...</h3>
                    <p className="text-sm text-emerald-600">Our AI is extracting key insights from your document.</p>
                  </div>
                </div>
              )}

              <AnimatePresence>
                {reportAnalysis && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-white border border-emerald-200 p-6 rounded-2xl shadow-sm relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                    <button 
                      onClick={() => setReportAnalysis(null)}
                      className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2 mb-4 text-emerald-600">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-bold uppercase tracking-wider text-xs">AI Analysis Complete</span>
                    </div>
                    <div className="markdown-body">
                      <Markdown>{reportAnalysis}</Markdown>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600">Report Name</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600">Type</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600">Date</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reports.map(report => (
                      <tr key={report.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors">
                              <FileText className="w-4 h-4" />
                            </div>
                            <span className="font-medium">{report.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{report.type}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{report.date}</td>
                        <td className="px-6 py-4">
                          <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                            Analyzed
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => setReportAnalysis(report.summary)}
                            className="text-emerald-600 hover:text-emerald-700 text-sm font-semibold"
                          >
                            View Analysis
                          </button>
                        </td>
                      </tr>
                    ))}
                    {reports.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                          No reports found. Upload your first report to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
          {activeTab === 'admin' && currentUser.role === 'owner' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-6xl mx-auto space-y-8"
            >
              <header>
                <h1 className="text-3xl font-bold text-slate-900">Health Center Admin</h1>
                <p className="text-slate-500">Overview of all center activities and bookings.</p>
              </header>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Bookings" value={adminStats?.totalBookings.toString() || "0"} icon={<Calendar className="text-blue-500" />} />
                <StatCard title="Active Patients" value={adminStats?.totalPatients.toString() || "0"} icon={<User className="text-emerald-500" />} />
                <StatCard title="Revenue (Est)" value="₹45,200" icon={<Activity className="text-orange-500" />} />
                <StatCard title="Center Rating" value="4.8/5" icon={<Star className="text-yellow-500" />} />
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Recent Appointments</h2>
                  <button className="text-emerald-600 font-bold text-sm">View All</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Patient</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Doctor</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Date/Time</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adminStats?.recentBookings.map(b => (
                        <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                                <User className="w-4 h-4" />
                              </div>
                              <span className="font-medium">Patient #{b.id + 100}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium">{b.doctor_name}</p>
                            <p className="text-xs text-slate-400">{b.specialty}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium">{b.date}</p>
                            <p className="text-xs text-slate-400">{b.time}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase">
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function MapUpdater({ center }: { center: [number, number] | { lat: number, lng: number } }) {
  const map = useMap();
  useEffect(() => {
    if (Array.isArray(center)) {
      map.setView(center, 12);
    } else {
      map.setView([center.lat, center.lng], 12);
    }
  }, [center, map]);
  return null;
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
        active 
          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" 
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

function StatCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-500 text-sm font-medium">{title}</span>
        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
