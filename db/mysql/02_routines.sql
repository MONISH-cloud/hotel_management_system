-- =====================================================================
--  02_routines.sql  |  Functions, stored procedures, triggers, views
--  The Node setup script understands the DELIMITER directive.
-- =====================================================================
USE maison_aurelia;

DELIMITER $$

-- =====================================================================
-- FUNCTIONS
-- =====================================================================

-- Number of nights between two dates
CREATE FUNCTION fn_nights(p_in DATE, p_out DATE)
RETURNS INT
DETERMINISTIC NO SQL
BEGIN
  RETURN DATEDIFF(p_out, p_in);
END$$

-- Numeric hotel setting (tax rate, deposit %, ...) with a safe default
CREATE FUNCTION fn_setting_num(p_key VARCHAR(60), p_default DECIMAL(14,4))
RETURNS DECIMAL(14,4)
READS SQL DATA
BEGIN
  DECLARE v DECIMAL(14,4);
  SELECT CAST(setting_value AS DECIMAL(14,4)) INTO v FROM hotel_settings WHERE setting_key = p_key;
  RETURN IFNULL(v, p_default);
END$$

-- Loyalty tier from accumulated points (thresholds are configurable settings)
CREATE FUNCTION fn_loyalty_tier(p_points INT)
RETURNS VARCHAR(10)
READS SQL DATA
BEGIN
  RETURN CASE
           WHEN p_points >= fn_setting_num('loyalty_platinum_points', 6000) THEN 'Platinum'
           WHEN p_points >= fn_setting_num('loyalty_gold_points', 2000)     THEN 'Gold'
           ELSE 'Silver'
         END;
END$$

-- Is a room free for [p_in, p_out) ?  (p_exclude lets us ignore one reservation when editing it)
CREATE FUNCTION fn_room_is_available(p_room INT UNSIGNED, p_in DATE, p_out DATE, p_exclude INT UNSIGNED)
RETURNS TINYINT
READS SQL DATA
BEGIN
  DECLARE v_status VARCHAR(20);
  SELECT status INTO v_status FROM rooms WHERE room_id = p_room;
  IF v_status IS NULL OR v_status = 'maintenance' THEN
    RETURN 0;
  END IF;
  RETURN NOT EXISTS (
    SELECT 1
      FROM reservations r
     WHERE r.room_id = p_room
       AND r.status IN ('pending','confirmed','checked_in')
       AND r.reservation_id <> IFNULL(p_exclude, 0)
       AND r.check_in  < p_out
       AND r.check_out > p_in
  );
END$$

-- Does a user hold a permission through their role?  (RBAC check inside the database)
CREATE FUNCTION fn_has_permission(p_user INT UNSIGNED, p_code VARCHAR(60))
RETURNS TINYINT
READS SQL DATA
BEGIN
  RETURN EXISTS (
    SELECT 1
      FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p       ON p.permission_id = rp.permission_id
     WHERE u.user_id = p_user AND u.is_active = TRUE AND p.code = p_code
  );
END$$

-- Outstanding balance = room total + services - net payments
CREATE FUNCTION fn_reservation_balance(p_res INT UNSIGNED)
RETURNS DECIMAL(12,2)
READS SQL DATA
BEGIN
  DECLARE v_total    DECIMAL(12,2) DEFAULT 0;
  DECLARE v_services DECIMAL(12,2) DEFAULT 0;
  DECLARE v_paid     DECIMAL(12,2) DEFAULT 0;

  SELECT total_amount INTO v_total FROM reservations WHERE reservation_id = p_res;

  SELECT IFNULL(SUM(quantity * unit_price), 0) INTO v_services
    FROM service_orders
   WHERE reservation_id = p_res AND status <> 'cancelled';

  SELECT IFNULL(SUM(CASE payment_type WHEN 'payment' THEN amount ELSE -amount END), 0) INTO v_paid
    FROM payments
   WHERE reservation_id = p_res;

  RETURN IFNULL(v_total, 0) + v_services - v_paid;
END$$

-- =====================================================================
-- STORED PROCEDURES
-- =====================================================================

