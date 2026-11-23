-- =====================================================================
--  03_seed.sql  |  DML: INSERT / UPDATE / DELETE demonstration data
--  All dates are relative to CURDATE() so the demo always looks "live".
--  Demo password for every account:  Password@123   (bcrypt hash below)
-- =====================================================================
USE maison_aurelia;
SET @app_user_id = NULL;

-- ---------------------------------------------------------------------
-- RBAC
-- ---------------------------------------------------------------------
INSERT INTO roles (role_name, description) VALUES
  ('admin',        'Full control: staff, audit log, configuration and every operational permission'),
  ('manager',      'Operations & revenue: reports, service catalogue, reviews and front-desk powers'),
  ('receptionist', 'Front desk: reservations, check-in/out, payments, rooms and housekeeping'),
  ('guest',        'Hotel guest: books own stays, orders services and writes reviews');

INSERT INTO permissions (code, description) VALUES
  ('dashboard.view',           'Open the staff dashboard'),
  ('reservations.view_all',    'See every reservation'),
  ('reservations.manage',      'Check-in, check-out, confirm and cancel any reservation'),
  ('reservations.book_for_guest','Create a reservation on behalf of a guest'),
  ('payments.record',          'Record payments on a reservation'),
  ('rooms.manage',             'Change room status'),
  ('guests.view',              'See the guest directory'),
  ('housekeeping.manage',      'Assign and complete housekeeping tasks'),
  ('services.manage',          'Edit the services catalogue'),
  ('orders.manage',            'Update service order status'),
  ('reviews.moderate',         'Reply to or remove any guest review'),
  ('reports.view',             'Open analytics and SQL reports'),
  ('staff.manage',             'Manage employees and user accounts'),
  ('audit.view',               'Read the audit log'),
  ('inventory.manage',         'Create and edit room types, rooms and photos'),
  ('settings.manage',          'Edit hotel settings, policies and website content'),
  ('booking.own',              'Book and manage own reservations'),
  ('reviews.write',            'Write and edit own reviews');

-- admin gets everything
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r CROSS JOIN permissions p WHERE r.role_name = 'admin';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r JOIN permissions p
 WHERE r.role_name = 'manager'
   AND p.code IN ('dashboard.view','reservations.view_all','reservations.manage','reservations.book_for_guest',
                  'payments.record','rooms.manage','guests.view','housekeeping.manage','services.manage',
                  'orders.manage','reviews.moderate','reports.view','inventory.manage');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r JOIN permissions p
 WHERE r.role_name = 'receptionist'
   AND p.code IN ('dashboard.view','reservations.view_all','reservations.manage','reservations.book_for_guest',
                  'payments.record','rooms.manage','guests.view','housekeeping.manage','orders.manage');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r JOIN permissions p
 WHERE r.role_name = 'guest' AND p.code IN ('booking.own','reviews.write');


