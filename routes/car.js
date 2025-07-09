const express = require('express');
const db = require('../config/db');

const router = express.Router();

// Get all available cars with optional filters
router.get('/', async (req, res) => {
  const { color, type, search } = req.query;
  let query = 'SELECT * FROM cars WHERE status = ?';
  const params = ['available'];

  if (color) {
    query += ' AND color = ?';
    params.push(color);
  }
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  if (search) {
    const searchTerm = `%${search}%`;
    query += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(searchTerm, searchTerm);
  }

  try {
    const [cars] = await db.execute(query, params);
    res.json(cars);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route to show unavailable cars with expected availability
router.get('/unavailable', async (req, res) => {
  try {
    const [cars] = await db.execute(
      `SELECT c.id, c.name, c.status, b.end_date AS expected_availability
       FROM cars c
       JOIN bookings b ON c.id = b.car_id
       WHERE c.status IN ('booked', 'rented') AND b.status IN ('booked', 'rented')
       ORDER BY b.end_date ASC`
    );
    // Format date to readable string
    cars.forEach(car => {
      if (car.expected_availability) {
        car.expected_availability = new Date(car.expected_availability).toDateString();
      } else {
        car.expected_availability = 'Unknown';
      }
    });
    res.render('cars_unavailable', { cars });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Get car details by id
router.get('/:id', async (req, res) => {
  const carId = req.params.id;
  try {
    const [cars] = await db.execute('SELECT * FROM cars WHERE id = ?', [carId]);
    if (cars.length === 0) {
      return res.status(404).json({ message: 'Car not found' });
    }
    const car = cars[0];
    const [images] = await db.execute('SELECT image_url FROM car_images WHERE car_id = ?', [carId]);
    car.images = images.map(img => img.image_url);
    res.json(car);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