-- Create a reservation: picks the first free room of the requested type,
-- prices it, and inserts inside one transaction.
CREATE PROCEDURE sp_create_reservation(
  IN  p_guest_id   INT UNSIGNED,
  IN  p_type_id    SMALLINT UNSIGNED,
  IN  p_check_in   DATE,
  IN  p_check_out  DATE,
  IN  p_adults     TINYINT UNSIGNED,
  IN  p_children   TINYINT UNSIGNED,
  IN  p_requests   VARCHAR(500),
  IN  p_created_by INT UNSIGNED,
  OUT p_reservation_id INT UNSIGNED)
BEGIN
  DECLARE v_room   INT UNSIGNED DEFAULT NULL;
  DECLARE v_rate   DECIMAL(10,2);
  DECLARE v_sub    DECIMAL(12,2);
  DECLARE v_tax    DECIMAL(10,2);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF p_check_in >= p_check_out THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Check-out must be after check-in';
  END IF;
  IF p_check_in < CURDATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Check-in date cannot be in the past';
  END IF;
  IF DATEDIFF(p_check_out, p_check_in) > fn_setting_num('max_stay_nights', 30) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The requested stay is longer than the maximum allowed';
  END IF;

  START TRANSACTION;

  -- Lock the room type row first: serialises concurrent bookings of the same type
  -- so two guests can never be given the same room (no double booking).
  SELECT base_price INTO v_rate FROM room_types WHERE type_id = p_type_id FOR UPDATE;
  IF v_rate IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unknown room type';
  END IF;

  SELECT r.room_id INTO v_room
    FROM rooms r
   WHERE r.type_id = p_type_id
     AND fn_room_is_available(r.room_id, p_check_in, p_check_out, NULL) = 1
   ORDER BY r.room_number
   LIMIT 1;

  IF v_room IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No room of this type is available for the selected dates';
  END IF;

  SET v_sub = fn_nights(p_check_in, p_check_out) * v_rate;
  SET v_tax = ROUND(v_sub * fn_setting_num('tax_rate_pct', 12) / 100, 2);   -- GST from hotel_settings

  INSERT INTO reservations
    (reservation_code, guest_id, room_id, check_in, check_out, adults, children,
     status, nightly_rate, tax_amount, total_amount, special_requests, created_by)
  VALUES
    (CONCAT('MA', UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 8))),
     p_guest_id, v_room, p_check_in, p_check_out, p_adults, p_children,
     'pending', v_rate, v_tax, v_sub + v_tax, p_requests, p_created_by);

  SET p_reservation_id = LAST_INSERT_ID();
  COMMIT;
END$$

-- Record a payment (cannot exceed the outstanding balance)
CREATE PROCEDURE sp_record_payment(
  IN  p_reservation_id INT UNSIGNED,
  IN  p_amount         DECIMAL(12,2),
  IN  p_method         VARCHAR(20),
  OUT p_reference      VARCHAR(24))
BEGIN
  DECLARE v_balance DECIMAL(12,2);
  DECLARE v_status  VARCHAR(20);

  SELECT status INTO v_status FROM reservations WHERE reservation_id = p_reservation_id;
  IF v_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reservation not found';
  END IF;
  IF v_status IN ('cancelled','no_show') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot take payment for a cancelled reservation';
  END IF;

  SET v_balance = fn_reservation_balance(p_reservation_id);
  IF p_amount <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment amount must be positive';
  END IF;
  IF p_amount > v_balance THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment exceeds the outstanding balance';
  END IF;

  SET p_reference = CONCAT('PAY', UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 12)));
  INSERT INTO payments (reservation_id, payment_type, method, amount, reference)
  VALUES (p_reservation_id, 'payment', p_method, p_amount, p_reference);
END$$

