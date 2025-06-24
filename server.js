require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const Family = require('./models/family');
const cors = require('cors');
const adminRoutes = require('./routes/admin');
const session = require('express-session');

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

app.use(session({
  secret: 'mysecretkey',
  resave: false,
  saveUninitialized: false
}));

// Static & view engine
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Admin routes
app.use('/admin', adminRoutes);

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + path.extname(file.originalname);
    cb(null, file.fieldname + '-' + unique);
  }
});
const upload = multer({ storage });

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB error:", err));

// Home route
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, '1stProject.html'));
});

// Registration route
app.post('/submit-form', upload.single('files'), async (req, res) => {
  try {
    const {
      value, gender, dob, phone, email, city, locality,
      occupation, gotra, nativePlace, bloodGroup,
      address, memberName, relation, age,
      maritalStatus, qualification, occupation: memberOccupation,
    } = req.body;

    const members = [];
    if (Array.isArray(memberName)) {
      memberName.forEach((_, i) => {
        members.push({
          name: memberName[i],
          relation: relation[i],
          age: parseInt(age[i]),
          maritalStatus: maritalStatus[i],
          bloodGroup: bloodGroup[i],
          qualification: qualification[i],
          occupation: memberOccupation[i]
        });
      });
    } else if (memberName) {
      members.push({
        name: memberName,
        relation,
        age: parseInt(age),
        maritalStatus,
        bloodGroup,
        qualification,
        occupation: memberOccupation
      });
    }

    const newFamily = new Family({
      profileImage: req.file?.path || '',
      familyHead: value,
      gender,
      dob: new Date(dob), // stored directly
      phone,
      email,
      locality,
      city,
      occupation,
      gotra,
      nativePlace,
      bloodGroup,
      address,
      members,
      status: 'pending',
      email // no password needed
    });

    await newFamily.save();
    res.send('✅ Registered! Please wait for admin approval.');

  } catch (error) {
    console.error("❌ Registration Error:", error);
    res.status(500).send('Error: ' + error.message);
  }
});

// Render login page
app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('login', { error: null });
});

// Login with Email + DOB
app.post('/login', async (req, res) => {
  const { email, dob } = req.body;

  if (!email || !dob) {
    return res.render('login', { error: 'Email and DOB are required' });
  }

  try {
    const user = await Family.findOne({ email, status: 'approved' });
    if (!user) return res.render('login', { error: 'User not found or not approved' });

    const dobInput = new Date(dob).toISOString().split('T')[0];
    const dobStored = new Date(user.dob).toISOString().split('T')[0];

    if (dobInput !== dobStored) {
      return res.render('login', { error: 'Incorrect Date of Birth' });
    }

    req.session.user = { id: user._id, email: user.email, name: user.familyHead };
    res.redirect('/dashboard');

  } catch (err) {
    console.error('❌ Login Error:', err);
    res.render('login', { error: 'Login failed. Please try again.' });
  }
});

// Dashboard page
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('dashboard', { user: req.session.user });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
