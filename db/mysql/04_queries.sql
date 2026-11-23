-- =====================================================================
--  04_queries.sql  |  Analytical SQL showcase
--  Nested / correlated / recursive queries, joins, CTEs, window functions.
--
--  This file is the single source of truth for the dashboard "Reports"
--  page: every block that starts with  "-- @report"  is parsed and run
--  live by the app (see src/lib/reports.ts).
--  Format:  -- @report <id> | <title> | <concept> | <description>
-- =====================================================================
USE maison_aurelia;

-- @report r01 | Guests who out-spend the average | Nested subquery (HAVING + derived table) | Total room spend per guest compared with the average guest spend, computed by a nested query.
SELECT g.full_name, g.country, COUNT(r.reservation_id) AS stays, SUM(r.total_amount) AS room_spend
  FROM guests g
  JOIN reservations r ON r.guest_id = g.guest_id
 WHERE r.status IN ('checked_in','checked_out')
 GROUP BY g.guest_id, g.full_name, g.country
HAVING SUM(r.total_amount) > (
         SELECT AVG(guest_total)
           FROM (SELECT SUM(total_amount) AS guest_total
                   FROM reservations
                  WHERE status IN ('checked_in','checked_out')
                  GROUP BY guest_id) per_guest)
 ORDER BY room_spend DESC;

-- @report r02 | Rooms that were never booked | Correlated subquery (NOT EXISTS) | An anti-join expressed with a correlated NOT EXISTS - finds idle inventory.
SELECT rm.room_number, rt.name AS room_type, rm.status
  FROM rooms rm
  JOIN room_types rt ON rt.type_id = rm.type_id
 WHERE NOT EXISTS (SELECT 1
                     FROM reservations r
                    WHERE r.room_id = rm.room_id AND r.status <> 'cancelled')
 ORDER BY rm.room_number;

-- @report r03 | Latest stay of every guest | Correlated subquery (scalar MAX) | For each guest, the correlated subquery finds their most recent arrival date.
SELECT g.full_name, r.reservation_code, r.check_in, r.check_out, r.status
  FROM guests g
  JOIN reservations r ON r.guest_id = g.guest_id
 WHERE r.status <> 'cancelled'
   AND r.check_in = (SELECT MAX(r2.check_in)
                       FROM reservations r2
                      WHERE r2.guest_id = g.guest_id AND r2.status <> 'cancelled')
 ORDER BY r.check_in DESC;

-- @report r04 | Staff reporting hierarchy | Recursive CTE | Walks the employee -> manager tree from the General Manager down, building the chain of command.
WITH RECURSIVE org AS (
  SELECT employee_id, full_name, job_title, department_id, manager_id,
         0 AS lvl, CAST(full_name AS CHAR(500)) AS chain
    FROM employees
   WHERE manager_id IS NULL
  UNION ALL
  SELECT e.employee_id, e.full_name, e.job_title, e.department_id, e.manager_id,
         o.lvl + 1, CONCAT(o.chain, ' > ', e.full_name)
    FROM employees e
    JOIN org o ON e.manager_id = o.employee_id
)
SELECT CONCAT(REPEAT('    ', org.lvl), org.full_name) AS employee,
       org.job_title, d.name AS department, org.lvl AS depth, org.chain AS reporting_chain
  FROM org
  JOIN departments d ON d.department_id = org.department_id
 ORDER BY org.chain;

-- @report r05 | Occupancy forecast, next 14 days | Recursive CTE (calendar generation) | A recursive CTE generates the calendar; a LEFT JOIN counts occupied rooms per night.
WITH RECURSIVE calendar (d) AS (
  SELECT CURDATE()
  UNION ALL
  SELECT d + INTERVAL 1 DAY FROM calendar WHERE d < CURDATE() + INTERVAL 13 DAY
)
SELECT c.d AS stay_date, DAYNAME(c.d) AS weekday,
       COUNT(r.reservation_id) AS rooms_occupied,
       ROUND(100 * COUNT(r.reservation_id) /
             (SELECT COUNT(*) FROM rooms WHERE status <> 'maintenance'), 1) AS occupancy_pct
  FROM calendar c
  LEFT JOIN reservations r
         ON r.status IN ('confirmed','checked_in')
        AND c.d >= r.check_in AND c.d < r.check_out
 GROUP BY c.d
 ORDER BY c.d;

-- @report r06 | Revenue by room type with grand total | Multi-table JOIN + GROUP BY WITH ROLLUP | Three-table join aggregated per room type; ROLLUP adds the grand-total row.
SELECT COALESCE(rt.name, 'ALL ROOM TYPES') AS room_type,
       COUNT(r.reservation_id)                       AS bookings,
       SUM(fn_nights(r.check_in, r.check_out))       AS room_nights,
       SUM(r.total_amount)                           AS revenue,
       ROUND(AVG(r.nightly_rate), 0)                 AS avg_nightly_rate
  FROM reservations r
  JOIN rooms rm      ON rm.room_id = r.room_id
  JOIN room_types rt ON rt.type_id = rm.type_id
 WHERE r.status IN ('checked_in','checked_out')
 GROUP BY rt.name WITH ROLLUP;

-- @report r07 | Best-selling services per category | Window function RANK() | Ranks services by revenue inside each category and keeps the top two.
SELECT category, service, units, revenue, rank_in_category
  FROM (
    SELECT s.category, s.name AS service,
           SUM(so.quantity) AS units,
           SUM(so.quantity * so.unit_price) AS revenue,
           RANK() OVER (PARTITION BY s.category
                        ORDER BY SUM(so.quantity * so.unit_price) DESC) AS rank_in_category
      FROM service_orders so
      JOIN services s ON s.service_id = so.service_id
     WHERE so.status <> 'cancelled'
     GROUP BY s.category, s.name
  ) ranked
 WHERE rank_in_category <= 2
 ORDER BY category, rank_in_category;

