// Human-written descriptions used by scripts/gen-data-dictionary.mjs.
// Types, keys, defaults and constraints are read from the live database, so only the meaning lives here.
// The generator fails if a table or column is missing from this file, so the dictionary can't go stale.

export const TABLES = {
  roles: ['The job roles an account can hold (admin, manager, receptionist, guest).', {
    role_id: 'Surrogate primary key.', role_name: 'Short unique role name used in code and the JWT.', description: 'What the role is for.' }],
  permissions: ['Every action the system can authorise, e.g. reservations.manage.', {
    permission_id: 'Surrogate primary key.', code: 'Unique machine-readable permission code checked by the API.', description: 'Plain-language meaning of the permission.' }],
  role_permissions: ['Bridge table: which role holds which permission (many-to-many).', {
    role_id: 'Role that receives the permission (FK → roles).', permission_id: 'Permission granted (FK → permissions).' }],
  users: ['Login accounts for guests and staff.', {
    user_id: 'Surrogate primary key.', role_id: 'The account’s single role (FK → roles).', email: 'Login name; unique, validated by a CHECK.',
    password_hash: 'bcrypt hash of the password; the plain password is never stored.', full_name: 'Display name (at least 2 characters).', phone: 'Optional contact number.',
    is_active: 'FALSE disables the account; fn_has_permission then denies everything.', last_login_at: 'Time of the most recent successful sign-in.',
    email_verified_at: 'When the email address was confirmed; NULL = not verified.', is_demo: 'TRUE for demo accounts shown as quick-login buttons.', created_at: 'When the account was created.' }],
  guests: ['Guest profiles; may belong to a user account or be a walk-in.', {
    guest_id: 'Surrogate primary key.', user_id: 'Linked login account; NULL for walk-in guests (FK → users).', full_name: 'Guest’s full name.', email: 'Unique contact email.',
    phone: 'Contact number.', country: 'Country of residence.', loyalty_tier: 'Silver, Gold or Platinum; derived from points by fn_loyalty_tier.',
    loyalty_points: 'Points earned at check-out (1 per configured number of rupees).', created_at: 'Profile creation time.' }],
  departments: ['Hotel departments employees belong to.', { department_id: 'Surrogate primary key.', name: 'Unique department name.' }],
  employees: ['Staff records (HR data), with a self-referencing reporting line.', {
    employee_id: 'Surrogate primary key.', user_id: 'Optional login account of the employee (FK → users).', department_id: 'Department (FK → departments).',
    manager_id: 'Direct manager (self-reference FK → employees); NULL for the top of the hierarchy.', full_name: 'Employee name.', job_title: 'Position held.',
    hire_date: 'Date of joining.', monthly_salary: 'Gross monthly salary in rupees; must be positive.' }],
  room_types: ['Room categories with price, capacity and marketing details.', {
    type_id: 'Surrogate primary key.', slug: 'URL-safe unique identifier used in /rooms/{slug}.', name: 'Unique display name.', tagline: 'One-line summary.',
    description: 'Long marketing description.', base_price: 'Price per night before tax, in rupees (CHECK > 0).', max_adults: 'Adults the room sleeps (1–8).',
    max_children: 'Children the room sleeps.', size_sqm: 'Floor area in square metres (CHECK > 10).', bed_type: 'Bedding description.', view_type: 'View from the room.',
    image_url: 'Photo: an https URL or an uploaded file under /api/media.' }],
  rooms: ['Physical rooms; each belongs to one room type.', {
    room_id: 'Surrogate primary key.', type_id: 'Category of the room (FK → room_types).', room_number: 'Unique number shown to guests and staff.',
    floor_no: 'Floor (1–60).', status: 'available, occupied, cleaning or maintenance; kept in sync by triggers.' }],
  amenities: ['Catalogue of in-room amenities.', { amenity_id: 'Surrogate primary key.', name: 'Unique amenity name.', icon: 'Icon key used by the UI.' }],
  room_type_amenities: ['Bridge table: amenities offered by each room type (many-to-many).', {
    type_id: 'Room type (FK → room_types).', amenity_id: 'Amenity (FK → amenities).' }],
  reservations: ['One booked room for a date range; the core transactional table.', {
    reservation_id: 'Surrogate primary key.', reservation_code: 'Unique customer-facing booking reference.', guest_id: 'Booking guest (FK → guests).', room_id: 'Assigned room (FK → rooms).',
    check_in: 'Arrival date.', check_out: 'Departure date; CHECK ensures it is after check_in.', adults: 'Adults staying (≥ 1).', children: 'Children staying.',
    status: 'pending, confirmed, checked_in, checked_out, cancelled or no_show.', source: 'online (guest) or front_desk (staff); set by trigger trg_res_bi.',
    nightly_rate: 'Rate per night captured at booking time.', tax_amount: 'Tax charged (rate from hotel_settings at booking time).', total_amount: 'Nights × rate + tax.',
    special_requests: 'Free-text guest requests.', group_code: 'Shared by all rooms of one multi-room booking; NULL for single rooms.',
    created_by: 'User who made the booking (FK → users).', created_at: 'When the booking was made.', checked_in_at: 'Actual check-in time.', checked_out_at: 'Actual check-out time.' }],
  payments: ['Money received or refunded against a reservation.', {
    payment_id: 'Surrogate primary key.', reservation_id: 'Reservation paid (FK → reservations).', payment_type: 'payment or refund.', method: 'card, upi, cash or netbanking.',
    amount: 'Positive amount in rupees (CHECK > 0).', reference: 'Unique payment/refund reference.', paid_at: 'When it was recorded.' }],
  services: ['Catalogue of orderable services (dining, spa, transport…).', {
    service_id: 'Surrogate primary key.', name: 'Unique service name.', category: 'dining, spa, transport, laundry or experience.', description: 'What the service includes.',
    price: 'Current price in rupees (≥ 0).', is_active: 'FALSE hides it from guests without deleting history.' }],
  service_orders: ['Services ordered by a guest during a stay (added to the folio).', {
    order_id: 'Surrogate primary key.', reservation_id: 'Stay the order belongs to (FK → reservations).', service_id: 'Service ordered (FK → services).',
    quantity: 'Units ordered (1–20).', unit_price: 'Price snapshot taken by trigger trg_so_bi.', status: 'requested, confirmed, delivered or cancelled.',
    notes: 'Guest instructions.', ordered_at: 'When it was requested.' }],
  housekeeping_tasks: ['Cleaning and maintenance jobs per room.', {
    task_id: 'Surrogate primary key.', room_id: 'Room to service (FK → rooms).', employee_id: 'Assigned employee (FK → employees); NULL = unassigned.',
    task_type: 'checkout_clean, turndown, deep_clean or maintenance.', status: 'pending, in_progress or done.', created_at: 'When the task was created.',
    completed_at: 'When it was finished; completing a clean frees the room (trigger).' }],
  audit_log: ['Immutable trail of who changed what, written by triggers and procedures.', {
    log_id: 'Surrogate primary key.', actor_user_id: 'User who acted (from @app_user_id); NULL = system.', action: 'Event name, e.g. reservation.created.',
    entity: 'Kind of object affected.', entity_id: 'Primary key of the affected object.', details: 'JSON with event-specific data.', created_at: 'When it happened.' }],
  hotel_settings: ['Key/value configuration: policies, loyalty rules and website copy.', {
    setting_key: 'Primary key, e.g. tax_rate_pct.', setting_value: 'The value (text or number stored as text).', value_type: 'text, number or longtext; drives validation and the editor.',
    group_name: 'Section shown in the Settings screen.', label: 'Human label.', help_text: 'Short help shown under the field.', sort_order: 'Order within the group.', updated_at: 'Last change time.' }],
  site_features: ['Feature blurbs shown under the home-page hero.', {
    feature_id: 'Surrogate primary key.', icon: 'Icon key.', title: 'Unique heading.', description: 'Text; may contain {placeholders} filled from settings.', sort_order: 'Display order.' }],
  service_categories: ['Display metadata for service categories.', {
    category: 'Primary key; same values as services.category.', title: 'Heading on the home page.', tagline: 'Short description.', image_url: 'Tile photo.',
    show_on_home: 'Whether it appears on the home page.', sort_order: 'Display order.' }],
  site_media: ['Named images used by the website (hero, story, login panel).', { media_key: 'Primary key, e.g. hero.', url: 'Image URL.', alt: 'Alt text for accessibility.' }],
  user_tokens: ['One-time tokens for password reset and email verification.', {
    token_hash: 'SHA-256 of the token (the token itself is only in the email).', user_id: 'Owner (FK → users).', purpose: 'password_reset or email_verify.',
    expires_at: 'Token is invalid after this time.', used_at: 'Set when consumed; NULL = still usable.', created_at: 'Issue time.' }],
  email_outbox: ['Every email the system sends, or would send when SMTP is not configured.', {
    email_id: 'Surrogate primary key.', to_address: 'Recipient.', subject: 'Subject line.', body: 'Plain-text message.', status: 'sent, failed or not_configured.',
    error: 'Delivery error message, if any.', created_at: 'When it was queued.' }],
};