-- ---------------------------------------------------------------------
-- HOTEL SETTINGS & WEBSITE CONTENT (the UI reads everything from here)
-- Text values may contain {placeholders}: {rooms}, {spa_treatment_rooms}, {free_cancel_hours}, ...
-- ---------------------------------------------------------------------
INSERT INTO hotel_settings (setting_key, setting_value, value_type, group_name, label, help_text, sort_order) VALUES
  ('hotel_name',        'Maison Aurelia',                      'text',   'General',  'Hotel name',            'Shown in the header, footer and browser title', 1),
  ('hotel_tagline',     'Hotel & Residences',                  'text',   'General',  'Tagline',               'Small line under the logo', 2),
  ('neighbourhood',     'Old Fort District',                   'text',   'General',  'Neighbourhood',         'Shown above the hero headline', 3),
  ('established_year',  '1924',                                'number', 'General',  'Established (year)',    NULL, 4),
  ('address',           '12 Heritage Lane, Old Fort District', 'text',   'General',  'Address',               NULL, 5),
  ('phone',             '+91 98100 00000',                     'text',   'General',  'Phone',                 NULL, 6),
  ('email',             'stay@maisonaurelia.com',              'text',   'General',  'Contact email',         NULL, 7),
  ('spa_treatment_rooms','11',                                 'number', 'General',  'Spa treatment rooms',   'Used in marketing copy', 8),
  ('tax_rate_pct',      '12',                                  'number', 'Policies', 'GST / tax rate (%)',    'Applied to every new reservation by sp_create_reservation', 1),
  ('deposit_pct',       '25',                                  'number', 'Policies', 'Deposit to confirm (%)','Trigger trg_pay_ai confirms a booking once this share is paid', 2),
  ('free_cancel_hours', '48',                                  'number', 'Policies', 'Free cancellation (hours before arrival)', 'Inside this window a cancellation is non-refundable', 3),
  ('max_stay_nights',   '30',                                  'number', 'Policies', 'Maximum stay (nights)', NULL, 4),
  ('max_rooms_per_booking','5',                               'number', 'Policies', 'Maximum rooms per booking', 'Multi-room bookings are created atomically by sp_create_booking', 5),
  ('require_verified_email','0',                              'number', 'Policies', 'Require a verified email to book (1 = yes)', 'Guests verify through the link emailed at sign-up', 6),
  ('loyalty_inr_per_point','100',                              'number', 'Loyalty',  'Rupees per loyalty point', 'Points are awarded at check-out', 1),
  ('loyalty_gold_points','2000',                               'number', 'Loyalty',  'Points for Gold tier',  NULL, 2),
  ('loyalty_platinum_points','6000',                           'number', 'Loyalty',  'Points for Platinum tier', NULL, 3),
  ('hero_headline_lead','A quiet kind of',                     'text',   'Website', 'Hero headline',         NULL, 1),
  ('hero_headline_accent','luxury.',                           'text',   'Website', 'Hero headline (gold italic part)', NULL, 2),
  ('hero_subtitle',     '{rooms} rooms, one courtyard pool and a team that remembers your name. Stay where the city slows down.', 'longtext', 'Website', 'Hero subtitle', '{rooms} is replaced by the live room count', 3),
  ('story_headline_lead','Considered in every',                'text',   'Website', 'Story headline',        NULL, 4),
  ('story_headline_accent','detail',                           'text',   'Website', 'Story headline (gold italic part)', NULL, 5),
  ('story_text',        'Our rooms are limited by design. With only {rooms} keys, we can know each guest, anticipate what they need and still leave room for surprise. It is a way of hosting that the grand hotels of the past understood, rebuilt for today.', 'longtext', 'Website', 'Story paragraph', NULL, 6),
  ('cta_headline_lead', 'Your room is',                        'text',   'Website', 'Closing call-to-action headline', NULL, 7),
  ('cta_headline_accent','waiting.',                           'text',   'Website', 'Closing headline (gold italic part)', NULL, 8),
  ('cta_text',          'Book directly for free cancellation, loyalty points and a welcome drink on arrival.', 'longtext', 'Website', 'Closing call-to-action text', NULL, 9),
  ('footer_blurb',      'A boutique hotel of {rooms} rooms where every detail is considered and nothing is hurried.', 'longtext', 'Website', 'Footer blurb', NULL, 10),
  ('demo_logins_enabled','1',                                  'number', 'Demo',     'Show demo accounts on the login page (1 = yes, 0 = no)', 'Turn off before going live', 1),
  ('demo_password_hint','Password@123',                        'text',   'Demo',     'Demo password shown on the login page', NULL, 2);

INSERT INTO site_features (icon, title, description, sort_order) VALUES
  ('bell',    'Personal butlers',  'On call in every suite, around the clock', 1),
  ('waves',   'Courtyard pool',    'Heated year-round, candle-lit after dusk', 2),
  ('sparkles','Aurelia Spa',       '{spa_treatment_rooms} treatment rooms and a private hammam', 3),
  ('shield',  'Free cancellation', 'Up to {free_cancel_hours} hours before arrival', 4);

INSERT INTO service_categories (category, title, tagline, image_url, show_on_home, sort_order) VALUES
  ('spa',        'Spa & Wellness', 'Hammam, botanical rituals and a thermal pool open until midnight.',     'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1100&q=80', TRUE, 1),
  ('dining',     'Dining',         'Seasonal tasting menus and private rooftop tables under the stars.',   'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=1100&q=80', TRUE, 2),
  ('experience', 'Experiences',    'Sunset cruises, heritage walks and sunrise yoga on the lawn.',         'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=1100&q=80', TRUE, 3),
  ('transport',  'Chauffeur',      'Airport meet-and-greet and a private driver at any hour.',             'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1100&q=80', TRUE, 4),
  ('laundry',    'Laundry',        'Same-day wash, press and fold.',                                       NULL, FALSE, 5);

