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

const hbs = exphbs.create({
  defaultLayout: 'main',
  helpers: {
    eq: function(a, b) {
      return a === b;
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

app.use('/users', userRoutes);
app.use('/cars', carRoutes);

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
    res.render('home', { user: req.session.user, cars, filter: { color, type } });
  } catch (err) {
    console.error(err);
    res.render('home', { user: req.session.user, cars: [], filter: { color, type } });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
