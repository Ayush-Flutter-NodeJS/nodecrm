const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// MySQL Database Connection
const db = mysql.createConnection({
  host: '195.35.47.198',
  user: 'u919956999_ifes_user',
  password: 'MRta0]M&F([]',
  database: 'u919956999_ifes_crm_db'
});

db.connect((err) => {
  if (err) {
    console.error(' Database connection failed:', err);
  } else {
    console.log(' Connected to MySQL');
  }
});


//  Fetch All Countries
app.get("/countries", async (req, res) => {
    try {
      const fetchCountriesSQL = "SELECT * FROM bird_countries";
      const [countries] = await db.query(fetchCountriesSQL);
      res.json({ success: true, countries });
    } catch (error) {
      console.error("Fetch countries error:", error);
      res.status(500).json({ success: false, message: "Error fetching countries" });
    }
  });
  
  //  Fetch States by Country ID
  app.get("/states/:countryId", async (req, res) => {
    try {
      const { countryId } = req.params;
      const fetchStatesSQL = "SELECT * FROM bird_states WHERE countryId = ?";
      const [states] = await db.query(fetchStatesSQL, [countryId]);
      res.json({ success: true, states });
    } catch (error) {
      console.error("Fetch states error:", error);
      res.status(500).json({ success: false, message: "Error fetching states" });
    }
  });
  
  //  Fetch Cities by State ID
  app.get("/cities/:stateId", async (req, res) => {
    try {
      const { stateId } = req.params;
      const fetchCitiesSQL = "SELECT * FROM bird_cities WHERE state_id = ?";
      const [cities] = await db.query(fetchCitiesSQL, [stateId]);
      res.json({ success: true, cities });
    } catch (error) {
      console.error("Fetch cities error:", error);
      res.status(500).json({ success: false, message: "Error fetching cities" });
    }
  });

// POST /login - Login user with plain text password
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const query = 'SELECT * FROM App_users WHERE email = ?';
  db.query(query, [email], (err, results) => {
    if (err) {
      console.error(' Error fetching user:', err);
      return res.status(500).json({ message: 'Server error' });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = results[0];

    if (user.password !== password) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    //  Successful login
    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        mobile: user.mobile,
        company: user.company,
        designation: user.designation,
        users: user.users,
        clock_in: user.clock_in,
        clock_out: user.clock_out,
        current_location: user.current_location,
        remarks: user.remarks,
        total_count: user.total_count,
      }
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
});
