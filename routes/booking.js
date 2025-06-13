const express = require('express');
const router = express.Router();

const db = require('../config/db');
const dayjs = require('dayjs');

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  // If request is AJAX or expects JSON, respond with JSON error instead of redirect
  if (req.xhr || req.headers.accept.indexOf('json') > -1) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  res.redirect('/users/login');
}

// Middleware to check if user is admin
function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ message: 'Forbidden' });
}

// GET booking form with car_id and user info form
router.get('/new', isAuthenticated, async (req, res) => {
  const user = req.session.user;
  const carId = req.query.car_id;
  try {
    const [cars] = await db.execute('SELECT * FROM cars WHERE status = ?', ['available']);
    let car = null;
    if (carId) {
      const [carRows] = await db.execute('SELECT * FROM cars WHERE id = ?', [carId]);
      if (carRows.length > 0) {
        car = carRows[0];
      }
    }
    const today = dayjs().format('YYYY-MM-DD');
    res.render('book', { user, cars, car, today });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Booking history page
router.get('/history', isAuthenticated, async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/users/login');
  }
  const user = req.session.user;
  try {
    let bookings;
    if (user.role === 'admin') {
      [bookings] = await db.execute(
        `SELECT b.*, c.name AS car_name, c.color, c.type FROM bookings b JOIN cars c ON b.car_id = c.id ORDER BY b.start_date DESC`
      );
    } else {
      [bookings] = await db.execute(
        `SELECT b.*, c.name AS car_name, c.color, c.type FROM bookings b JOIN cars c ON b.car_id = c.id WHERE b.user_id = ? ORDER BY b.start_date DESC`,
        [user.id]
      );
    }
    res.render('bookings', { user, bookings });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Create a new booking
router.post('/', isAuthenticated, async (req, res) => {
  const { car_id, purpose, start_date, end_date } = req.body;
  const user_id = req.session.user.id;

  if (!car_id || !purpose || !start_date || !end_date) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  if (new Date(start_date) > new Date(end_date)) {
    return res.status(400).json({ message: 'Start date must be before end date' });
  }

  try {
    // Check if car is available for the requested period (no overlapping bookings)
    const [overlaps] = await db.execute(
      `SELECT * FROM bookings WHERE car_id = ? AND status IN ('pending', 'booked', 'rented') AND NOT (end_date < ? OR start_date > ?)`,
      [car_id, start_date, end_date]
    );
    if (overlaps.length > 0) {
      return res.status(409).json({ message: 'Car is already booked for the selected dates' });
    }

    // Get car price and base rental duration
    const [cars] = await db.execute(
      `SELECT price, base_rental_duration FROM cars WHERE id = ?`,
      [car_id]
    );
    if (cars.length === 0) {
      return res.status(404).json({ message: 'Car not found' });
    }
    const car = cars[0];

    // Calculate total days
    const start = dayjs(start_date);
    const end = dayjs(end_date);
    const totalDays = end.diff(start, 'day') + 1;

    // Calculate price
    let totalPrice = car.price;
    if (totalDays > car.base_rental_duration) {
      const extraDays = totalDays - car.base_rental_duration;
      totalPrice += extraDays * 20000;
    }

    // Insert booking with status 'pending' and total price
    await db.execute(
      `INSERT INTO bookings (user_id, car_id, purpose, start_date, end_date, status, total_price) VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [user_id, car_id, purpose, start_date, end_date, totalPrice]
    );

    // Remove car status update here; admin will update car status upon confirmation
    // await db.execute(
    //   `UPDATE cars SET status = 'booked' WHERE id = ?`,
    //   [car_id]
    // );

    res.status(201).json({ message: 'Booking created successfully', totalPrice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get bookings for logged-in user or all bookings for admin
router.get('/', isAuthenticated, async (req, res) => {
  const user = req.session.user;
  try {
    let bookings;
    if (user.role === 'admin') {
      [bookings] = await db.execute(
        `SELECT b.*, c.name AS car_name, c.color, c.type FROM bookings b JOIN cars c ON b.car_id = c.id ORDER BY b.start_date DESC`
      );
    } else {
      [bookings] = await db.execute(
        `SELECT b.*, c.name AS car_name, c.color, c.type FROM bookings b JOIN cars c ON b.car_id = c.id WHERE b.user_id = ? ORDER BY b.start_date DESC`,
        [user.id]
      );
    }
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// User cancels a booking
router.post('/:id/cancel', isAuthenticated, async (req, res) => {
  const bookingId = req.params.id;
  const userId = req.session.user.id;

  try {
    // Verify booking belongs to user and status is 'pending'
    const [bookings] = await db.execute(
      `SELECT * FROM bookings WHERE id = ? AND user_id = ? AND status = 'pending'`,
      [bookingId, userId]
    );
    if (bookings.length === 0) {
      return res.status(404).json({ message: 'Booking not found or not eligible for cancellation' });
    }

    // Move booking to booking_history and delete from bookings
    await db.execute(
      `INSERT INTO booking_history (user_id, car_id, purpose, start_date, end_date, status, created_at)
       SELECT user_id, car_id, purpose, start_date, end_date, 'cancelled', created_at FROM bookings WHERE id = ?`,
      [bookingId]
    );
    await db.execute(
      `DELETE FROM bookings WHERE id = ?`,
      [bookingId]
    );

    // Update car status to 'available'
    const carId = bookings[0].car_id;
    await db.execute(
      `UPDATE cars SET status = 'available' WHERE id = ?`,
      [carId]
    );

    res.json({ message: 'Booking cancelled successfully' });
  } catch (err) {
    console.error('Cancel booking error:', err.message);
    res.status(500).json({ message: 'An unexpected error occurred. Please try again later.' });
  }
});

// Admin confirms return
router.put('/:id/confirm-return', isAdmin, async (req, res) => {
  const bookingId = req.params.id;

  try {
    // Verify booking status is 'returned'
    const [bookings] = await db.execute(
      `SELECT * FROM bookings WHERE id = ? AND status = 'returned'`,
      [bookingId]
    );
    if (bookings.length === 0) {
      return res.status(404).json({ message: 'Booking not found or not eligible for confirmation' });
    }

    // Update booking status to 'returned' (confirmed)
    await db.execute(
      `UPDATE bookings SET status = 'returned' WHERE id = ?`,
      [bookingId]
    );

    // Update car status to 'available'
    const carId = bookings[0].car_id;
    await db.execute(
      `UPDATE cars SET status = 'available' WHERE id = ?`,
      [carId]
    );

    // Update return log to confirmed
    await db.execute(
      `UPDATE return_logs SET confirmed_by_admin = TRUE WHERE booking_id = ?`,
      [bookingId]
    );

    res.json({ message: 'Return confirmed and car marked available' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
