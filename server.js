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

app.post("/update-user-lead-details", (req, res) => {
  const {
    userId,
    lead_name,
    lead_email,
    lead_company,
    lead_phone,
    lead_designation,
    assigned_at,
    lead_status,
    remarks,
    follow_up_date,
    follow_up_time,
    updated_name,
    updated_company,
    updated_email,
    updated_phone
  } = req.body;

  const sql = `
    UPDATE users 
    SET 
      lead_name = ?, 
      lead_email = ?, 
      lead_company = ?, 
      lead_phone = ?, 
      lead_designation = ?, 
      assigned_at = ?, 
      lead_status = ?, 
      remarks = ?, 
      follow_up_date = ?, 
      follow_up_time = ?, 
      updated_name = ?, 
      updated_company = ?, 
      updated_email = ?, 
      updated_phone = ? 
    WHERE id = ?
  `;

  const values = [
    lead_name,
    lead_email,
    lead_company,
    lead_phone,
    lead_designation,
    assigned_at,
    lead_status,
    remarks,
    follow_up_date,
    follow_up_time,
    updated_name,
    updated_company,
    updated_email,
    updated_phone,
    userId // ← Match based on user ID
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("DB update error:", err);
      return res.status(500).send("Error updating user lead details");
    }

    if (result.affectedRows === 0) {
      return res.status(404).send("No matching user found to update");
    }

    res.send("Lead details updated in users table");
  });
});


//attendece record....

app.post("/mark-attendance", (req, res) => {
  const { name, email, type, location_url } = req.body;

  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const istDateObj = new Date(now.getTime() + istOffset);

  const date = istDateObj.toISOString().split("T")[0]; // YYYY-MM-DD
  const time = istDateObj.toTimeString().split(" ")[0];

  if (type === "clockin") {
    // Check if already clocked in
    const checkSql = `SELECT * FROM attendance WHERE email = ? AND date = ?`;

    db.query(checkSql, [email, date], (err, result) => {
      if (err) return res.status(500).send("Error checking clock-in");
      if (result.length > 0)
        return res.status(400).json({ message: "Already clocked in today" });

      // Insert new record with clock_in and clockin_location
      const insertSql = `
        INSERT INTO attendance (name, email, date, clock_in, clockin_location)
        VALUES (?, ?, ?, ?, ?)
      `;

      db.query(insertSql, [name, email, date, time, location_url], (err2) => {
        if (err2) return res.status(500).send("Error saving clock-in");
        res.json({ message: "Clock-in successful", time });
      });
    });
  } else if (type === "clockout") {
    const getSql = `SELECT * FROM attendance WHERE email = ? AND date = ?`;

    db.query(getSql, [email, date], (err, result) => {
      if (err) return res.status(500).send("Error checking clock-out");
      if (result.length === 0)
        return res
          .status(400)
          .json({ message: "Clock-in not found for today" });

      const clockInTime = new Date(`${date}T${result[0].clock_in}`);
      const clockOutTime = new Date(now.getTime() + istOffset);

      const hoursWorked = (clockOutTime - clockInTime) / (1000 * 60 * 60); // in hours

      // Full Day logic
      const graceIn = new Date(`${date}T09:45:00`);
      const fullOut = new Date(`${date}T18:30:00`);

      let status = "Half Day";
      if (
        clockInTime <= graceIn &&
        clockOutTime >= fullOut &&
        hoursWorked >= 9
      ) {
        status = "Full Day";
      }

      const updateSql = `
        UPDATE attendance
        SET clock_out = ?, working_hours = ?, status = ?, clockout_location = ?
        WHERE email = ? AND date = ?
      `;

      db.query(
        updateSql,
        [time, hoursWorked.toFixed(2), status, location_url, email, date],
        (err2) => {
          if (err2) return res.status(500).send("Error saving clock-out");
          res.json({
            message: "Clock-out successful",
            status,
            working_hours: hoursWorked.toFixed(2),
            time,
          });
        }
      );
    });
  } else {
    res
      .status(400)
      .json({ message: "Invalid type. Use 'clockin' or 'clockout'" });
  }
});



///get the attendece total days full day and half days...