-- Check a guest in (room must be clean and ready)
CREATE PROCEDURE sp_check_in(IN p_reservation_id INT UNSIGNED)
BEGIN
  DECLARE v_status VARCHAR(20);
  DECLARE v_room   INT UNSIGNED;
  DECLARE v_in     DATE;
  DECLARE v_room_status VARCHAR(20);

  SELECT status, room_id, check_in INTO v_status, v_room, v_in
    FROM reservations WHERE reservation_id = p_reservation_id FOR UPDATE;

  IF v_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reservation not found';
  END IF;
  IF v_status NOT IN ('pending','confirmed') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only pending or confirmed reservations can be checked in';
  END IF;
  IF v_in > CURDATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Too early: check-in date has not arrived yet';
  END IF;

  SELECT status INTO v_room_status FROM rooms WHERE room_id = v_room;
  IF v_room_status <> 'available' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Room is not ready (cleaning, maintenance or occupied)';
  END IF;

  UPDATE reservations
     SET status = 'checked_in', checked_in_at = NOW()
   WHERE reservation_id = p_reservation_id;
END$$

-- Check a guest out: requires zero balance, awards loyalty points
CREATE PROCEDURE sp_check_out(IN p_reservation_id INT UNSIGNED)
BEGIN
  DECLARE v_status  VARCHAR(20);
  DECLARE v_guest   INT UNSIGNED;
  DECLARE v_total   DECIMAL(12,2);
  DECLARE v_balance DECIMAL(12,2);
  DECLARE v_points  INT UNSIGNED;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT status, guest_id, total_amount INTO v_status, v_guest, v_total
    FROM reservations WHERE reservation_id = p_reservation_id FOR UPDATE;

  IF v_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reservation not found';
  END IF;
  IF v_status <> 'checked_in' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only checked-in reservations can be checked out';
  END IF;

  SET v_balance = fn_reservation_balance(p_reservation_id);
  IF v_balance > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Outstanding balance must be settled before check-out';
  END IF;

  UPDATE reservations
     SET status = 'checked_out', checked_out_at = NOW()
   WHERE reservation_id = p_reservation_id;

  -- loyalty points: 1 point per N rupees spent (hotel_settings.loyalty_inr_per_point)
  SET v_points = FLOOR(v_total / fn_setting_num('loyalty_inr_per_point', 100));
  -- (tier is assigned first: MySQL evaluates SET assignments left-to-right)
  UPDATE guests
     SET loyalty_tier   = fn_loyalty_tier(loyalty_points + v_points),
         loyalty_points = loyalty_points + v_points
   WHERE guest_id = v_guest;

  COMMIT;
END$$

-- Cancel a reservation. Free cancellation window comes from hotel_settings (free_cancel_hours).
CREATE PROCEDURE sp_cancel_reservation(
  IN  p_reservation_id INT UNSIGNED,
  OUT p_refund DECIMAL(12,2))
BEGIN
  DECLARE v_status VARCHAR(20);
  DECLARE v_in     DATE;
  DECLARE v_net    DECIMAL(12,2);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT status, check_in INTO v_status, v_in
    FROM reservations WHERE reservation_id = p_reservation_id FOR UPDATE;

  IF v_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reservation not found';
  END IF;
  IF v_status NOT IN ('pending','confirmed') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only pending or confirmed reservations can be cancelled';
  END IF;

  SET p_refund = 0;
  SELECT IFNULL(SUM(CASE payment_type WHEN 'payment' THEN amount ELSE -amount END), 0)
    INTO v_net FROM payments WHERE reservation_id = p_reservation_id;

  IF v_net > 0 AND DATEDIFF(v_in, CURDATE()) * 24 >= fn_setting_num('free_cancel_hours', 48) THEN
    SET p_refund = v_net;
    INSERT INTO payments (reservation_id, payment_type, method, amount, reference)
    VALUES (p_reservation_id, 'refund', 'card', v_net,
            CONCAT('RFD', UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 12))));
  END IF;

  UPDATE reservations SET status = 'cancelled' WHERE reservation_id = p_reservation_id;
  COMMIT;
END$$

