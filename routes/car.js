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

  // Search suggestions endpoint for autocomplete
  router.get('/search-suggestions', async (req, res) => {
    const { q } = req.query;
    console.log('Search suggestions query:', q);
    if (!q || q.trim() === '') {
      return res.json([]);
    }
    const searchTerm = `%${q.trim()}%`;
    try {
      const [results] = await db.execute(
        `SELECT DISTINCT name FROM cars WHERE status = 'available' AND name LIKE ? LIMIT 10`,
        [searchTerm]
      );
      const suggestions = results.map(row => row.name);
      console.log('Suggestions:', suggestions);
      res.json(suggestions);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  });

module.exports = router;
