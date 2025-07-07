ALTER TABLE bookings MODIFY COLUMN status ENUM('pending', 'booked', 'rented', 'returned', 'cancelled') DEFAULT 'pending';