-- Monthly revenue (rooms + services) using a CTE
CREATE PROCEDURE sp_revenue_by_month(IN p_months INT)
BEGIN
  WITH room_rev AS (
    SELECT DATE_FORMAT(check_in, '%Y-%m') AS ym, SUM(total_amount) AS room_revenue
      FROM reservations
     WHERE status IN ('checked_in','checked_out')
       AND check_in >= DATE_SUB(CURDATE(), INTERVAL p_months MONTH)
     GROUP BY ym
  ),
  svc_rev AS (
    SELECT DATE_FORMAT(so.ordered_at, '%Y-%m') AS ym, SUM(so.quantity * so.unit_price) AS service_revenue
      FROM service_orders so
     WHERE so.status <> 'cancelled'
       AND so.ordered_at >= DATE_SUB(CURDATE(), INTERVAL p_months MONTH)
     GROUP BY ym
  )
  SELECT rr.ym                                            AS month,
         rr.room_revenue                                  AS room_revenue,
         IFNULL(sr.service_revenue, 0)                    AS service_revenue,
         rr.room_revenue + IFNULL(sr.service_revenue, 0)  AS total_revenue
    FROM room_rev rr
    LEFT JOIN svc_rev sr ON sr.ym = rr.ym
   ORDER BY rr.ym;
END$$

-- Daily occupancy for a date window using a RECURSIVE CTE to generate the calendar
CREATE PROCEDURE sp_occupancy_report(IN p_from DATE, IN p_days INT)
BEGIN
  WITH RECURSIVE calendar (d) AS (
    SELECT p_from
    UNION ALL
    SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM calendar WHERE d < DATE_ADD(p_from, INTERVAL p_days - 1 DAY)
  ),
  inventory AS (
    SELECT COUNT(*) AS total_rooms FROM rooms WHERE status <> 'maintenance'
  )
  SELECT c.d                                     AS stay_date,
         COUNT(r.reservation_id)                 AS occupied_rooms,
         i.total_rooms                           AS total_rooms,
         ROUND(100 * COUNT(r.reservation_id) / i.total_rooms, 1) AS occupancy_pct
    FROM calendar c
    CROSS JOIN inventory i
    LEFT JOIN reservations r
           ON r.status IN ('confirmed','checked_in','checked_out')
          AND c.d >= r.check_in AND c.d < r.check_out
   GROUP BY c.d, i.total_rooms
   ORDER BY c.d;
END$$

-- =====================================================================
-- TRIGGERS
-- =====================================================================

-- An employee cannot report to themselves
CREATE TRIGGER trg_emp_bu BEFORE UPDATE ON employees
FOR EACH ROW
BEGIN
  IF NEW.manager_id IS NOT NULL AND NEW.manager_id = NEW.employee_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'An employee cannot be their own manager';
  END IF;
END$$

-- Validate capacity + availability before a reservation is stored
CREATE TRIGGER trg_res_bi BEFORE INSERT ON reservations
FOR EACH ROW
BEGIN
  DECLARE v_max_adults   TINYINT UNSIGNED;
  DECLARE v_max_children TINYINT UNSIGNED;

  SELECT t.max_adults, t.max_children INTO v_max_adults, v_max_children
    FROM rooms r JOIN room_types t ON t.type_id = r.type_id
   WHERE r.room_id = NEW.room_id;

  IF NEW.adults > v_max_adults OR NEW.children > v_max_children THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Guest count exceeds the capacity of this room type';
  END IF;

  IF NEW.status IN ('pending','confirmed','checked_in')
     AND fn_room_is_available(NEW.room_id, NEW.check_in, NEW.check_out, NULL) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Room is not available for the selected dates';
  END IF;

  -- booking channel (column added by 01b_alter_tables.sql): staff with the booking permission => front desk
  SET NEW.source = IF(NEW.created_by IS NOT NULL
                      AND fn_has_permission(NEW.created_by, 'reservations.book_for_guest') = 1,
                      'front_desk', 'online');
END$$

