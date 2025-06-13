-- Remove default values from price and base_rental_duration columns in cars table
ALTER TABLE cars DROP COLUMN price;
ALTER TABLE cars DROP COLUMN base_rental_duration;

ALTER TABLE cars ADD price INT NOT NULL;
ALTER TABLE cars ADD base_rental_duration INT NOT NULL;
