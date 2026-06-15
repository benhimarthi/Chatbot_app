/**
 * ReservationRepository provides the database driver methods for working with Firestore.
 * Abiding by the Dependency Inversion Principle, we pass the Firestore admin database reference into it.
 */
class ReservationRepository {
  constructor(db, adminInstance) {
    this.db = db;
    this.admin = adminInstance;
  }

  /**
   * Retrieves workspace settings / restaurant configuration.
   */
  async findWorkspaceSettings(businessId) {
    const snap = await this.db.collection("workspaces").doc(businessId).get();
    if (snap.exists) {
      return snap.data();
    }
    return null;
  }

  /**
   * Retrieves all reservations for a given business on a specific date.
   */
  async findReservationsByWorkspaceAndDate(businessId, date) {
    const snapshot = await this.db.collection("reservations")
      .where("business_id", "==", businessId)
      .where("date", "==", date)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  /**
   * Saves a new reservation entity to the Firestore reservations collection.
   */
  async saveReservation(reservation) {
    const data = {
      business_id: reservation.business_id,
      guests: reservation.guests,
      date: reservation.date,
      start_time: reservation.start_time,
      end_time: reservation.end_time,
      status: reservation.status,
      customer_name: reservation.customer_name,
      customer_phone: reservation.customer_phone,
      created_at: this.admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await this.db.collection("reservations").add(data);
    return docRef.id;
  }

  /**
   * Retrieves a single reservation.
   */
  async findReservationById(reservationId) {
    const snap = await this.db.collection("reservations").doc(reservationId).get();
    if (snap.exists) {
      return { id: snap.id, ...snap.data() };
    }
    return null;
  }

  /**
   * Updates an existing reservation document.
   */
  async updateReservation(reservationId, updateData) {
    await this.db.collection("reservations").doc(reservationId).update(updateData);
    return true;
  }

  /**
   * Deletes a reservation document.
   */
  async deleteReservation(reservationId) {
    await this.db.collection("reservations").doc(reservationId).delete();
    return true;
  }

  /**
   * Upserts the customer information inside the workspace/business customer directory.
   */
  async upsertCustomer(businessId, name, phone) {
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const customerId = `cust_${cleanPhone}`;
      const customerRef = this.db.collection("users").doc(businessId).collection("customers").doc(customerId);
      const snap = await customerRef.get();

      if (snap.exists) {
        const existingData = snap.data() || {};
        await customerRef.update({
          name: name,
          totalBookings: this.admin.firestore.FieldValue.increment(1),
          lastBookingAt: this.admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        await customerRef.set({
          userId: businessId,
          name: name,
          phone: phone,
          email: '',
          totalBookings: 1,
          lastBookingAt: this.admin.firestore.FieldValue.serverTimestamp(),
          createdAt: this.admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (err) {
      console.error("[ReservationRepository] Failed to upsert customer telemetry:", err.message);
    }
  }
}

module.exports = ReservationRepository;
