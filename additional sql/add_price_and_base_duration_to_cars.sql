-- Remove default values from price and base_rental_duration columns in cars table
ALTER TABLE cars DROP COLUMN price;
ALTER TABLE cars DROP COLUMN base_rental_duration;

ALTER TABLE cars ADD price INT NOT NULL;
ALTER TABLE cars ADD base_rental_duration INT NOT NULL;
ALTER TABLE bookings MODIFY COLUMN status ENUM('pending', 'booked', 'rented', 'returned', 'cancelled') DEFAULT 'pending';
ALTER TABLE bookings
ADD total_price INT NOT NULL DEFAULT 0;
CREATE TABLE booking_history (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    car_id INT NOT NULL,
    purpose VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
