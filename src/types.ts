export interface Doctor {
  id: number;
  name: string;
  specialty: string;
  location: string;
  rating: number;
  availability: string;
  lat: number;
  lng: number;
  insurance: string;
  reviews_count: number;
  next_available: string;
  distance?: number;
}

export interface Report {
  id: number;
  name: string;
  type: string;
  date: string;
  summary: string;
  file_path: string;
}

export interface Booking {
  id: number;
  doctor_id: number;
  doctor_name: string;
  specialty: string;
  date: string;
  time: string;
  status: string;
}
