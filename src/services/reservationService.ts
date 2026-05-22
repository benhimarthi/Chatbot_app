import { GoogleGenAI, Type } from "@google/genai";
import { Reservation, ReservationDraft, ReservationState, ReservationStep, RestaurantConfig } from "../types";
import { getReservationsInRange } from "../firebase";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

/**
 * Extracts reservation details from the user's message using AI.
 */
export const extractReservationDetails = async (message: string, currentDraft: ReservationDraft): Promise<Partial<ReservationDraft>> => {
  const prompt = `
    Extract reservation details from the following user message. 
    Only extract fields that are clearly present. 
    
    User Message: "${message}"
    Current Context: ${JSON.stringify(currentDraft)}
    
    Fields to extract:
    - guests (number)
    - date (YYYY-MM-DD) - handle relative dates like "today", "tomorrow", "next Friday" relative to today: ${new Date().toISOString().split('T')[0]}
    - time (HH:mm)
    - name (string)
    - phone (string)
    
    Return a JSON object with any extracted fields. If a field is not found, do not include it.
  `;

  try {
    const result = await genAI.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
      }
    });

    return JSON.parse(result.text || "{}");
  } catch (e) {
    console.error("Extraction failed", e);
    return {};
  }
};

/**
 * Validates a specific value based on restaurant configuration.
 */
export const validateReservationField = (field: keyof ReservationDraft, value: any, config: RestaurantConfig): { valid: boolean; message?: string } => {
  if (value === null) return { valid: true };

  switch (field) {
    case 'guests':
      const guests = Number(value);
      if (isNaN(guests) || guests <= 0) return { valid: false, message: "Please provide a valid number of guests." };
      if (guests > config.capacity) return { valid: false, message: `Sorry, our maximum capacity is ${config.capacity} guests.` };
      return { valid: true };
    case 'date':
      const date = new Date(value);
      if (isNaN(date.getTime())) return { valid: false, message: "Please provide a valid date." };
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) return { valid: false, message: "We can only take reservations for today or future dates." };
      return { valid: true };
    case 'time':
      // Time is HH:mm
      const [hours, minutes] = value.split(':').map(Number);
      const timeVal = hours * 60 + minutes;
      const [startH, startM] = config.openingHours.start.split(':').map(Number);
      const [endH, endM] = config.openingHours.end.split(':').map(Number);
      const startVal = startH * 60 + startM;
      const endVal = endH * 60 + endM;
      
      if (timeVal < startVal || timeVal > endVal) {
        return { valid: false, message: `We are only open between ${config.openingHours.start} and ${config.openingHours.end}.` };
      }
      
      // End time check (start + duration)
      if (timeVal + config.reservationDuration > endVal) {
        return { valid: false, message: `That might be a bit late as we close at ${config.openingHours.end}. The latest slot is ${Math.floor((endVal - config.reservationDuration) / 60)}:${(endVal - config.reservationDuration) % 60}.` };
      }
      return { valid: true };
    default:
      return { valid: true };
  }
};

/**
 * Checks overall availability for a given time and guest count.
 */
export const checkAvailability = async (
  businessId: string, 
  guests: number, 
  date: string, 
  startTime: string, 
  config: RestaurantConfig
): Promise<{ available: boolean; remaining: number }> => {
  const [h, m] = startTime.split(':').map(Number);
  const start = h * 60 + m;
  const end = start + config.reservationDuration;

  const existingBookings = await getReservationsInRange(businessId, date, startTime, "");
  
  // Overlap condition: (existing.start < new.end) AND (existing.end > new.start)
  const overlapping = existingBookings.filter((booking: any) => {
    const [bh, bm] = booking.start_time.split(':').map(Number);
    const [beh, bem] = booking.end_time.split(':').map(Number);
    const bStart = bh * 60 + bm;
    const bEnd = beh * 60 + bem;
    
    return bStart < end && bEnd > start;
  });

  const usedCapacity = overlapping.reduce((sum: number, b: any) => sum + (Number(b.guests) || 0), 0);
  const remaining = config.capacity - usedCapacity;

  return {
    available: remaining >= guests,
    remaining
  };
};

/**
 * Suggests alternative times if the requested one is unavailable.
 */
export const suggestAlternatives = async (
  businessId: string,
  guests: number,
  date: string,
  requestedTime: string,
  config: RestaurantConfig
): Promise<string[]> => {
  const alternatives: string[] = [];
  const [rh, rm] = requestedTime.split(':').map(Number);
  const requestedVal = rh * 60 + rm;

  // Check 30 min intervals
  const [startH, startM] = config.openingHours.start.split(':').map(Number);
  const [endH, endM] = config.openingHours.end.split(':').map(Number);
  const currentStart = startH * 60 + startM;
  const currentEnd = endH * 60 + endM;

  for (let time = currentStart; time <= currentEnd - config.reservationDuration; time += 30) {
    if (Math.abs(time - requestedVal) < 180 && time !== requestedVal) { // within 3 hours
      const hh = Math.floor(time / 60).toString().padStart(2, '0');
      const mm = (time % 60).toString().padStart(2, '0');
      const slotStr = `${hh}:${mm}`;
      const availability = await checkAvailability(businessId, guests, date, slotStr, config);
      if (availability.available) {
        alternatives.push(slotStr);
      }
    }
    if (alternatives.length >= 3) break;
  }

  return alternatives;
};

/**
 * Determines the next step in the reservation flow.
 */
export const getNextStep = (draft: ReservationDraft): ReservationStep => {
  if (draft.guests === null) return "ask_guests";
  if (!draft.date) return "ask_date";
  if (!draft.time) return "ask_time";
  if (!draft.name) return "ask_name";
  if (!draft.phone) return "ask_phone";
  return "confirm";
};

/**
 * Detects if the user wants to start a reservation.
 */
export const detectBookingIntent = async (message: string): Promise<boolean> => {
  const prompt = `
    Does the following message express an intent to make a restaurant reservation or book a table?
    Message: "${message}"
    
    Respond only with "true" or "false".
  `;
  
  try {
    const result = await genAI.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return (result.text || "").toLowerCase().includes("true");
  } catch (e) {
    return /book|reserve|table|reservation/i.test(message);
  }
};