-- @report r08 | Monthly revenue, running total and growth | CTE + window functions (SUM OVER, LAG) | A CTE aggregates by month; window functions add the cumulative total and month-over-month growth.
WITH monthly AS (
  SELECT DATE_FORMAT(check_in, '%Y-%m') AS stay_month, SUM(total_amount) AS revenue
    FROM reservations
   WHERE status IN ('checked_in','checked_out')
   GROUP BY DATE_FORMAT(check_in, '%Y-%m')
)
SELECT stay_month, revenue,
       SUM(revenue) OVER (ORDER BY stay_month) AS running_total,
       ROUND(100 * (revenue - LAG(revenue) OVER (ORDER BY stay_month))
                 / LAG(revenue) OVER (ORDER BY stay_month), 1) AS mom_growth_pct
  FROM monthly
 ORDER BY stay_month;

-- @report r09 | Reservations with no payment yet | LEFT JOIN anti-join | LEFT JOIN + IS NULL isolates upcoming bookings that have not paid a deposit.
SELECT r.reservation_code, g.full_name, r.status, r.check_in, r.total_amount
  FROM reservations r
  JOIN guests g       ON g.guest_id = r.guest_id
  LEFT JOIN payments p ON p.reservation_id = r.reservation_id
 WHERE p.payment_id IS NULL AND r.status IN ('pending','confirmed')
 ORDER BY r.check_in;

-- @report r10 | Room price vs hotel average | Derived-table subquery | A derived table computes the average rate once and every row is compared to it.
SELECT t.name AS room_type, t.base_price, ROUND(a.avg_price, 0) AS hotel_average,
       ROUND(100 * (t.base_price - a.avg_price) / a.avg_price, 1) AS pct_vs_average
  FROM room_types t
  CROSS JOIN (SELECT AVG(base_price) AS avg_price FROM room_types) a
 ORDER BY t.base_price DESC;

-- @report r11 | Staff paid above their department average | Correlated subquery | The inner query is re-evaluated per employee using that employee's department.
SELECT e.full_name, d.name AS department, e.job_title, e.monthly_salary,
       (SELECT ROUND(AVG(x.monthly_salary)) FROM employees x
         WHERE x.department_id = e.department_id) AS department_average
  FROM employees e
  JOIN departments d ON d.department_id = e.department_id
 WHERE e.monthly_salary > (SELECT AVG(x.monthly_salary) FROM employees x
                            WHERE x.department_id = e.department_id)
 ORDER BY d.name, e.monthly_salary DESC;

-- @report r12 | Repeat guests | IN subquery with GROUP BY / HAVING | Guests that completed more than one stay, found by a nested IN (SELECT ... HAVING).
SELECT g.full_name, g.country, g.loyalty_tier, g.loyalty_points
  FROM guests g
 WHERE g.guest_id IN (SELECT guest_id
                        FROM reservations
                       WHERE status = 'checked_out'
                       GROUP BY guest_id
                      HAVING COUNT(*) > 1)
 ORDER BY g.loyalty_points DESC;

-- @report r13 | Headcount and payroll per department | RIGHT JOIN + aggregation | RIGHT JOIN keeps departments even when they have no employees.
SELECT d.name AS department, COUNT(e.employee_id) AS headcount,
       ROUND(IFNULL(SUM(e.monthly_salary), 0)) AS monthly_payroll
  FROM employees e
  RIGHT JOIN departments d ON d.department_id = e.department_id
 GROUP BY d.department_id, d.name
 ORDER BY headcount DESC;

-- @report r14 | Arrivals and departures, next 3 days | UNION ALL | Two result sets (check-ins and check-outs) merged into one timeline.
SELECT 'Arrival' AS movement, r.check_in AS movement_date, g.full_name, rm.room_number, r.status
  FROM reservations r
  JOIN guests g ON g.guest_id = r.guest_id
  JOIN rooms rm ON rm.room_id = r.room_id
 WHERE r.check_in BETWEEN CURDATE() AND CURDATE() + INTERVAL 3 DAY
   AND r.status IN ('pending','confirmed','checked_in')
UNION ALL
SELECT 'Departure', r.check_out, g.full_name, rm.room_number, r.status
  FROM reservations r
  JOIN guests g ON g.guest_id = r.guest_id
  JOIN rooms rm ON rm.room_id = r.room_id
 WHERE r.check_out BETWEEN CURDATE() AND CURDATE() + INTERVAL 3 DAY
   AND r.status IN ('confirmed','checked_in')
ORDER BY movement_date, movement;

-- @report r15 | Guest value quartiles | View + window function NTILE | Uses the v_guest_value view and NTILE(4) to split guests into spend quartiles.
SELECT full_name, loyalty_tier, stays, room_spend,
       NTILE(4) OVER (ORDER BY room_spend DESC) AS spend_quartile
  FROM v_guest_value
 WHERE stays > 0
 ORDER BY room_spend DESC;

-- @report r16 | Employee and manager side by side | Self join | The employees table joined to itself shows each person with their manager.
SELECT e.full_name AS employee, e.job_title, m.full_name AS manager
  FROM employees e
  LEFT JOIN employees m ON m.employee_id = e.manager_id
 ORDER BY m.full_name, e.full_name;
