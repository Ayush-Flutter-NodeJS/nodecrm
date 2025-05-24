const express = require("express");
const cors = require("cors");
const axios = require("axios");

const bodyParser = require("body-parser");
const mysql = require("mysql2");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Replace these with your real values
const accessToken =
  "EAAThL2lXUEUBOzYjj9umh5H83JQjuKCW8yB454oNIzoZBLvW7IBcb8ddGZBN0gaZB2HHk12N79Y9PPJBvsb9weR1GUUn8J01wg4032lABTQnS3o3CfiAAeI0sp7RYscCLRz3lkecA1X891DNQ4oaJyWYETu0xxNnPMtO1Ie22fKmC47qHQcZA8NMCt3Mo6P1SeqX";
const formId = "707028009370887";

const db = mysql.createConnection({
  host: "195.35.47.198",
  user: "u919956999_ifes_user",
  password: "MRta0]M&F([]",
  database: "u919956999_ifes_crm_db",
});

db.connect((err) => {
  if (err) {
    console.error("DB connection error:", err);
  } else {
    console.log("MySQL Connected");
  }
});

// Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const sql =
    "SELECT id, name, role FROM users WHERE email = ? AND password = ?";
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
  db.query(
    "SELECT * FROM leads WHERE assigned_to = ?",
    [userId],
    (err, result) => {
      if (err) return res.status(500).send("Error fetching assigned leads");
      res.json(result);
    }
  );
});

async function fetchAllLeads() {
  try {
    // 1. Get all lead forms
    const formsRes = await axios.get(
      `https://graph.facebook.com/v19.0/${formId}/leadgen_forms?access_token=${accessToken}`
    );

    if (!formsRes.data.data?.length) {
      console.log("No lead forms found");
      return;
    }

    // 2. Process each form
    for (const form of formsRes.data.data) {
      let nextPageUrl = `https://graph.facebook.com/v19.0/${form.id}/leads?access_token=${accessToken}`;
      let leadCount = 0;

      // 3. Paginate through all leads
      while (nextPageUrl) {
        const leadsRes = await axios.get(nextPageUrl);

        if (!leadsRes.data.data?.length) break;

        // 4. Insert leads into DB
        for (const lead of leadsRes.data.data) {
          const fields = {};
          lead.field_data.forEach((f) => (fields[f.name] = f.values[0]));

          try {
            await db.promise().query(
              `INSERT INTO leads (name, email, phone, company, designation, city, created_time) 
               VALUES (?, ?, ?, ?, ?, ?, ?) 
               ON DUPLICATE KEY UPDATE updated_at = NOW()`,
              [
                fields.full_name || null,
                fields.email || null,
                fields.phone_number || null,
                fields.company_name || null,
                fields.job_title || null,
                fields.city || null,
                new Date(lead.created_time)
                  .toISOString()
                  .slice(0, 19)
                  .replace("T", " "),
              ]
            );
            leadCount++;
          } catch (err) {
            console.error("DB Error:", err.message);
          }
        }

        console.log(`Form ${form.id}: Inserted ${leadCount} leads so far`);
        nextPageUrl = leadsRes.data.paging?.next || null;

        // Avoid rate limits
        if (nextPageUrl)
          await new Promise((resolve) => setTimeout(resolve, 500));
      }
      console.log(`Total inserted for form ${form.id}: ${leadCount}`);
    }
  } catch (error) {
    console.error("Fetch Error:", error.response?.data || error.message);
  }
}
fetchAllLeads();

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
    updated_phone,
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
    userId, // ← Match based on user ID
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

    const fullDays = results.filter((r) => r.status === "Full Day").length;
    const halfDays = results.filter((r) => r.status === "Half Day").length;

    res.json({
      attendance: results,
      summary: {
        totalDays: results.length,
        fullDays,
        halfDays,
      },
    });
  });
});

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
      return res
        .status(404)
        .json({ message: "No attendance record found for today" });
    }

    res.json({
      attendance: results[0], // Only return today's clock-in and clock-out times
    });
  });
});

app.get("/countries", async (req, res) => {
  try {
    const [countries] = await db
      .promise()
      .query("SELECT * FROM bird_countries");
    res.json({ success: true, countries });
  } catch (error) {
    console.error("Fetch countries error:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching countries" });
  }
});

// Fetch States by Country ID
app.get("/states/:countryId", async (req, res) => {
  try {
    const { countryId } = req.params;
    const [states] = await db
      .promise()
      .query("SELECT * FROM bird_states WHERE countryId = ?", [countryId]);
    res.json({ success: true, states });
  } catch (error) {
    console.error("Fetch states error:", error);
    res.status(500).json({ success: false, message: "Error fetching states" });
  }
});

// Fetch Cities by State ID
app.get("/cities/:stateId", async (req, res) => {
  try {
    const { stateId } = req.params;
    const [cities] = await db
      .promise()
      .query("SELECT * FROM bird_cities WHERE state_id = ?", [stateId]);
    res.json({ success: true, cities });
  } catch (error) {
    console.error("Fetch cities error:", error);
    res.status(500).json({ success: false, message: "Error fetching cities" });
  }
});

// POST API for lead creation
app.post("/create-lead", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      company_name,
      designation,
      company_services,
      country_id,
      state_id,
      city_id,
      status = "new",
    } = req.body;

    // Validate required fields
    if (
      !name ||
      !email ||
      !phone ||
      !company_name ||
      !designation ||
      !company_services
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const sql = `
      INSERT INTO leads (
        name, 
        email, 
        phone, 
        company, 
        designation, 
        company_services, 
        country, 
        state, 
        city, 
        status,
        lead_creation_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await db
      .promise()
      .query(sql, [
        name,
        email,
        phone,
        company_name,
        designation,
        company_services,
        country_id,
        state_id,
        city_id,
        status,
      ]);

    res.json({
      success: true,
      message: "Lead created successfully",
      leadId: result.insertId,
    });
  } catch (error) {
    console.error("Create lead error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating lead",
      error: error.message, // Optional: include error details
    });
  }
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

// GET user name by email
app.get("/get-user-by-email", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email parameter is required",
      });
    }

    const sql = "SELECT name FROM users WHERE email = ?";

    db.query(sql, [email], (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({
          success: false,
          message: "Database error",
        });
      }

      if (result.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        name: result[0].name,
      });
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Assign multiple leads to a user (Salesperson)
app.post("/assign-leads", (req, res) => {
  const { leadIds, userId } = req.body;

  // Validate input
  if (
    !Array.isArray(leadIds) ||
    leadIds.length === 0 ||
    typeof userId !== "number"
  ) {
    return res.status(400).json({
      error: "Invalid request. Please provide leadIds array and userId.",
    });
  }

  const istNow = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
  });
  const formattedDate = new Date(istNow)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  // Create placeholders for each lead ID
  const placeholders = leadIds.map(() => "?").join(",");
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
      affectedRows: result.affectedRows,
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
