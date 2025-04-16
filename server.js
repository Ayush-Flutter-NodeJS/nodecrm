const express = require("express");
const cors = require("cors");
const mysql = require("mysql");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const db = mysql.createConnection({
  host: '195.35.47.198',
  user: 'u919956999_ifes_user',
  password: 'MRta0]M&F([]',
  database: 'u919956999_ifes_crm_db'
});

db.connect(err => {
  if (err) {
    console.error("DB connection error:", err);
  } else {
    console.log("MySQL Connected");
  }
});

// ========== ROUTES ==========

// Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT id, name, role FROM users WHERE email = ? AND password = ?";
  db.query(sql, [email, password], (err, result) => {
    if (err) return res.status(500).send("Server error");
    if (result.length === 0) return res.status(401).send("Invalid credentials");
    res.json(result[0]);
  });
});

// Get all leads (Admin)
app.get("/leads", (req, res) => {
  db.query("SELECT * FROM leads", (err, result) => {
    if (err) return res.status(500).send("Error fetching leads");
    res.json(result);
  });
});

// Get leads assigned to a specific salesperson (or user)
app.get("/leads/assigned/:userId", (req, res) => {
  const userId = req.params.userId;
  db.query("SELECT * FROM leads WHERE assigned_to = ?", [userId], (err, result) => {
    if (err) return res.status(500).send("Error fetching assigned leads");
    res.json(result);
  });
});

// Assign multiple leads to a user (Salesperson)
app.post("/assign-leads", (req, res) => {
  const { leadIds, userId } = req.body;
  if (!Array.isArray(leadIds) || typeof userId !== "number") {
    return res.status(400).send("Invalid request. Please check the input.");
  }

  // Update leads to be assigned to the given userId (salesperson)
  const sql = "UPDATE leads SET assigned_to = ? WHERE id IN (?)";
  db.query(sql, [userId, leadIds], (err, result) => {
    if (err) return res.status(500).send("Failed to assign leads");
    res.send("Leads assigned successfully");
  });
});

app.post("/assign-leads", (req, res) => {
  const { leadIds, userId } = req.body;
  const now = new Date();

  if (!Array.isArray(leadIds) || typeof userId !== "number") {
    return res.status(400).send("Invalid request. Please check the input.");
  }

  const sql = "UPDATE leads SET assigned_to = ?, assigned_at = ? WHERE id IN (?)";
  db.query(sql, [userId, now, leadIds], (err, result) => {
    if (err) return res.status(500).send("Failed to assign leads");
    res.send("Leads assigned successfully");
  });
});


// Get all salespersons (users with role 'sales')
app.get("/salespersons", (req, res) => {
  db.query("SELECT id, name FROM users WHERE role = 'sales'", (err, result) => {
    if (err) return res.status(500).send("Error fetching salespersons");
    res.json(result);
  });
});

// Start server
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
