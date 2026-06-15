/**
 * ReservationController manages parsing HTTP parameters and translating them to Use Cases
 */
class ReservationController {
  constructor({ createReservation, getReservations, updateReservation, deleteReservation }) {
    this.createReservation = createReservation;
    this.getReservations = getReservations;
    this.updateReservation = updateReservation;
    this.deleteReservation = deleteReservation;
  }

  /**
   * Dispatches the incoming requests
   */
  async handle(req, res) {
    // Cross-origin headers
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
      return res.status(204).send("");
    }

    try {
      const urlParts = req.path.split("/").filter(Boolean);
      // Path format can be:
      // GET / -> list reservations (expects business_id in query)
      // GET /:id -> get single reservation
      // POST / -> create reservation
      // PUT /:id -> update reservation
      // DELETE /:id -> delete reservation

      const method = req.method;

      if (method === "POST" && urlParts.length === 0) {
        return this.handleCreate(req, res);
      }

      if (method === "GET") {
        if (urlParts.length === 0) {
          return this.handleList(req, res);
        } else if (urlParts.length === 1) {
          return this.handleGetById(urlParts[0], req, res);
        }
      }

      if (method === "PUT" && urlParts.length === 1) {
        return this.handleUpdate(urlParts[0], req, res);
      }

      if (method === "DELETE" && urlParts.length === 1) {
        return this.handleDelete(urlParts[0], req, res);
      }

      return res.status(404).json({ error: `Not Found: ${method} ${req.path}` });
    } catch (err) {
      console.error("[ReservationController] Unexpected route handling error:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }

  async handleCreate(req, res) {
    const { business_id, guests, date, start_time, customer_name, customer_phone } = req.body || {};

    if (!business_id || !guests || !date || !start_time || !customer_name || !customer_phone) {
      return res.status(400).json({
        error: "Missing parameters. Required fields: 'business_id', 'guests', 'date', 'start_time', 'customer_name', 'customer_phone'."
      });
    }

    try {
      const result = await this.createReservation.execute({
        business_id,
        guests,
        date,
        start_time,
        customer_name,
        customer_phone
      });
      return res.status(201).json(result);
    } catch (err) {
      if (err.code === "CAPACITY_EXCEEDED") {
        return res.status(409).json({
          error: err.message,
          code: err.code,
          alternatives: err.alternatives,
          remaining: err.remaining
        });
      }
      return res.status(400).json({ error: err.message });
    }
  }

  async handleList(req, res) {
    const business_id = req.query.business_id || req.query.workspaceId;
    const date = req.query.date;
    const customer_phone = req.query.customer_phone;

    if (!business_id) {
      return res.status(400).json({ error: "Missing required parameter 'business_id' in query." });
    }

    try {
      const result = await this.getReservations.execute({ business_id, date, customer_phone });
      return res.status(200).json({ success: true, count: result.length, data: result });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  async handleGetById(id, req, res) {
    try {
      const result = await this.getReservations.getById(id);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  }

  async handleUpdate(id, req, res) {
    try {
      const result = await this.updateReservation.execute(id, req.body || {});
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  async handleDelete(id, req, res) {
    try {
      const result = await this.deleteReservation.execute(id);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
}

module.exports = ReservationController;
