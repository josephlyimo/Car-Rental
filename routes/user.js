const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');

const router = express.Router();

const { uploadProfileImage } = require('../config/multer');

// GET /login - render login form
router.get('/login', (req, res) => {
  res.render('login');
});

// GET /profile/edit - render profile image upload form
router.get('/profile/edit', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/users/login');
  }
  res.render('user/profile_edit', { user: req.session.user });
});

// POST /profile/edit - handle profile image upload
router.post('/profile/edit', uploadProfileImage.single('profileImage'), async (req, res) => {
  console.log('Profile image upload route hit');
  if (!req.session.user) {
    console.log('No user session found, redirecting to login');
    return res.redirect('/users/login');
  }
  if (!req.file) {
    console.log('No file uploaded');
    return res.status(400).render('user/profile_edit', { user: req.session.user, error: 'Please select an image to upload' });
  }
  try {
    console.log('File uploaded:', req.file);
    const profileImage = req.file.filename;
    const userId = req.session.user.id;
    await db.execute('UPDATE users SET profile_image = ? WHERE id = ?', [profileImage, userId]);
    // Update session user profileImage
    req.session.user.profileImage = profileImage;
    console.log('Profile image updated in database and session');
    res.redirect('/users/profile');
  } catch (err) {
    console.error('Error updating profile image:', err);
    res.status(500).render('user/profile_edit', { user: req.session.user, error: 'Server error' });
  }
});

// GET /register - render registration form
router.get('/register', (req, res) => {
  res.render('register');
});

// GET /logout - destroy session and redirect to home
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// GET /profile - render user profile page
router.get('/profile', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/users/login');
  }
  res.render('user/profile', { user: req.session.user });
});

const weakPasswords = ['123456', 'password', '123456789', '12345678', '12345', '1234', '111111', 'abcd', 'qwerty'];


// Register user
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).render('register', { error: 'Please provide name, email and password' });
  }

  if (name.length < 6) {
    return res.status(400).render('register', { error: 'Name must be at least 6 characters long' });
  }

  if (weakPasswords.includes(password)) {
    return res.status(400).render('register', { error: 'Password is too weak or guessable' });
  }

  try {
    const [existingUser] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(400).render('register', { error: 'Email already registered' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.execute('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, hashedPassword]);
    res.redirect('/users/login');
  } catch (err) {
    console.error(err);
    res.status(500).render('register', { error: 'Server error' });
  }
});

const url = require('url');

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).render('login', { error: 'Please provide email and password' });
  }
  try {
    const [rows] = await db.execute('SELECT id, name, email, password_hash, role, profile_image FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).render('login', { error: 'Invalid credentials' });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).render('login', { error: 'Invalid credentials' });
    }
    // Set user info in session
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profile_image
    };
    // Redirect based on role
    if (user.role === 'admin') {
      res.redirect('/admin/profile');
    } else {
      res.redirect('/');
    }
  } catch (err) {
    console.error(err);
    res.status(500).render('login', { error: 'Server error' });
  }
});

module.exports = router;
