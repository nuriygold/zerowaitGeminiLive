import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mock database for demo
  const appointments = [
    {
      name: "Maya Rodriguez",
      dob: "1989-03-04",
      appointmentId: "12345",
      datetime: new Date().toISOString(),
      provider: "Dr. Lee",
      location: "Room 2",
    },
    {
      name: "John Doe",
      dob: "1980-01-01",
      appointmentId: "67890",
      datetime: new Date(Date.now() + 3600000).toISOString(),
      provider: "Dr. Smith",
      location: "Room 5",
    }
  ];

  const checkIns = new Set();

  // API routes
  app.post("/api/getUpcomingAppointments", (req, res) => {
    const { name, dob } = req.body;
    console.log(`Searching for appointment: ${name}, ${dob}`);
    
    // Simple fuzzy match for demo
    const appointment = appointments.find(a => 
      a.name.toLowerCase() === name.toLowerCase() && 
      a.dob === dob
    );

    if (appointment) {
      res.json(appointment);
    } else {
      // For demo purposes, if not found, return a generic one if name is provided
      if (name) {
        res.json({
          appointmentId: "demo-" + Math.random().toString(36).substr(2, 9),
          datetime: new Date().toISOString(),
          provider: "Dr. Demo",
          location: "Suite A",
        });
      } else {
        res.status(404).json({ error: "Appointment not found" });
      }
    }
  });

  app.post("/api/completeCheckIn", (req, res) => {
    const { appointmentId } = req.body;
    checkIns.add(appointmentId);
    console.log(`Check-in completed for: ${appointmentId}`);
    res.json({ status: "SUCCESS" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
