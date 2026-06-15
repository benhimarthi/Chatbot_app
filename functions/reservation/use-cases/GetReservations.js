/**
 * Use case for listing and searching reservations under a workspace.
 */
class GetReservations {
  constructor(reservationRepository) {
    this.repository = reservationRepository;
  }

  async execute({ business_id, date, customer_phone }) {
    if (!business_id) {
      throw new Error("Business ID is required to get reservations.");
    }

    if (date) {
      // Query specific date via repository
      const reservations = await this.repository.findReservationsByWorkspaceAndDate(business_id, date);
      if (customer_phone) {
        const cleanPhone = customer_phone.replace(/\D/g, '');
        return reservations.filter(r => r.customer_phone.replace(/\D/g, '').includes(cleanPhone));
      }
      return reservations;
    }

    // No date specified: retrieve all reservations under standard workspace limit
    const snapshot = await this.repository.db.collection("reservations")
      .where("business_id", "==", business_id)
      .orderBy("created_at", "desc")
      .limit(100)
      .get();

    let list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (customer_phone) {
      const cleanPhone = customer_phone.replace(/\D/g, '');
      list = list.filter(r => r.customer_phone.replace(/\D/g, '').includes(cleanPhone));
    }

    return list;
  }

  async getById(reservationId) {
    const res = await this.repository.findReservationById(reservationId);
    if (!res) {
      throw new Error(`Reservation not found with ID: ${reservationId}`);
    }
    return res;
  }
}

module.exports = GetReservations;