-- Block illegal status transitions and double-booking when dates change
CREATE TRIGGER trg_res_bu BEFORE UPDATE ON reservations
FOR EACH ROW
BEGIN
  IF OLD.status IN ('checked_out','cancelled','no_show') AND NEW.status <> OLD.status THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A finalised reservation cannot change status';
  END IF;
  IF OLD.status = 'checked_in' AND NEW.status IN ('pending','confirmed','cancelled','no_show') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A checked-in reservation can only be checked out';
  END IF;
  IF NEW.status IN ('pending','confirmed','checked_in')
     AND (NEW.room_id <> OLD.room_id OR NEW.check_in <> OLD.check_in OR NEW.check_out <> OLD.check_out)
     AND fn_room_is_available(NEW.room_id, NEW.check_in, NEW.check_out, OLD.reservation_id) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Room is not available for the new dates';
  END IF;
END$$

-- Audit new reservations (and mark the room occupied if inserted already checked-in)
CREATE TRIGGER trg_res_ai AFTER INSERT ON reservations
FOR EACH ROW
BEGIN
  INSERT INTO audit_log (actor_user_id, action, entity, entity_id, details)
  VALUES (@app_user_id, 'reservation.created', 'reservation', NEW.reservation_id,
          JSON_OBJECT('code', NEW.reservation_code, 'room_id', NEW.room_id,
                      'check_in', NEW.check_in, 'check_out', NEW.check_out, 'total', NEW.total_amount));
  IF NEW.status = 'checked_in' THEN
    UPDATE rooms SET status = 'occupied' WHERE room_id = NEW.room_id;
  END IF;
END$$

-- Keep room status and housekeeping in sync with the reservation lifecycle + audit
CREATE TRIGGER trg_res_au AFTER UPDATE ON reservations
FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO audit_log (actor_user_id, action, entity, entity_id, details)
    VALUES (@app_user_id, CONCAT('reservation.', NEW.status), 'reservation', NEW.reservation_id,
            JSON_OBJECT('code', NEW.reservation_code, 'from', OLD.status, 'to', NEW.status));

    IF NEW.status = 'checked_in' THEN
      UPDATE rooms SET status = 'occupied' WHERE room_id = NEW.room_id;
    ELSEIF NEW.status = 'checked_out' THEN
      UPDATE rooms SET status = 'cleaning' WHERE room_id = NEW.room_id;
      INSERT INTO housekeeping_tasks (room_id, task_type, status)
      VALUES (NEW.room_id, 'checkout_clean', 'pending');
    END IF;
  END IF;
END$$

-- A deposit (hotel_settings.deposit_pct) confirms a pending reservation automatically
CREATE TRIGGER trg_pay_ai AFTER INSERT ON payments
FOR EACH ROW
BEGIN
  DECLARE v_total DECIMAL(12,2);
  DECLARE v_status VARCHAR(20);
  DECLARE v_paid DECIMAL(12,2);

  SELECT total_amount, status INTO v_total, v_status
    FROM reservations WHERE reservation_id = NEW.reservation_id;

  SELECT IFNULL(SUM(CASE payment_type WHEN 'payment' THEN amount ELSE -amount END), 0) INTO v_paid
    FROM payments WHERE reservation_id = NEW.reservation_id;

  IF NEW.payment_type = 'payment' AND v_status = 'pending' AND v_paid >= v_total * fn_setting_num('deposit_pct', 25) / 100 THEN
    UPDATE reservations SET status = 'confirmed' WHERE reservation_id = NEW.reservation_id;
  END IF;

  INSERT INTO audit_log (actor_user_id, action, entity, entity_id, details)
  VALUES (@app_user_id, CONCAT('payment.', NEW.payment_type), 'reservation', NEW.reservation_id,
          JSON_OBJECT('amount', NEW.amount, 'method', NEW.method, 'reference', NEW.reference));
END$$

-- Services can only be ordered on live stays; snapshot the current price
CREATE TRIGGER trg_so_bi BEFORE INSERT ON service_orders
FOR EACH ROW
BEGIN
  DECLARE v_status VARCHAR(20);
  DECLARE v_price  DECIMAL(10,2);
  DECLARE v_active BOOLEAN;

  SELECT status INTO v_status FROM reservations WHERE reservation_id = NEW.reservation_id;
  IF v_status IN ('pending','cancelled','no_show') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Services can only be ordered for confirmed or in-house stays';
  END IF;

  SELECT price, is_active INTO v_price, v_active FROM services WHERE service_id = NEW.service_id;
  IF v_active = FALSE THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This service is currently unavailable';
  END IF;
  IF NEW.unit_price IS NULL OR NEW.unit_price = 0 THEN
    SET NEW.unit_price = v_price;
  END IF;
