const express = require('express');
const path = require('path');
const exphbs = require('express-handlebars');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const db = require('./config/db');

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Session setup (simple in-memory for now)
app.use(session({
  secret: 'car_rental_secret_key',
  resave: false,
  saveUninitialized: true,
}));

// Make user session available in views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

const hbs = exphbs.create({
  defaultLayout: 'main',
  helpers: {
    eq: function(a, b) {
      return a === b;
    },
    ifCond: function(v1, operator, v2, options) {
      switch (operator) {
        case '==':
          return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===':
          return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=':
          return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case '!==':
          return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '<':
          return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=':
          return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>':
          return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=':
          return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case '&&':
          return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case '||':
          return (v1 || v2) ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    }
  }
});

// Handlebars setup
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const userRoutes = require('./routes/user');
const carRoutes = require('./routes/car');
const bookingRoutes = require('./routes/booking');
const adminRoutes = require('./routes/admin');

app.use('/users', userRoutes);
app.use('/cars', carRoutes);
app.use('/bookings', bookingRoutes);
app.use('/admin', adminRoutes);
// Car detail page
app.get('/cars/:id', async (req, res) => {
  const carId = req.params.id;
  try {
    const [cars] = await db.execute('SELECT * FROM cars WHERE id = ?', [carId]);
    if (cars.length === 0) {
      return res.status(404).send('Car not found');
    }
    const car = cars[0];
    const [images] = await db.execute('SELECT image_url FROM car_images WHERE car_id = ?', [carId]);
    car.images = images.map(img => img.image_url);
    res.render('car', { user: req.session.user, car });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Home route
app.get('/', async (req, res) => {
  const { color, type } = req.query;
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

  try {
    const [cars] = await db.execute(query, params);

    // Fetch images for each car
    for (const car of cars) {
      const [images] = await db.execute('SELECT image_url FROM car_images WHERE car_id = ?', [car.id]);
      car.images = images.map(img => img.image_url);
      // For backward compatibility, set image_url to first image if exists
      car.image_url = car.images.length > 0 ? car.images[0] : null;
    }

    res.render('home', { user: req.session.user, cars, filter: { color, type } });
  } catch (err) {
    console.error(err);
    res.render('home', { user: req.session.user, cars: [], filter: { color, type } });
  }
});


// Search results route
app.get('/search', async (req, res) => {
  console.log('Search route hit with query:', req.query.query);
  const { query } = req.query;
  if (!query || query.trim() === '') {
    return res.redirect('/');
  }
  const searchTerm = `%${query.trim()}%`;
  try {
    const [cars] = await db.execute(
      'SELECT * FROM cars WHERE status = ? AND (name LIKE ? OR description LIKE ?)',
      ['available', searchTerm, searchTerm]
    );
    res.render('home', { user: req.session.user, cars, filter: { search: query } });
  } catch (err) {
    console.error(err);
    res.render('home', { user: req.session.user, cars: [], filter: { search: query } });
  }
});

// Booking history page
app.get('/bookings/history', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  const user = req.session.user;
  try {
    let bookings;
    if (user.role === 'admin') {
      [bookings] = await db.execute(
        `SELECT b.*, c.name AS car_name, c.color, c.type, b.total_price FROM bookings b JOIN cars c ON b.car_id = c.id ORDER BY b.start_date DESC`
      );
    } else {
      [bookings] = await db.execute(
        `SELECT b.*, c.name AS car_name, c.color, c.type, b.total_price FROM bookings b JOIN cars c ON b.car_id = c.id WHERE b.user_id = ? ORDER BY b.start_date DESC`,
        [user.id]
      );
    }
    res.render('bookings', { user, bookings });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