INSERT INTO site_media (media_key, url, alt) VALUES
  ('hero',       'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=2400&q=80', 'Courtyard pool at dusk'),
  ('story_main', 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1000&q=80', 'Courtyard pool'),
  ('story_a',    'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=700&q=80', 'Stone bath'),
  ('story_b',    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=700&q=80', 'Spa'),
  ('cta',        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=2000&q=80', 'Pool at evening'),
  ('login_side', 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1600&q=80', 'Suite interior');

-- ---------------------------------------------------------------------
-- USERS  (password for all = Password@123)
-- ---------------------------------------------------------------------
INSERT INTO users (role_id, email, password_hash, full_name, phone) VALUES
  ((SELECT role_id FROM roles WHERE role_name='admin'),        'admin@maisonaurelia.com',     '$2b$10$du1TdX0uEs8bHHJDmvKTFuFcMoKJDPYyKwAJLct1sce35qKL07z3y', 'Monish R',   '+91 98100 00001'),
  ((SELECT role_id FROM roles WHERE role_name='manager'),      'manager@maisonaurelia.com',   '$2b$10$du1TdX0uEs8bHHJDmvKTFuFcMoKJDPYyKwAJLct1sce35qKL07z3y', 'Nanditha A',    '+91 98100 00002'),
  ((SELECT role_id FROM roles WHERE role_name='receptionist'), 'frontdesk@maisonaurelia.com', '$2b$10$du1TdX0uEs8bHHJDmvKTFuFcMoKJDPYyKwAJLct1sce35qKL07z3y', 'Arora Mehtha',  '+91 98100 00003'),
  ((SELECT role_id FROM roles WHERE role_name='guest'),        'guest@maisonaurelia.com',     '$2b$10$du1TdX0uEs8bHHJDmvKTFuFcMoKJDPYyKwAJLct1sce35qKL07z3y', 'Sakshi Khanna', '+91 98100 00004');

-- demo accounts are pre-verified; accounts created through /register start unverified
UPDATE users SET email_verified_at = NOW(), is_demo = TRUE;

-- ---------------------------------------------------------------------
-- DEPARTMENTS & EMPLOYEES (reporting hierarchy)
-- ---------------------------------------------------------------------
INSERT INTO departments (name) VALUES
  ('Executive'), ('Front Office'), ('Housekeeping'), ('Food & Beverage'),
  ('Spa & Wellness'), ('Engineering'), ('Concierge');

INSERT INTO employees (user_id, department_id, manager_id, full_name, job_title, hire_date, monthly_salary) VALUES
  (1,    1, NULL, 'Monish R',        'General Manager',        '2018-03-12', 320000),
  (2,    1, 1,    'Nanditha A',         'Operations Manager',     '2019-07-01', 210000),
  (3,    2, 2,    'Arora Mehtha',       'Front Office Manager',   '2020-01-15',  95000),
  (NULL, 2, 3,    'Kavya Menon',        'Senior Receptionist',    '2021-05-20',  52000),
  (NULL, 2, 3,    'Imran Sheikh',       'Receptionist',           '2023-02-10',  38000),
  (NULL, 3, 2,    'Lakshmi Pillai',     'Executive Housekeeper',  '2019-09-09',  88000),
  (NULL, 3, 6,    'Sunita Yadav',       'Floor Supervisor',       '2021-01-04',  46000),
  (NULL, 3, 7,    'Ramesh Kumar',       'Room Attendant',         '2022-06-18',  28000),
  (NULL, 3, 7,    'Geeta Joshi',        'Room Attendant',         '2023-08-21',  27500),
  (NULL, 4, 2,    'Marco Bianchi',      'Executive Chef',         '2019-04-02', 175000),
  (NULL, 4, 2,    'Tarun Bhatia',       'Restaurant Manager',     '2020-11-11',  92000),
  (NULL, 4, 10,   'Ishaan Rao',         'Sous Chef',              '2022-03-14',  68000),
  (NULL, 5, 2,    'Noor Fatima',        'Head Therapist',         '2021-10-05',  74000),
  (NULL, 6, 2,    'Deepak Chauhan',     'Chief Engineer',         '2018-12-01',  98000),
  (NULL, 6, 14,   'Vijay Patil',        'Maintenance Technician', '2022-09-12',  36000),
  (NULL, 7, 3,    'Alisha D''Souza',    'Head Concierge',         '2020-06-22',  64000);

-- ---------------------------------------------------------------------
-- ROOM TYPES, AMENITIES, ROOMS
-- ---------------------------------------------------------------------
INSERT INTO room_types (slug, name, tagline, description, base_price, max_adults, max_children, size_sqm, bed_type, view_type, image_url) VALUES
 ('deluxe-garden', 'Deluxe Garden Room', 'A calm, light-filled retreat above the gardens',
  'Warm linens, hand-finished walnut and a deep-pile rug set the tone. Wake to birdsong, order breakfast to the bed, and unwind in a marble bath stocked with our signature botanicals.',
  8500, 2, 1, 42, 'King bed', 'Garden view',
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1600&q=80'),
 ('premier-terrace', 'Premier Terrace Room', 'Teak floors, floor-to-ceiling glass, a private terrace',
  'Sliding glass doors open the whole room to a sun-drenched terrace. Teak flooring, a daybed built for lazy afternoons and a spa-grade soaking tub make this our most requested room.',
  11500, 2, 1, 52, 'King bed', 'Terrace & pool view',
  'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1600&q=80'),
 ('heritage-executive-suite', 'Heritage Executive Suite', 'Classic elegance with a separate lounge',
  'Silk drapes, a tufted chesterfield and a writing desk recall the grand hotels of another era - quietly upgraded with every modern comfort and a dedicated butler on call.',
  19500, 3, 2, 72, 'King bed + lounge', 'Courtyard view',
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1600&q=80'),
 ('garden-pavilion-villa', 'Garden Pavilion Villa', 'A detached pavilion wrapped in tropical greenery',
  'Carved timber, a sunken bath open to the garden and a private plunge pool. The pavilion is the closest thing to a secret in the hotel - request the one with the outdoor rain shower.',
  24000, 3, 1, 85, 'King bed', 'Private garden',
  'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1600&q=80'),
 ('skyline-family-suite', 'Skyline Family Suite', 'Two bedrooms, one dining table, zero compromise',
  'A full living and dining room with a connecting second bedroom. Designed so families gather around the table in the evening and still have space to disappear in the morning.',
  28000, 4, 3, 96, '1 King + 2 Twin', 'Skyline view',
  'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=1600&q=80'),
 ('royal-presidential-suite', 'Royal Presidential Suite', 'The pinnacle of Maison Aurelia',
  'Our 160 sqm signature residence: a sunken marble bath behind glass, a private dining salon, a personal butler and a chauffeured car at your disposal for the length of your stay.',
  65000, 4, 2, 160, 'Emperor bed', 'Panoramic view',
  'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1600&q=80');

INSERT INTO amenities (name, icon) VALUES
  ('Rainfall Shower', 'shower'),   ('High-Speed Wi-Fi', 'wifi'),    ('Smart TV', 'tv'),
  ('Espresso Machine', 'coffee'),  ('Private Balcony', 'sun'),      ('Curated Mini Bar', 'wine'),
  ('Soaking Bathtub', 'bath'),     ('Climate Control', 'thermometer'), ('In-room Safe', 'lock'),
  ('Butler Service', 'bell'),      ('Private Plunge Pool', 'waves'), ('Work Desk', 'laptop');

-- Amenity matrix: every type gets the basics, higher tiers get more
INSERT INTO room_type_amenities (type_id, amenity_id)
SELECT t.type_id, a.amenity_id
  FROM room_types t JOIN amenities a
 WHERE a.name IN ('Rainfall Shower','High-Speed Wi-Fi','Smart TV','Climate Control','In-room Safe');

INSERT INTO room_type_amenities (type_id, amenity_id)
SELECT t.type_id, a.amenity_id FROM room_types t JOIN amenities a
 WHERE t.slug <> 'deluxe-garden' AND a.name IN ('Espresso Machine','Curated Mini Bar','Work Desk');
INSERT INTO room_type_amenities (type_id, amenity_id)
SELECT t.type_id, a.amenity_id FROM room_types t JOIN amenities a
 WHERE t.slug = 'deluxe-garden' AND a.name IN ('Espresso Machine','Work Desk');
INSERT INTO room_type_amenities (type_id, amenity_id)
SELECT t.type_id, a.amenity_id FROM room_types t JOIN amenities a
 WHERE t.slug IN ('premier-terrace','heritage-executive-suite','garden-pavilion-villa','royal-presidential-suite')
   AND a.name IN ('Private Balcony','Soaking Bathtub');
INSERT INTO room_type_amenities (type_id, amenity_id)
SELECT t.type_id, a.amenity_id FROM room_types t JOIN amenities a
 WHERE t.slug IN ('heritage-executive-suite','garden-pavilion-villa','royal-presidential-suite','skyline-family-suite')
   AND a.name = 'Butler Service';
INSERT INTO room_type_amenities (type_id, amenity_id)
SELECT t.type_id, a.amenity_id FROM room_types t JOIN amenities a
 WHERE t.slug IN ('garden-pavilion-villa','royal-presidential-suite') AND a.name = 'Private Plunge Pool';

-- 32 rooms: floor n hosts room type n (101-108, 201-208, ...)
INSERT INTO rooms (type_id, room_number, floor_no)
SELECT t.type_id, n.num, FLOOR(n.num / 100)
  FROM room_types t
  JOIN (SELECT 101 AS num UNION ALL SELECT 102 UNION ALL SELECT 103 UNION ALL SELECT 104
        UNION ALL SELECT 105 UNION ALL SELECT 106 UNION ALL SELECT 107 UNION ALL SELECT 108
        UNION ALL SELECT 201 UNION ALL SELECT 202 UNION ALL SELECT 203 UNION ALL SELECT 204
        UNION ALL SELECT 205 UNION ALL SELECT 206 UNION ALL SELECT 207 UNION ALL SELECT 208
        UNION ALL SELECT 301 UNION ALL SELECT 302 UNION ALL SELECT 303 UNION ALL SELECT 304
        UNION ALL SELECT 305 UNION ALL SELECT 306
        UNION ALL SELECT 401 UNION ALL SELECT 402 UNION ALL SELECT 403 UNION ALL SELECT 404
        UNION ALL SELECT 501 UNION ALL SELECT 502 UNION ALL SELECT 503 UNION ALL SELECT 504
        UNION ALL SELECT 601 UNION ALL SELECT 602) n
    ON t.type_id = FLOOR(n.num / 100);

-- ---------------------------------------------------------------------
-- SERVICES
-- ---------------------------------------------------------------------
INSERT INTO services (name, category, description, price) VALUES
  ('In-room Breakfast',           'dining',     'A seasonal breakfast tray served at the hour of your choice',      1200),
  ('Chef''s Tasting Dinner',      'dining',     'Seven courses by our Executive Chef with wine pairing',            6500),
  ('Private Rooftop Dinner',      'dining',     'A candle-lit table for two under the stars with a personal waiter', 18000),
  ('Signature Aurelia Massage',   'spa',        '60-minute full-body ritual with warm botanical oils',               5500),
  ('Couple''s Spa Ritual',        'spa',        '90 minutes side by side: scrub, massage and herbal steam',         12000),
  ('Hammam & Scrub',              'spa',        'Traditional steam bath followed by a full-body exfoliation',        4200),
  ('Airport Transfer (Sedan)',    'transport',  'Meet-and-greet and private chauffeur to or from the airport',       2800),
  ('Chauffeur Half-day',          'transport',  'Four hours with a private driver and car',                          6000),
  ('Express Laundry',             'laundry',    'Same-day wash, press and fold',                                      900),
  ('Dry Cleaning (per suit)',     'laundry',    'Hand-finished dry cleaning returned in 24 hours',                   1100),
  ('Sunset Yacht Cruise',         'experience', 'Two hours on a private yacht with canapes and champagne',          15000),
  ('Guided Heritage Walk',        'experience', 'Morning walk through the old city with a historian',                 2500),
  ('Sunrise Yoga',                'experience', 'Private yoga session on the lawn at dawn',                           1000),
  ('Cooking Masterclass',         'experience', 'Learn three signature dishes in our show kitchen',                   4800);

-- ---------------------------------------------------------------------
-- GUESTS
-- ---------------------------------------------------------------------
INSERT INTO guests (user_id, full_name, email, phone, country) VALUES
  (4,    'Sakshi Khanna',    'guest@maisonaurelia.com',      '+91 98100 00004', 'India'),
  (NULL, 'Vikram Singh',     'vikram.singh@example.com',     '+91 98111 22334', 'India'),
  (NULL, 'Meera Iyer',       'meera.iyer@example.com',       '+91 98222 33445', 'India'),
  (NULL, 'Arjun Reddy',      'arjun.reddy@example.com',      '+91 98333 44556', 'India'),
  (NULL, 'Sofia Rossi',      'sofia.rossi@example.com',      '+39 333 1234567', 'Italy'),
  (NULL, 'James Carter',     'james.carter@example.com',     '+44 7700 900123', 'United Kingdom'),
  (NULL, 'Priyanka Das',     'priyanka.das@example.com',     '+91 98444 55667', 'India'),
  (NULL, 'Kabir Malhotra',   'kabir.malhotra@example.com',   '+91 98555 66778', 'India'),
  (NULL, 'Isabella Laurent', 'isabella.laurent@example.com', '+33 6 12 34 56 78', 'France'),
  (NULL, 'Rahul Verma',      'rahul.verma@example.com',      '+91 98666 77889', 'India'),
  (NULL, 'Naomi Tanaka',     'naomi.tanaka@example.com',     '+81 90 1234 5678', 'Japan'),
  (NULL, 'Daniel Okafor',    'daniel.okafor@example.com',    '+234 802 123 4567', 'Nigeria'),
  (NULL, 'Sneha Kulkarni',   'sneha.kulkarni@example.com',   '+91 98777 88990', 'India'),
  (NULL, 'Omar Haddad',      'omar.haddad@example.com',      '+971 50 123 4567', 'UAE');

-- ---------------------------------------------------------------------
-- RESERVATIONS  (temporary helper procedure keeps the seed readable)
-- ---------------------------------------------------------------------
DELIMITER $$
CREATE PROCEDURE sp_seed_res(
  IN p_email VARCHAR(120), IN p_room VARCHAR(10), IN p_offset INT, IN p_nights INT,
  IN p_status VARCHAR(20), IN p_adults INT, IN p_children INT, IN p_note VARCHAR(500))
BEGIN
  DECLARE v_guest INT UNSIGNED;
  DECLARE v_room  INT UNSIGNED;
  DECLARE v_rate  DECIMAL(10,2);
  DECLARE v_sub   DECIMAL(12,2);
  DECLARE v_tax   DECIMAL(10,2);
  DECLARE v_in    DATE;

  SELECT guest_id INTO v_guest FROM guests WHERE email = p_email;
  SELECT r.room_id, t.base_price INTO v_room, v_rate
    FROM rooms r JOIN room_types t ON t.type_id = r.type_id WHERE r.room_number = p_room;

  SET v_in  = DATE_ADD(CURDATE(), INTERVAL p_offset DAY);
  SET v_sub = v_rate * p_nights;
  SET v_tax = ROUND(v_sub * fn_setting_num('tax_rate_pct', 12) / 100, 2);

  INSERT INTO reservations
    (reservation_code, guest_id, room_id, check_in, check_out, adults, children, status,
     nightly_rate, tax_amount, total_amount, special_requests, created_at, checked_in_at, checked_out_at)
  VALUES
    (CONCAT('MA', UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 8))),
     v_guest, v_room, v_in, DATE_ADD(v_in, INTERVAL p_nights DAY), p_adults, p_children, p_status,
     v_rate, v_tax, v_sub + v_tax, p_note,
     DATE_SUB(v_in, INTERVAL 9 DAY),
     IF(p_status IN ('checked_in','checked_out'), TIMESTAMP(v_in, '14:20:00'), NULL),
     IF(p_status = 'checked_out', TIMESTAMP(DATE_ADD(v_in, INTERVAL p_nights DAY), '11:05:00'), NULL));
END$$
DELIMITER ;

-- history: checked-out stays
CALL sp_seed_res('vikram.singh@example.com',     '101', -60, 3, 'checked_out', 2, 0, NULL);
CALL sp_seed_res('meera.iyer@example.com',       '201', -55, 2, 'checked_out', 2, 0, 'Late check-out if possible');
CALL sp_seed_res('arjun.reddy@example.com',      '301', -50, 4, 'checked_out', 2, 1, NULL);
CALL sp_seed_res('sofia.rossi@example.com',      '401', -48, 5, 'checked_out', 2, 0, 'Anniversary - rose petals please');
CALL sp_seed_res('james.carter@example.com',     '601', -45, 3, 'checked_out', 2, 0, NULL);
CALL sp_seed_res('guest@maisonaurelia.com',      '102', -40, 2, 'checked_out', 2, 0, NULL);
CALL sp_seed_res('priyanka.das@example.com',     '202', -38, 3, 'checked_out', 2, 0, NULL);
CALL sp_seed_res('kabir.malhotra@example.com',   '501', -35, 4, 'checked_out', 2, 2, 'Two extra cots');
CALL sp_seed_res('isabella.laurent@example.com', '302', -30, 2, 'checked_out', 2, 0, NULL);
CALL sp_seed_res('guest@maisonaurelia.com',      '301', -25, 3, 'checked_out', 2, 0, 'High floor, quiet side');
CALL sp_seed_res('rahul.verma@example.com',      '103', -22, 2, 'checked_out', 1, 0, NULL);
CALL sp_seed_res('naomi.tanaka@example.com',     '203', -20, 4, 'checked_out', 2, 0, NULL);
CALL sp_seed_res('daniel.okafor@example.com',    '402', -18, 2, 'checked_out', 2, 0, NULL);
CALL sp_seed_res('vikram.singh@example.com',     '303', -15, 3, 'checked_out', 2, 1, NULL);
CALL sp_seed_res('sneha.kulkarni@example.com',   '104', -12, 2, 'checked_out', 2, 0, NULL);
CALL sp_seed_res('omar.haddad@example.com',      '204', -10, 3, 'checked_out', 2, 0, 'Halal breakfast');
CALL sp_seed_res('guest@maisonaurelia.com',      '601',  -9, 2, 'checked_out', 2, 0, 'Birthday weekend');
CALL sp_seed_res('meera.iyer@example.com',       '502',  -8, 3, 'checked_out', 3, 1, NULL);
CALL sp_seed_res('james.carter@example.com',     '105',  -6, 2, 'checked_out', 2, 0, NULL);
CALL sp_seed_res('arjun.reddy@example.com',      '202',-150, 3, 'checked_out', 2, 0, NULL);
CALL sp_seed_res('sofia.rossi@example.com',      '301',-140, 4, 'checked_out', 2, 0, NULL);
CALL sp_seed_res('isabella.laurent@example.com', '401',-130, 2, 'checked_out', 2, 0, NULL);
CALL sp_seed_res('kabir.malhotra@example.com',   '103',-120, 3, 'checked_out', 2, 0, NULL);
CALL sp_seed_res('naomi.tanaka@example.com',     '501',-110, 5, 'checked_out', 2, 1, NULL);
CALL sp_seed_res('daniel.okafor@example.com',    '601',-100, 2, 'checked_out', 2, 0, NULL);
CALL sp_seed_res('priyanka.das@example.com',     '204', -90, 3, 'checked_out', 2, 0, NULL);
CALL sp_seed_res('rahul.verma@example.com',      '304', -80, 4, 'checked_out', 2, 0, NULL);
CALL sp_seed_res('sneha.kulkarni@example.com',   '106', -75, 2, 'checked_out', 2, 0, NULL);
-- cancelled / no-show
CALL sp_seed_res('rahul.verma@example.com',      '205',  10, 3, 'cancelled',   2, 0, 'Change of plans');
CALL sp_seed_res('omar.haddad@example.com',      '302',  20, 2, 'cancelled',   2, 0, NULL);
CALL sp_seed_res('daniel.okafor@example.com',    '105',  -3, 1, 'no_show',     1, 0, NULL);
-- in-house right now
CALL sp_seed_res('james.carter@example.com',     '303',  -2, 4, 'checked_in',  2, 0, NULL);
CALL sp_seed_res('isabella.laurent@example.com', '205',  -1, 3, 'checked_in',  2, 0, 'Vegetarian menu');
CALL sp_seed_res('naomi.tanaka@example.com',     '502',  -3, 5, 'checked_in',  2, 1, NULL);
CALL sp_seed_res('priyanka.das@example.com',     '402',  -1, 2, 'checked_in',  2, 0, NULL);
CALL sp_seed_res('kabir.malhotra@example.com',   '602',   0, 3, 'checked_in',  2, 0, 'Champagne on arrival');
CALL sp_seed_res('arjun.reddy@example.com',      '404',  -3, 3, 'checked_in',  2, 0, NULL);
CALL sp_seed_res('meera.iyer@example.com',       '207',  -2, 2, 'checked_in',  2, 0, NULL);
-- arriving today
CALL sp_seed_res('guest@maisonaurelia.com',      '106',   0, 2, 'confirmed',   2, 0, 'Early check-in requested');
CALL sp_seed_res('vikram.singh@example.com',     '206',   0, 3, 'confirmed',   2, 0, NULL);
CALL sp_seed_res('sneha.kulkarni@example.com',   '304',   0, 2, 'confirmed',   2, 0, NULL);
-- upcoming
CALL sp_seed_res('guest@maisonaurelia.com',      '602',  14, 3, 'confirmed',   2, 0, 'Surprise dinner on night two');
CALL sp_seed_res('sofia.rossi@example.com',      '301',   3, 4, 'confirmed',   2, 0, NULL);
CALL sp_seed_res('daniel.okafor@example.com',    '107',   5, 2, 'pending',     2, 0, NULL);
CALL sp_seed_res('omar.haddad@example.com',      '201',   7, 3, 'confirmed',   2, 0, NULL);
CALL sp_seed_res('rahul.verma@example.com',      '503',   9, 4, 'pending',     3, 2, NULL);
CALL sp_seed_res('vikram.singh@example.com',     '401',  12, 2, 'confirmed',   2, 0, NULL);
CALL sp_seed_res('meera.iyer@example.com',       '101',   1, 3, 'confirmed',   2, 0, NULL);
CALL sp_seed_res('priyanka.das@example.com',     '102',   2, 4, 'confirmed',   2, 0, NULL);
CALL sp_seed_res('kabir.malhotra@example.com',   '103',   2, 3, 'confirmed',   2, 1, NULL);
CALL sp_seed_res('arjun.reddy@example.com',      '104',   4, 3, 'confirmed',   2, 0, NULL);
CALL sp_seed_res('sneha.kulkarni@example.com',   '105',   4, 2, 'pending',     2, 0, NULL);
CALL sp_seed_res('rahul.verma@example.com',      '202',   1, 5, 'confirmed',   2, 0, NULL);
CALL sp_seed_res('naomi.tanaka@example.com',     '203',   3, 4, 'confirmed',   2, 0, NULL);
CALL sp_seed_res('james.carter@example.com',     '204',   6, 3, 'confirmed',   2, 0, NULL);
CALL sp_seed_res('isabella.laurent@example.com', '208',   2, 3, 'confirmed',   2, 0, NULL);
CALL sp_seed_res('omar.haddad@example.com',      '305',   6, 3, 'confirmed',   3, 0, NULL);
CALL sp_seed_res('daniel.okafor@example.com',    '306',   8, 2, 'confirmed',   2, 0, NULL);
CALL sp_seed_res('vikram.singh@example.com',     '403',  10, 3, 'confirmed',   2, 0, NULL);
CALL sp_seed_res('sofia.rossi@example.com',      '504',   5, 4, 'confirmed',   4, 2, 'Connecting rooms if possible');
CALL sp_seed_res('sneha.kulkarni@example.com',   '601',   4, 3, 'confirmed',   2, 0, 'Anniversary dinner');
CALL sp_seed_res('priyanka.das@example.com',     '401',   2, 3, 'confirmed',   2, 0, NULL);
CALL sp_seed_res('meera.iyer@example.com',       '302',  10, 3, 'confirmed',   2, 0, NULL);
CALL sp_seed_res('arjun.reddy@example.com',      '303',   6, 4, 'confirmed',   2, 1, NULL);
CALL sp_seed_res('kabir.malhotra@example.com',   '501',   3, 3, 'confirmed',   2, 2, NULL);
CALL sp_seed_res('naomi.tanaka@example.com',     '206',   5, 3, 'confirmed',   2, 0, NULL);
CALL sp_seed_res('isabella.laurent@example.com', '302',  25, 3, 'pending',     2, 0, NULL);

DROP PROCEDURE sp_seed_res;

-- ---------------------------------------------------------------------
-- SERVICE ORDERS: deterministic spread (every service gets ordered by some stays)
-- ---------------------------------------------------------------------
INSERT INTO service_orders (reservation_id, service_id, quantity, unit_price, status, ordered_at)
SELECT r.reservation_id, s.service_id,
       1 + (r.reservation_id + s.service_id) % 2,
       0,                                                 -- trigger fills the current price
       IF(r.status = 'checked_out', 'delivered', 'confirmed'),
       TIMESTAMP(DATE_ADD(r.check_in, INTERVAL 1 DAY), '19:30:00')
  FROM reservations r
  JOIN services s
    ON (r.reservation_id * 5 + s.service_id * 3) % 7 = 0
 WHERE r.status IN ('checked_in','checked_out');

-- ---------------------------------------------------------------------
-- PAYMENTS
-- ---------------------------------------------------------------------
-- fully settled checked-out stays (room + services)
INSERT INTO payments (reservation_id, payment_type, method, amount, reference, paid_at)
SELECT r.reservation_id, 'payment',
       ELT(1 + r.reservation_id % 4, 'card', 'upi', 'cash', 'netbanking'),
       r.total_amount + IFNULL((SELECT SUM(so.quantity * so.unit_price) FROM service_orders so
                                 WHERE so.reservation_id = r.reservation_id), 0),
       CONCAT('PAY', LPAD(r.reservation_id, 9, '0')),
       r.checked_out_at
  FROM reservations r WHERE r.status = 'checked_out';

-- in-house: room charge paid at check-in, services still open
INSERT INTO payments (reservation_id, payment_type, method, amount, reference, paid_at)
SELECT r.reservation_id, 'payment',
       ELT(1 + r.reservation_id % 4, 'card', 'upi', 'cash', 'netbanking'),
       r.total_amount, CONCAT('PAY', LPAD(r.reservation_id, 9, '0')), r.checked_in_at
  FROM reservations r WHERE r.status = 'checked_in';

-- confirmed: 30% deposit
INSERT INTO payments (reservation_id, payment_type, method, amount, reference, paid_at)
SELECT r.reservation_id, 'payment', 'card',
       ROUND(r.total_amount * 0.30, 2), CONCAT('PAY', LPAD(r.reservation_id, 9, '0')), r.created_at
  FROM reservations r WHERE r.status = 'confirmed';

-- ---------------------------------------------------------------------
-- LOYALTY (UPDATE with correlated subquery) + ROOM STATE (UPDATE / DELETE demo)
-- ---------------------------------------------------------------------
UPDATE guests g
   SET g.loyalty_points = IFNULL((SELECT FLOOR(SUM(r.total_amount) / 100)
                                    FROM reservations r
                                   WHERE r.guest_id = g.guest_id AND r.status = 'checked_out'), 0);
UPDATE guests SET loyalty_tier = fn_loyalty_tier(loyalty_points);

UPDATE rooms SET status = 'cleaning'    WHERE room_number IN ('107', '305');
UPDATE rooms SET status = 'maintenance' WHERE room_number = '108';

INSERT INTO housekeeping_tasks (room_id, employee_id, task_type, status, created_at, completed_at)
SELECT r.room_id, 8, 'checkout_clean', 'in_progress', NOW() - INTERVAL 40 MINUTE, NULL FROM rooms r WHERE r.room_number = '107';
INSERT INTO housekeeping_tasks (room_id, employee_id, task_type, status, created_at, completed_at)
SELECT r.room_id, NULL, 'checkout_clean', 'pending', NOW() - INTERVAL 15 MINUTE, NULL FROM rooms r WHERE r.room_number = '305';
INSERT INTO housekeeping_tasks (room_id, employee_id, task_type, status, created_at, completed_at)
SELECT r.room_id, 15, 'maintenance', 'in_progress', NOW() - INTERVAL 1 DAY, NULL FROM rooms r WHERE r.room_number = '108';
INSERT INTO housekeeping_tasks (room_id, employee_id, task_type, status, created_at, completed_at)
SELECT r.room_id, 9, 'turndown', 'done', NOW() - INTERVAL 5 HOUR, NOW() - INTERVAL 4 HOUR FROM rooms r WHERE r.room_number = '303';
INSERT INTO housekeeping_tasks (room_id, employee_id, task_type, status, created_at, completed_at)
SELECT r.room_id, 8, 'deep_clean', 'done', NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY + INTERVAL 3 HOUR FROM rooms r WHERE r.room_number = '201';

-- DELETE demo: retire a service that is no longer offered (only if it was never ordered)
INSERT INTO services (name, category, description, price, is_active)
VALUES ('Legacy Welcome Cocktail', 'dining', 'Discontinued welcome drink', 600, FALSE);
DELETE FROM services
 WHERE name = 'Legacy Welcome Cocktail'
   AND NOT EXISTS (SELECT 1 FROM service_orders so WHERE so.service_id = services.service_id);

-- Start the audit trail clean for the live demo
DELETE FROM audit_log;