END$$

-- Audit room status changes
CREATE TRIGGER trg_rooms_au AFTER UPDATE ON rooms
FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO audit_log (actor_user_id, action, entity, entity_id, details)
    VALUES (@app_user_id, 'room.status_changed', 'room', NEW.room_id,
            JSON_OBJECT('room', NEW.room_number, 'from', OLD.status, 'to', NEW.status));
  END IF;
END$$

-- When housekeeping finishes a checkout clean the room becomes available again
CREATE TRIGGER trg_hk_au AFTER UPDATE ON housekeeping_tasks
FOR EACH ROW
BEGIN
  IF NEW.status = 'done' AND OLD.status <> 'done' THEN
    UPDATE rooms SET status = 'available'
     WHERE room_id = NEW.room_id
       AND status IN ('cleaning','maintenance')
       AND NOT EXISTS (SELECT 1 FROM housekeeping_tasks t
                        WHERE t.room_id = NEW.room_id AND t.status <> 'done'
                          AND t.task_id <> NEW.task_id);
  END IF;
END$$

-- =====================================================================
-- MULTI-ROOM BOOKING: books N rooms of one type in a single transaction.
-- All rooms share a group_code; either every room is booked or none is.
-- =====================================================================
CREATE PROCEDURE sp_create_booking(
  IN  p_guest_id   INT UNSIGNED,
  IN  p_type_id    SMALLINT UNSIGNED,
  IN  p_check_in   DATE,
  IN  p_check_out  DATE,
  IN  p_adults     TINYINT UNSIGNED,   -- per room
  IN  p_children   TINYINT UNSIGNED,   -- per room
  IN  p_requests   VARCHAR(500),
  IN  p_created_by INT UNSIGNED,
  IN  p_rooms      TINYINT UNSIGNED,
  OUT p_group_code CHAR(10),
  OUT p_first_reservation_id INT UNSIGNED)
BEGIN
  DECLARE v_i    TINYINT UNSIGNED DEFAULT 0;
  DECLARE v_room INT UNSIGNED;
  DECLARE v_rate DECIMAL(10,2);
  DECLARE v_sub  DECIMAL(12,2);
  DECLARE v_tax  DECIMAL(10,2);
  DECLARE v_id   INT UNSIGNED;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF p_rooms < 1 OR p_rooms > fn_setting_num('max_rooms_per_booking', 5) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Number of rooms is outside the allowed range';
  END IF;
  IF p_check_in >= p_check_out THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Check-out must be after check-in';
  END IF;
  IF p_check_in < CURDATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Check-in date cannot be in the past';
  END IF;
  IF DATEDIFF(p_check_out, p_check_in) > fn_setting_num('max_stay_nights', 30) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The requested stay is longer than the maximum allowed';
  END IF;

  START TRANSACTION;

  SELECT base_price INTO v_rate FROM room_types WHERE type_id = p_type_id FOR UPDATE;
  IF v_rate IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unknown room type';
  END IF;

  SET v_sub = fn_nights(p_check_in, p_check_out) * v_rate;
  SET v_tax = ROUND(v_sub * fn_setting_num('tax_rate_pct', 12) / 100, 2);
  SET p_group_code = IF(p_rooms > 1, CONCAT('GR', UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 8))), NULL);

  WHILE v_i < p_rooms DO
    SET v_room = NULL;
    -- rooms already inserted in this loop count as taken (pending reservations block availability)
    SELECT r.room_id INTO v_room
      FROM rooms r
     WHERE r.type_id = p_type_id
       AND fn_room_is_available(r.room_id, p_check_in, p_check_out, NULL) = 1
     ORDER BY r.room_number
     LIMIT 1;

    IF v_room IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Not enough rooms of this type are available for the selected dates';
    END IF;

    INSERT INTO reservations
      (reservation_code, guest_id, room_id, check_in, check_out, adults, children,
       status, nightly_rate, tax_amount, total_amount, special_requests, group_code, created_by)
    VALUES
      (CONCAT('MA', UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 8))),
       p_guest_id, v_room, p_check_in, p_check_out, p_adults, p_children,
       'pending', v_rate, v_tax, v_sub + v_tax, p_requests, p_group_code, p_created_by);

    SET v_id = LAST_INSERT_ID();
    IF v_i = 0 THEN
      SET p_first_reservation_id = v_id;
    END IF;
    SET v_i = v_i + 1;
  END WHILE;

  COMMIT;
