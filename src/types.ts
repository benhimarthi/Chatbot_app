export interface Plan {
  id: "free" | "pro";
  name: string;
  max_messages_per_month: number;
  max_bookings_per_month: number;
  booking_enabled: boolean;
}

export interface CustomLimits {
  max_messages_per_month?: number;
  max_bookings_per_month?: number;
}

export const PLANS: Record<string, Plan> = {
  free: {
    id: "free",
    name: "Free",
    max_messages_per_month: 200,
    max_bookings_per_month: 20,
    booking_enabled: true,
  },
  pro: {
    id: "pro",
    name: "Pro",
    max_messages_per_month: 5000,
    max_bookings_per_month: 1000,
    booking_enabled: true,
  },
};

export interface Usage {
  messages_this_month: number;
  bookings_this_month: number;
  documents_count?: number;
  current_period_start: any; // Timestamp
}

export interface UserSettings {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  businessName: string;
  customInstructions: string;
  apiKey: string;
  subscriptionPlan: "free" | "pro";
  usage: Usage;
  bookingEnabled: boolean;
  chatbotEnabled: boolean;
  isChatbotBlocked: boolean;
  isApiAccessBlocked: boolean;
  customLimits?: CustomLimits;
  upgrade_requested?: boolean;
  createdAt: any;
  lastActiveAt?: any;
  capacity?: number;
  reservationDuration?: number;
  openingHours?: {
    start: string;
    end: string;
  };
}

export interface Reservation {
  id?: string;
  business_id: string;
  guests: number;
  date: string; // ISO Date YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  status: "confirmed";
  customer_name: string;
  customer_phone: string;
  created_at?: any;
}

export interface RestaurantConfig {
  bookingEnabled: boolean;
  capacity: number;
  reservationDuration: number; // in minutes
  openingHours: {
    start: string; // HH:mm
    end: string; // HH:mm
  };
}

export interface ReservationDraft {
  guests: number | null;
  date: string | null;
  time: string | null;
  name: string | null;
  phone: string | null;
}

export type ReservationStep = 
  | "ask_guests" 
  | "ask_date" 
  | "ask_time" 
  | "ask_name" 
  | "ask_phone" 
  | "confirm"
  | "completed";

export interface ReservationState {
  step: ReservationStep;
  data: ReservationDraft;
  isActive: boolean;
}

export interface Customer {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email?: string;
  totalBookings: number;
  lastBookingAt: any;
  createdAt: any;
}

export interface AppLog {
  id: string;
  type: string;
  message: string;
  metadata?: any;
  createdAt: any;
}
