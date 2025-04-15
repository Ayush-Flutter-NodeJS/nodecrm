const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs'); // Using bcryptjs for compatibility
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
    console.error('❌ Database connection failed:', err);
  } else {
    console.log('✅ Connected to MySQL');
  }
});

// POST /login - Login user
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const query = 'SELECT * FROM App_users WHERE email = ?';
  db.query(query, [email], async (err, results) => {
    if (err) {
      console.error('❌ Error fetching user:', err);
      return res.status(500).json({ message: 'Server error' });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = results[0];

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Successful login
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
