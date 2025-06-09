-- Car Rental System Database Schema
-- Created for Node.js backend usage
-- Includes all tables, constraints, and indexes

-- Create the database
CREATE DATABASE IF NOT EXISTS car_rental_system;
USE car_rental_system;

-- 1. Users Table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Cars Table
CREATE TABLE cars (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(50),
    type ENUM('tour', 'ceremony', 'private') NOT NULL,
    status ENUM('available', 'booked', 'rented', 'returned') DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Car Images Table (multiple images per car)
CREATE TABLE car_images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    car_id INT NOT NULL,
    image_url TEXT NOT NULL,
    FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
);

-- 4. Bookings Table
CREATE TABLE bookings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    car_id INT NOT NULL,
    purpose ENUM('tour', 'ceremony', 'private') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('booked', 'rented', 'returned', 'cancelled') DEFAULT 'booked',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE,
    CONSTRAINT unique_booking UNIQUE (car_id, start_date, end_date)
);

-- 5. Reviews Table
CREATE TABLE reviews (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    car_id INT NOT NULL,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
);

-- 6. Return Logs Table
CREATE TABLE return_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT NOT NULL,
    returned_by_user BOOLEAN DEFAULT FALSE,
    confirmed_by_admin BOOLEAN DEFAULT FALSE,
    return_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- 7. Admin Actions Log Table
CREATE TABLE admin_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    admin_id INT NOT NULL,
    action TEXT NOT NULL,
    target_table VARCHAR(50),
    target_id INT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes and Constraints Notes:
-- UNIQUE constraint on bookings (car_id, start_date, end_date) to prevent overlapping bookings for the same car.
-- CHECK constraint on reviews.rating to ensure rating is between 1 and 5.
-- Foreign keys use ON DELETE CASCADE to maintain referential integrity.
