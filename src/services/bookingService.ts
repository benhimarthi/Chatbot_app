import { GoogleGenAI } from "@google/genai";
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface BookingState {
  type: 'restaurant' | 'hotel' | null;
  collectedData: any;
  missingFields: string[];
  isComplete: boolean;
}

const RESTAURANT_FIELDS = ['name', 'phone', 'date', 'time', 'number_of_guests'];
const HOTEL_FIELDS = ['full_name', 'phone', 'email', 'check_in_date', 'check_out_date', 'number_of_guests', 'number_of_rooms'];

/**
 * Processes user input to extract booking information using Gemini.
 */
export const processBookingIntent = async (
  userMessage: string,
  currentState: BookingState,
  businessContext: string
): Promise<BookingState> => {
  const prompt = `
    You are a professional booking assistant. 
    Business Context: ${businessContext}
    
    Current Booking State:
    Type: ${currentState.type || 'Not determined'}
    Collected Data: ${JSON.stringify(currentState.collectedData)}
    
    User Message: "${userMessage}"
    
    Required Fields for Restaurant: ${RESTAURANT_FIELDS.join(', ')}
    Required Fields for Hotel: ${HOTEL_FIELDS.join(', ')}
    
    Instructions:
    1. If the booking type is unknown, determine if it's a "restaurant" or "hotel" booking.
    2. Extract any new information (names, dates, times, guest counts, etc.) from the user message.
    3. Merge new information with existing collected data.
    4. If a field is already present but the user provides a new value, update it.
    5. Return the updated state.
    
    Return ONLY a JSON object with this structure:
    {
      "type": "restaurant" | "hotel" | null,
      "collectedData": object,
      "missingFields": string[],
      "isComplete": boolean
    }
  `;

  try {
    const result = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
      }
    });
    
    const responseText = result.text;
    const response = JSON.parse(responseText);
    
    // Validate completeness based on our strict field lists
    if (response.type) {
      const required = response.type === 'hotel' ? HOTEL_FIELDS : RESTAURANT_FIELDS;
      const missing = required.filter(field => !response.collectedData[field]);
      
      return {
        ...response,
        missingFields: missing,
        isComplete: missing.length === 0
      };
    }
    
    return response;
  } catch (error) {
    console.error("Booking extraction error:", error);
    return currentState;
  }
};

/**
 * Saves a confirmed booking to Firestore.
 */
export const saveBooking = async (userId: string, type: string, data: any) => {
  try {
    const bookingRef = collection(db, 'bookings');
    const docRef = await addDoc(bookingRef, {
      userId,
      type,
      data,
      status: 'confirmed',
      createdAt: serverTimestamp()
    });
    
    // Create a notification for the business owner
    const notificationRef = collection(db, 'notifications');
    await addDoc(notificationRef, {
      userId,
      title: 'New Booking Confirmed',
      message: `A new ${type} booking has been made by ${data.full_name || data.name}.`,
      type: 'success',
      read: false,
      createdAt: serverTimestamp()
    });

    return docRef.id;
  } catch (error) {
    console.error("Save booking error:", error);
    throw error;
  }
};

/**
 * Validates business constraints (e.g., availability).
 * In a real app, this would query Firestore for existing bookings in the same slot.
 */
export const validateConstraints = async (type: string, data: any): Promise<{ valid: boolean; message?: string }> => {
  // Mock validation for now
  if (type === 'restaurant') {
    const guests = parseInt(data.number_of_guests);
    if (guests > 20) return { valid: false, message: "Sorry, we cannot accommodate groups larger than 20 online." };
  }
  
  if (type === 'hotel') {
    const checkIn = new Date(data.check_in_date);
    const checkOut = new Date(data.check_out_date);
    if (checkOut <= checkIn) return { valid: false, message: "Check-out date must be after check-in date." };
  }

  return { valid: true };
};
