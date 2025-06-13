const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { uploadProductImage } = require('../config/multer');

// Middleware to check if user is admin
function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  res.status(403).send('Forbidden');
}

// Admin profile page
router.get('/profile', isAdmin, (req, res) => {
  const user = req.session.user;
  res.render('admin/profile', { user });
});

// Admin products list page
router.get('/products', isAdmin, async (req, res) => {
  const user = req.session.user;
  try {
    const [cars] = await db.execute('SELECT * FROM cars');
    // Fetch images for each car
    for (const car of cars) {
      const [images] = await db.execute('SELECT image_url FROM car_images WHERE car_id = ?', [car.id]);
      car.images = images.map(img => img.image_url);
    }
    res.render('admin/products', { user, cars });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Admin add product form
router.get('/products/new', isAdmin, (req, res) => {
  const user = req.session.user;
  res.render('admin/product_form', { user, product: null });
});

// Admin create product
router.post('/products/new', isAdmin, uploadProductImage.single('image'), async (req, res) => {
  const { name, type, color, status, description } = req.body;
  const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : null;

  try {
    const [result] = await db.execute(
      'INSERT INTO cars (name, type, color, status, description) VALUES (?, ?, ?, ?, ?)',
      [name, type, color, status, description]
    );
    const carId = result.insertId;
    if (imageUrl) {
      await db.execute(
        'INSERT INTO car_images (car_id, image_url) VALUES (?, ?)',
        [carId, imageUrl]
      );
    }
    res.redirect('/admin/products');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Admin edit product form
router.get('/products/edit/:id', isAdmin, async (req, res) => {
  const user = req.session.user;
  const productId = req.params.id;
  try {
    const [cars] = await db.execute('SELECT * FROM cars WHERE id = ?', [productId]);
    if (cars.length === 0) {
      return res.status(404).send('Product not found');
    }
    const product = cars[0];
    const [images] = await db.execute('SELECT image_url FROM car_images WHERE car_id = ?', [productId]);
    product.images = images.map(img => img.image_url);
    res.render('admin/product_form', { user, product });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Admin update product
router.post('/products/edit/:id', isAdmin, uploadProductImage.single('image'), async (req, res) => {
  const productId = req.params.id;
  const { name, type, color, status, description } = req.body;
  const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : null;

  try {
    await db.execute(
      'UPDATE cars SET name = ?, type = ?, color = ?, status = ?, description = ? WHERE id = ?',
      [name, type, color, status, description, productId]
    );
    if (imageUrl) {
      // Delete old images for simplicity, then insert new image
      await db.execute('DELETE FROM car_images WHERE car_id = ?', [productId]);
      await db.execute('INSERT INTO car_images (car_id, image_url) VALUES (?, ?)', [productId, imageUrl]);
    }
    res.redirect('/admin/products');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Admin delete product
router.post('/products/delete/:id', isAdmin, async (req, res) => {
  const productId = req.params.id;
  try {
    await db.execute('DELETE FROM car_images WHERE car_id = ?', [productId]);
    await db.execute('DELETE FROM cars WHERE id = ?', [productId]);
    res.redirect('/admin/products');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Admin users list page
router.get('/users', isAdmin, async (req, res) => {
  const user = req.session.user;
  try {
    const [admins] = await db.execute('SELECT id, name, email FROM users WHERE role = ?', ['admin']);
    res.render('admin/users', { user, admins });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Hidden admin registration form (accessible only by you)
router.get('/register', (req, res) => {
  res.render('admin/register');
});

// Handle hidden admin registration form submission
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).send('Please provide name, email, and password');
  }
  try {
    // Check if email already exists
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).send('Email already registered');
    }
    // Hash password
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);
    // Insert new admin user
    await db.execute(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, 'admin']
    );
    res.send('Admin registered successfully. You can now login.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Admin add new admin
router.post('/users/new', isAdmin, async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).send('Please provide name, email, and password');
  }
  try {
    // Check if email already exists
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).send('Email already registered');
    }
    // Hash password
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);
    // Insert new admin user
    await db.execute(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, 'admin']
    );
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Admin bookings management page
router.get('/bookings', isAdmin, async (req, res) => {
  const user = req.session.user;
  try {
    const [bookings] = await db.execute(
      `SELECT b.*, c.name AS car_name, c.type, c.color, c.description, u.name AS user_name, u.email AS user_email
       FROM bookings b
       JOIN cars c ON b.car_id = c.id
       JOIN users u ON b.user_id = u.id
       ORDER BY b.start_date DESC`
    );
    res.render('admin/bookings', { user, bookings });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Admin accept booking
router.post('/bookings/accept/:id', isAdmin, async (req, res) => {
  const bookingId = req.params.id;
  try {
    // Update booking status to 'accepted'
    await db.execute(
      `UPDATE bookings SET status = 'accepted' WHERE id = ?`,
      [bookingId]
    );
    // Update car status to 'not-available'
    const [bookings] = await db.execute(
      `SELECT car_id FROM bookings WHERE id = ?`,
      [bookingId]
    );
    if (bookings.length > 0) {
      const carId = bookings[0].car_id;
    await db.execute(
      `UPDATE cars SET status = 'booked' WHERE id = ?`,
      [carId]
    );
    }
    res.redirect('/admin/bookings');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Admin confirm booking (set booking status to 'booked' and car status to 'not-available')
router.post('/bookings/confirm/:id', isAdmin, async (req, res) => {
  const bookingId = req.params.id;
  try {
    await db.execute(
      `UPDATE bookings SET status = 'booked' WHERE id = ?`,
      [bookingId]
    );
    const [bookings] = await db.execute(
      `SELECT car_id FROM bookings WHERE id = ?`,
      [bookingId]
    );
    if (bookings.length > 0) {
      const carId = bookings[0].car_id;
      await db.execute(
        `UPDATE cars SET status = 'not-available' WHERE id = ?`,
        [carId]
      );
    }
    res.redirect('/admin/bookings');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Admin mark booking as returned (set booking status to 'returned' and car status to 'available')
router.post('/bookings/mark-returned/:id', isAdmin, async (req, res) => {
  const bookingId = req.params.id;
  try {
    await db.execute(
      `UPDATE bookings SET status = 'returned' WHERE id = ?`,
      [bookingId]
    );
    const [bookings] = await db.execute(
      `SELECT car_id FROM bookings WHERE id = ?`,
      [bookingId]
    );
    if (bookings.length > 0) {
      const carId = bookings[0].car_id;
      await db.execute(
        `UPDATE cars SET status = 'available' WHERE id = ?`,
        [carId]
      );
    }
    res.redirect('/admin/bookings');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