app.get("/get-attendance", (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const sql = `SELECT date, clock_in, clock_out, status, working_hours FROM attendance WHERE email = ? ORDER BY date DESC`;

  db.query(sql, [email], (err, results) => {
    if (err) {
      console.error("Error fetching attendance:", err);
      return res.status(500).send("Error fetching attendance");
    }

    const fullDays = results.filter(r => r.status === "Full Day").length;
    const halfDays = results.filter(r => r.status === "Half Day").length;

    res.json({
      attendance: results,
      summary: {
        totalDays: results.length,
        fullDays,
        halfDays
      }
    });
  });
});



////


// Get today's attendance details (clock-in and clock-out only) for a specific user
app.get("/get-todays-attendance", (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const istDateObj = new Date(now.getTime() + istOffset);
  const date = istDateObj.toISOString().split("T")[0]; // YYYY-MM-DD

  const sql = `SELECT date, clock_in, clock_out FROM attendance WHERE email = ? AND date = ?`;

  db.query(sql, [email, date], (err, results) => {
    if (err) {
      console.error("Error fetching today's attendance:", err);
      return res.status(500).send("Error fetching today's attendance");
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "No attendance record found for today" });
    }

    res.json({
      attendance: results[0],  // Only return today's clock-in and clock-out times
    });
  });
});




//get users details on the basics odf status
app.get("/get-users-by-status", (req, res) => {
  const status = req.query.status;

  const sql = `
    SELECT 
      id,
      lead_name,
      lead_email,
      lead_company,
      lead_phone,
      lead_designation,
      assigned_at,
      follow_up_date,
      follow_up_time,
      updated_name,
      updated_company,
      updated_email,
      updated_phone
    FROM users
    WHERE lead_status = ?
  `;

  db.query(sql, [status], (err, results) => {
    if (err) {
      console.error("Error fetching users by status:", err);
      return res.status(500).send("Server error while fetching users");
    }

    res.json(results);
  });
});









// Assign multiple leads to a user (Salesperson)
app.post("/assign-leads", (req, res) => {
  const { leadIds, userId } = req.body;

  // Validate input
  if (!Array.isArray(leadIds) || leadIds.length === 0 || typeof userId !== "number") {
    return res.status(400).json({ error: "Invalid request. Please provide leadIds array and userId." });
  }

  const istNow = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const formattedDate = new Date(istNow).toISOString().slice(0, 19).replace("T", " ");

  // Create placeholders for each lead ID
  const placeholders = leadIds.map(() => '?').join(',');
  const sql = `UPDATE leads SET assigned_to = ?, assigned_at = ? WHERE id IN (${placeholders})`;
  
  // Combine parameters - userId and formattedDate first, then spread leadIds
  const params = [userId, formattedDate, ...leadIds];

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error("Error assigning leads:", err);
      return res.status(500).json({ error: "Failed to assign leads" });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "No matching leads found" });
    }
    
    res.json({ 
      success: true,
      message: `${result.affectedRows} leads assigned successfully`,
      affectedRows: result.affectedRows
    });
  });
});

app.get("/assigned-leads/:userId", (req, res) => {
  const userId = parseInt(req.params.userId);
  
  if (isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  const sql = "SELECT * FROM leads WHERE assigned_to = ?";
  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});


// app.post("/assign-leads", (req, res) => {
//   const { leadIds, userId } = req.body;
//   const now = new Date();

//   if (!Array.isArray(leadIds) || typeof userId !== "number") {
//     return res.status(400).send("Invalid request. Please check the input.");
//   }

//   const sql = "UPDATE leads SET assigned_to = ?, assigned_at = ? WHERE id IN (?)";
//   db.query(sql, [userId, now, leadIds], (err, result) => {
//     if (err) return res.status(500).send("Failed to assign leads");
//     res.send("Leads assigned successfully");
//   });
// });


// Get all salespersons (users with role 'sales')
app.get("/salespersons", (req, res) => {
  db.query("SELECT id, name FROM users WHERE role = 'sales'", (err, result) => {
    if (err) return res.status(500).send("Error fetching salespersons");
    res.json(result);
  });
});

// Start server
app.listen(3001, () => {
  console.log("Server running on port 3001");
});