END$$

-- =====================================================================
-- MODIFY A BOOKING: new dates and/or a different room type or specific room.
-- Re-prices the stay; if the guest has already paid more than the new total
-- the excess is refunded automatically.
-- =====================================================================
CREATE PROCEDURE sp_modify_reservation(
  IN  p_reservation_id INT UNSIGNED,
  IN  p_check_in       DATE,
  IN  p_check_out      DATE,
  IN  p_type_id        SMALLINT UNSIGNED,   -- NULL = keep room type
  IN  p_room_id        INT UNSIGNED,        -- NULL = let the system choose
  OUT p_new_total      DECIMAL(12,2),
  OUT p_refund         DECIMAL(12,2))
BEGIN
  DECLARE v_status   VARCHAR(20);
  DECLARE v_room_old INT UNSIGNED;
  DECLARE v_type_old SMALLINT UNSIGNED;
  DECLARE v_in_old   DATE;
  DECLARE v_out_old  DATE;
  DECLARE v_total_old DECIMAL(12,2);
  DECLARE v_type     SMALLINT UNSIGNED;
  DECLARE v_room     INT UNSIGNED DEFAULT NULL;
  DECLARE v_rate     DECIMAL(10,2);
  DECLARE v_sub      DECIMAL(12,2);
  DECLARE v_tax      DECIMAL(10,2);
  DECLARE v_adults   TINYINT UNSIGNED;
  DECLARE v_children TINYINT UNSIGNED;
  DECLARE v_max_a    TINYINT UNSIGNED;
  DECLARE v_max_c    TINYINT UNSIGNED;
  DECLARE v_bal      DECIMAL(12,2);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET p_refund = 0;

  IF p_check_in >= p_check_out THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Check-out must be after check-in';
  END IF;
  IF p_check_in < CURDATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Check-in date cannot be in the past';
  END IF;
  IF DATEDIFF(p_check_out, p_check_in) > fn_setting_num('max_stay_nights', 30) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The requested stay is longer than the maximum allowed';
  END IF;

  START TRANSACTION;

  SELECT r.status, r.room_id, rm.type_id, r.adults, r.children, r.check_in, r.check_out, r.total_amount
    INTO v_status, v_room_old, v_type_old, v_adults, v_children, v_in_old, v_out_old, v_total_old
    FROM reservations r JOIN rooms rm ON rm.room_id = r.room_id
   WHERE r.reservation_id = p_reservation_id FOR UPDATE;

  IF v_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reservation not found';
  END IF;
  IF v_status NOT IN ('pending','confirmed') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only pending or confirmed reservations can be modified';
  END IF;

  IF p_room_id IS NOT NULL THEN
    SELECT type_id INTO v_type FROM rooms WHERE room_id = p_room_id;
    IF v_type IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unknown room';
    END IF;
    SET v_room = p_room_id;
  ELSE
    SET v_type = IFNULL(p_type_id, v_type_old);
  END IF;

  SET v_rate = NULL;
  SELECT base_price, max_adults, max_children INTO v_rate, v_max_a, v_max_c
    FROM room_types WHERE type_id = v_type FOR UPDATE;
  IF v_rate IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unknown room type';
  END IF;
  IF v_adults > v_max_a OR v_children > v_max_c THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Guest count exceeds the capacity of that room type';
  END IF;

  IF v_room IS NULL THEN
    -- keep the current room if it is still free (same type), otherwise pick another free one
    IF v_type = v_type_old AND fn_room_is_available(v_room_old, p_check_in, p_check_out, p_reservation_id) = 1 THEN
      SET v_room = v_room_old;
    ELSE
      SELECT r.room_id INTO v_room
        FROM rooms r
       WHERE r.type_id = v_type
         AND fn_room_is_available(r.room_id, p_check_in, p_check_out, p_reservation_id) = 1
       ORDER BY r.room_number
       LIMIT 1;
    END IF;
  END IF;

  IF v_room IS NULL OR fn_room_is_available(v_room, p_check_in, p_check_out, p_reservation_id) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No matching room is available for the new dates';
  END IF;

  SET v_sub = fn_nights(p_check_in, p_check_out) * v_rate;
  SET v_tax = ROUND(v_sub * fn_setting_num('tax_rate_pct', 12) / 100, 2);

  UPDATE reservations
     SET room_id = v_room, check_in = p_check_in, check_out = p_check_out,
         nightly_rate = v_rate, tax_amount = v_tax, total_amount = v_sub + v_tax
   WHERE reservation_id = p_reservation_id;

  -- refund any overpayment created by a cheaper stay
  SET v_bal = fn_reservation_balance(p_reservation_id);
  IF v_bal < 0 THEN
    SET p_refund = -v_bal;
    INSERT INTO payments (reservation_id, payment_type, method, amount, reference)
    VALUES (p_reservation_id, 'refund', 'card', p_refund,
            CONCAT('RFD', UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 12))));
  END IF;

  INSERT INTO audit_log (actor_user_id, action, entity, entity_id, details)
  VALUES (@app_user_id, 'reservation.modified', 'reservation', p_reservation_id,
          JSON_OBJECT('from_in', v_in_old, 'from_out', v_out_old, 'to_in', p_check_in, 'to_out', p_check_out,
                      'from_room', v_room_old, 'to_room', v_room, 'old_total', v_total_old, 'new_total', v_sub + v_tax));

  SET p_new_total = v_sub + v_tax;
  COMMIT;
END$$

DELIMITER ;

-- =====================================================================
-- VIEWS
-- =====================================================================
CREATE OR REPLACE VIEW v_reservation_details AS
SELECT r.reservation_id, r.reservation_code, r.status,
       r.check_in, r.check_out, fn_nights(r.check_in, r.check_out) AS nights,
       r.adults, r.children, r.nightly_rate, r.tax_amount, r.total_amount,
       r.special_requests, r.created_at, r.checked_in_at, r.checked_out_at, r.group_code, r.source,
       (SELECT COUNT(*) FROM reservations gx WHERE gx.group_code = r.group_code) AS group_size,
       g.guest_id, g.full_name AS guest_name, g.email AS guest_email, g.phone AS guest_phone,
       g.loyalty_tier,
       rm.room_id, rm.room_number, rm.floor_no,
       rt.type_id, rt.name AS room_type, rt.slug AS room_slug, rt.image_url,
       (SELECT IFNULL(SUM(so.quantity * so.unit_price), 0)
          FROM service_orders so
         WHERE so.reservation_id = r.reservation_id AND so.status <> 'cancelled') AS services_total,
       fn_reservation_balance(r.reservation_id) AS balance_due
  FROM reservations r
  JOIN guests g      ON g.guest_id = r.guest_id
  JOIN rooms rm      ON rm.room_id = r.room_id
  JOIN room_types rt ON rt.type_id = rm.type_id;

CREATE OR REPLACE VIEW v_guest_value AS
SELECT g.guest_id, g.full_name, g.email, g.loyalty_tier, g.loyalty_points,
       COUNT(r.reservation_id)                               AS stays,
       IFNULL(SUM(r.total_amount), 0)                        AS room_spend,
       MAX(r.check_in)                                       AS last_stay
  FROM guests g
  LEFT JOIN reservations r
         ON r.guest_id = g.guest_id AND r.status IN ('checked_in','checked_out')
 GROUP BY g.guest_id, g.full_name, g.email, g.loyalty_tier, g.loyalty_points;
