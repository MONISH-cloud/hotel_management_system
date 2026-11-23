// The walkthrough script: what is shown, what is highlighted and what the narrator says.
// Screen scenes run against the live app; card scenes render scripts/walkthrough/card.html.
//
// Beat fields
//   say      narration (also used as the on-screen subtitle)
//   title    caption heading           badge  'solves' | 'gap' | 'feature'      tag  text after the badge
//   hl       highlights: [{ t: 'exact text', up: n parents, nth, label, sel: 'css' }]
//   y        scroll position (CSS px) or 'hl' (centre the highlights; default when hl is set)
//   click    { t, nth, up, sel } element to click (with an animated cursor) before the beat's shot
//   card     state passed to render() in card.html

const GUEST = 'guest@maisonaurelia.com';
const DESK = 'frontdesk@maisonaurelia.com';
const MANAGER = 'manager@maisonaurelia.com';
const ADMIN = 'admin@maisonaurelia.com';

// Live booking dates: three weeks out, so the scene keeps working whenever it is re-recorded.
const iso = (d) => d.toISOString().slice(0, 10);
const day = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const BOOK_IN = day(21), BOOK_OUT = day(23);

const problems = [
  { title: 'Double bookings', text: 'A guest online and the front desk can both sell the last room.' },
  { title: 'Rules live in people’s heads', text: 'Deposits, cancellations, tax and loyalty depend on who is on shift.' },
  { title: 'No single record of a stay', text: 'Room, spa, dining, payments and refunds are tracked in different places.' },
  { title: 'No accountability or insight', text: 'Nobody sees occupancy and revenue at a glance, or knows who changed what.' },
];
const problemCard = (show, active, footShow = false) => ({
  type: 'list', eyebrow: 'The problem today', heading: 'Spreadsheets, WhatsApp and a website <em>that can’t book</em>',
  items: problems, show, active,
  foot: '<span style="color:var(--gold)">＋</span> And guests now expect to <b>search, book, pay and change</b> their stay online.', footShow,
});

const gaps = [
  { n: '₹', tone: 'amber', title: 'Real payment gateway', text: 'Payments are simulated. The flow sits in one API route, ready for Razorpay or Stripe.' },
  { n: '⇄', tone: 'amber', title: 'OTA / channel manager', text: 'No sync with Booking.com, Expedia and similar sites yet.' },
  { n: '✉', tone: 'amber', title: 'Email delivery', text: 'Needs SMTP settings. Until then, emails wait in the outbox.' },
  { n: '⚡', tone: 'amber', title: 'Real-time push', text: 'The live feed polls every 12 seconds; no WebSockets yet.' },
  { n: '1', tone: 'amber', title: 'One property, one currency', text: 'Single hotel, rupees only, a single tax rate.' },
  { n: '☁', tone: 'amber', title: 'Scale and test coverage', text: 'Photos on local disk; no browser end-to-end or load tests yet.' },
];
const gapCard = (show, active) => ({ type: 'list', cols: 3, eyebrow: 'Being honest', heading: 'What’s <em>not there</em> yet', items: gaps, show, active });

const summaryRows = [
  ['Double bookings', 'Row locks + trigger, proven by a concurrency test'],
  ['Rules live in people’s heads', 'One settings table the database enforces'],
  ['No single record of a stay', 'One folio: room, services, payments, refunds'],
  ['No accountability or insight', 'Role-based access, audit trail, live dashboard'],
  ['Guests have to phone the hotel', 'Book, pay, change and cancel online'],
];
const summaryCard = (show, footShow = false) => ({
  type: 'table', eyebrow: 'Summary', heading: 'Problem <em>→</em> what we have', cols: ['The issue', 'What solves it'], rows: summaryRows, show,
  foot: '<span style="color:var(--gold)">Next:</span> <b>payment gateway</b> · <b>end-to-end tests + CI</b> · <b>cloud photo storage</b> · <b>dynamic pricing</b>', footShow,
});

const testLines = [
  'ok 1 - prices a stay using the configured tax rate',
  'ok 3 - enforces room capacity (trigger)',
  'ok 4 - never double-books: the last room is given to exactly one of two concurrent requests',
  'ok 7 - full stay lifecycle: check-in rules, balance before check-out, room + housekeeping + loyalty',
  'ok 8 - cancellation refunds in full outside the window, nothing inside it',
  'ok 9 - multi-room booking is atomic and shares a group code',
  'ok 11 - RBAC lives in the database: permissions per role',
  'ok 13 - triggers write an audit trail',
  '',
  '# tests 20   # pass 20   # fail 0',
];

export const SCENES = [
  // ───────────────────────────── intro
  { id: 'intro', beats: [
    { card: { type: 'title', eyebrow: 'Product walkthrough', title: 'One system for the<br><em>whole hotel</em>',
      sub: 'The problems small hotels face today, what this app does about each one, and what is not there yet.',
      pills: ['Next.js', 'MySQL', 'Neo4j', 'Redis'] },
      say: 'This is Maison Aurelia, a hotel management system for small hotels. Let’s look at the problems they face, how the app solves each one, and what’s not there yet.' },
  ] },
  { id: 'problems', beats: [
    { card: problemCard(0), say: 'Most small hotels run on spreadsheets, a separate billing tool, WhatsApp groups, and a website that can’t take bookings. That causes four problems.' },
    { card: problemCard(1, 0), say: 'One: double bookings. The website and the front desk can both sell the last room.' },
    { card: problemCard(2, 1), say: 'Two: the rules live in people’s heads. Deposits, refunds and tax depend on who’s on shift.' },
    { card: problemCard(3, 2), say: 'Three: there’s no single record of a stay, so checkout is slow and disputes are hard to settle.' },
    { card: problemCard(4, 3), say: 'And four: no insight or accountability. Nobody sees revenue at a glance, or knows who changed what.' },
    { card: problemCard(4, null, true), say: 'And guests expect to do all of this online, without phoning the hotel. Let’s see how the app handles it.' },
  ] },

  // ───────────────────────────── guest website
  { id: 'home', chapter: 'Guest website · Home', route: '/', who: null, beats: [
    { title: 'A website that can take bookings', badge: 'solves', tag: 'Guests had to phone the hotel',
      hl: [{ t: 'Check availability', up: 2, label: 'Live availability search' }],
      say: 'Here’s the guest website. The booking bar checks live availability, so the hotel’s own site can finally take bookings.' },
    { title: 'Nothing is hard-coded', badge: 'feature', tag: 'Live from MySQL and Neo4j',
      hl: [{ t: '6 ways to', up: 0, label: 'Room count from MySQL', below: true }, { t: '₹65,000', label: 'Price from MySQL' }, { t: '5.0', label: 'Rating from Neo4j reviews' }],
      say: 'Nothing here is hard-coded. Prices and rooms come from MySQL, and ratings come from guest reviews in Neo4j.' },
    { title: 'The policy shown is the policy enforced', badge: 'solves', tag: 'Rules live in people’s heads',
      hl: [{ t: 'Free cancellation', up: 1, label: 'Same setting the refund logic uses' }],
      say: 'And this cancellation policy is the same setting the database uses for refunds, so what the site promises is what the hotel does.' },
  ] },
  { id: 'rooms', chapter: 'Guest website · Rooms', route: '/rooms', who: null, beats: [
    { title: 'Real availability for the chosen dates', badge: 'solves', tag: 'Stale availability',
      hl: [{ t: 'Only 2 left', label: 'Counted from live bookings' }, { t: 'Available', nth: 0 }],
      say: 'Pick your dates, and every room shows real availability for those nights, down to how many are left.' },
    { title: 'Transparent pricing', badge: 'feature', tag: 'Tax rate from settings',
      hl: [{ t: 'per night · ₹25,500 for 3 · + 12 % tax', label: 'Stay total and tax, from settings' }],
      say: 'Prices show the full stay and the tax, straight from the hotel’s settings.' },
  ] },
  { id: 'room', chapter: 'Guest website · Room detail', route: '/rooms/royal-presidential-suite', who: null, beats: [
    { title: 'Book one room or five, atomically', badge: 'feature', tag: 'Multi-room bookings',
      hl: [{ t: '1 room available', label: 'Live count' }, { t: 'Rooms', up: 2, label: 'Up to 5 rooms in one booking' }],
      say: 'Guests can book up to five rooms at once. It’s one transaction, so either every room is reserved, or none is.' },
    { title: 'Reviews and recommendations from a graph', badge: 'feature', tag: 'Neo4j',
      hl: [{ t: 'Guest reviews', label: 'Verified reviews' }, { t: 'Guests also stayed in', label: 'Graph recommendations' }],
      say: 'Reviews and recommendations come from the Neo4j graph. If it’s ever down, the site keeps working without them.' },
  ] },

  // Creates a real booking and a simulated deposit payment (the app's own pre-filled test card) on every recording.
  { id: 'booking', chapter: 'Guest website · Live booking', route: `/rooms/deluxe-garden?checkIn=${BOOK_IN}&checkOut=${BOOK_OUT}&adults=2`, who: GUEST, beats: [
    { title: 'Book it for real', badge: 'solves', tag: 'Guests had to phone the hotel',
      hl: [{ t: 'Total', up: 1, label: 'Price, tax and total, live' }, { t: 'Reserve this room', label: 'One click' }],
      say: 'Let’s book one for real. Signed in as a guest, the dates are set, and the price, tax and total are worked out instantly.' },
    { title: 'Room held, deposit requested', badge: 'feature', tag: 'Deposit % from settings',
      click: { t: 'Reserve this room' }, wait: 2600, hl: [{ sel: '[role="dialog"]' }], y: 'keep',
      say: 'Reserving holds the room straight away, and asks for a deposit to confirm it.' },
    { title: 'Paid, and confirmed by the database', badge: 'solves', tag: 'Rules live in people’s heads',
      click: { t: 'Pay ₹' }, wait: 3200, hl: [{ t: "You're booked!", up: 1, label: 'Confirmed automatically by a trigger' }],
      say: 'The payment is simulated, and once the deposit lands, a database trigger confirms the booking. That’s the whole journey, with no phone call.' },
  ] },

  // ───────────────────────────── guest self-service
  { id: 'account', chapter: 'Guest self-service · My account', route: '/account', who: GUEST, beats: [
    { title: 'Loyalty that applies itself', badge: 'solves', tag: 'Rules applied inconsistently',
      hl: [{ t: 'Aurelia Circle', up: 1, label: 'Tier and points, awarded by the database' }],
      say: 'Signed in as a guest, here’s the loyalty tier. Points are added automatically at check-out, so everyone earns the same way.' },
    { title: 'One record of the whole stay', badge: 'solves', tag: 'No single record of a stay',
      hl: [{ t: 'Room total', up: 2, anchor: { t: 'Pay balance' }, label: 'Room + services + balance' }, { t: 'Pay balance', up: 1, label: 'Self-service actions' }],
      say: 'Each booking shows the room, services and balance in one place. Guests can pay, order services, get an invoice, or cancel, without calling the desk.' },
    { title: 'Payments are simulated', badge: 'gap', tag: 'No real payment gateway yet',
      hl: [{ t: 'Pay balance', label: 'Simulated payment', tone: 'amber' }],
      say: 'One gap: payments are simulated. There’s no real payment gateway yet, but Razorpay or Stripe can be plugged into one place later.' },
    { title: 'Change a booking, refund handled for you', badge: 'solves', tag: 'Refunds decided case by case',
      click: { t: 'Change dates / room' }, hl: [{ sel: '[role="dialog"]' }], y: 'keep',
      say: 'Changing a booking re-prices it live, re-checks availability, and refunds any overpayment automatically.' },
  ] },

  // ───────────────────────────── front desk
  { id: 'reservations', chapter: 'Front desk · Reservations', route: '/dashboard/reservations', who: DESK, beats: [
    { title: 'Every stay in one list', badge: 'solves', tag: 'No single record of a stay',
      hl: [{ t: 'Arrivals today', up: 1, label: 'Today’s arrivals, departures, in-house' }], y: 0,
      say: 'Now the front desk. Every reservation, from the website or the desk, lives in one list with its status and balance.' },
    { title: 'Actions follow the rules', badge: 'solves', tag: 'Rules live in people’s heads',
      hl: [{ t: 'Folio', nth: 0, up: 1, label: 'Only allowed actions appear' }], y: 0,
      say: 'Each row only offers actions that are allowed. You can’t check a guest out while they still owe money.' },
    { title: 'No more double bookings', badge: 'solves', tag: 'Double bookings',
      click: { t: 'New reservation' }, hl: [{ sel: '[role="dialog"]' }], y: 'keep',
      say: 'When the desk books a room, the database locks it and re-checks the dates, so the same room can never be sold twice.' },
  ] },
  { id: 'proof', beats: [
    { card: { type: 'terminal', eyebrow: 'Proof, not a promise', heading: 'Two requests for the <em>last room</em>: exactly one wins', lines: testLines, hi: null },
      say: 'And that’s tested.' },
    { card: { type: 'terminal', eyebrow: 'Proof, not a promise', heading: 'Two requests for the <em>last room</em>: exactly one wins', lines: testLines, hi: 2 },
      say: 'Two requests for the last room, at the same moment. Exactly one wins. All twenty tests pass.' },
  ] },
  { id: 'housekeeping', chapter: 'Front desk · Housekeeping', route: '/dashboard/housekeeping', who: DESK, beats: [
    { title: 'Housekeeping off WhatsApp', badge: 'solves', tag: 'Tasks lost in chat groups',
      hl: [{ t: 'checkout clean', up: 2, label: 'Created automatically at check-out' }, { t: 'Done', up: 1, label: 'Finished clean frees the room' }], y: 0,
      say: 'Housekeeping moves off WhatsApp. Check-out creates a cleaning task, and finishing it frees the room.' },
  ] },

  // ───────────────────────────── management
  { id: 'dashboard', chapter: 'Management · Overview', route: '/dashboard', who: ADMIN, beats: [
    { title: 'Occupancy and revenue at a glance', badge: 'solves', tag: 'No insight',
      hl: [{ t: 'Occupancy', nth: 0, up: 3, label: 'Live KPIs' }], y: 0,
      say: 'Managers get the big picture: arrivals, occupancy, revenue and what’s still owed, all live.' },
    { title: 'Forecasts from stored procedures', badge: 'feature', tag: 'Occupancy + revenue',
      hl: [{ t: 'Occupancy', nth: 1, up: 2, label: 'Occupancy forecast' }, { t: 'Room status', up: 2, label: 'Room status right now' }],
      say: 'Here’s the occupancy forecast, and the status of every room right now.' },
    { title: 'Live feed, but not real-time push', badge: 'gap', tag: 'Polls every 12 seconds',
      hl: [{ t: 'Live activity', up: 2, label: 'Refreshes every 12 s', tone: 'amber' }, { t: 'Arrivals today', nth: 1, up: 2, label: 'One-click check-in' }],
      say: 'Today’s arrivals have one-click check-in. The activity feed refreshes every twelve seconds; instant real-time updates aren’t there yet.' },
  ] },
  { id: 'reports', chapter: 'Management · SQL reports', route: '/dashboard/reports', who: MANAGER, beats: [
    { title: '16 reports, run live', badge: 'solves', tag: 'No insight',
      hl: [{ t: 'Guests who out-spend the average', up: 1, label: '16 reports' }, { t: 'Run', label: 'Runs live against MySQL' }], y: 0,
      say: 'For deeper questions, sixteen SQL reports run live, with CSV export.' },
  ] },
  { id: 'settings', chapter: 'Administration · Hotel settings', route: '/dashboard/settings', who: ADMIN, beats: [
    { title: 'Every rule in one editable place', badge: 'solves', tag: 'Rules live in people’s heads',
      hl: [{ t: 'GST / tax rate (%)', up: 1, label: 'Read by stored procedures and triggers' }, { t: 'Deposit to confirm (%)', up: 1 }, { t: 'Free cancellation (hours before arrival)', up: 1 }, { t: 'Maximum stay (nights)', up: 1 }],
      say: 'And here’s the fix for rules in people’s heads. Tax, deposit and cancellation rules live in one place. Change a number here, and the very next booking follows it.' },
  ] },
  { id: 'staff', chapter: 'Administration · Staff & access', route: '/dashboard/staff', who: ADMIN, beats: [
    { title: 'Each role sees only what it needs', badge: 'solves', tag: 'No accountability',
      click: { t: 'Role permissions' }, hl: [{ t: 'Role permissions', label: 'Stored in the database' }], y: 0,
      say: 'Every role sees only what it needs. Permissions live in the database, so a receptionist can’t open settings or salaries.' },
  ] },
  { id: 'activity', chapter: 'Administration · Activity & health', route: '/dashboard/activity', who: ADMIN, beats: [
    { title: 'Who changed what, and when', badge: 'solves', tag: 'No accountability',
      hl: [{ t: 'reservation.created', up: 2, label: 'Written by a trigger, with the acting user' }, { t: 'New reservation', up: 1, label: 'Same event, live from Redis' }], y: 0,
      say: 'And the audit log. Here’s a booking a guest just made, recorded automatically with who did it. Every change and payment is logged the same way.' },
    { title: 'Emails recorded, not yet delivered', badge: 'gap', tag: 'Needs SMTP settings',
      hl: [{ t: 'not configured', up: 2, label: 'Queued, not sent', tone: 'amber' }], y: 0, side: true,
      say: 'Its confirmation email is waiting here, but it isn’t sent until email settings are added.' },
  ] },

  // ───────────────────────────── wrap-up
  { id: 'mobile', mobileShots: ['/', '/rooms', '/rooms/royal-presidential-suite'], beats: [
    { card: { type: 'phones', eyebrow: 'Responsive', heading: 'Works on a phone, <em>no app to install</em>', imgs: [] },
      say: 'It all works on a phone. There’s no native app yet, but the website covers it.' },
  ] },
  { id: 'gaps', beats: [
    { card: gapCard(0), say: 'So, what’s not there yet?' },
    { card: gapCard(2, 1), say: 'No real payment gateway, and no link to sites like Booking.com.' },
    { card: gapCard(4, 3), say: 'Email needs setting up, and the live feed isn’t instant.' },
    { card: gapCard(6, 5), say: 'It’s one hotel, one currency, and it still needs browser and load testing.' },
  ] },
  { id: 'summary', beats: [
    { card: summaryCard(5), say: 'To sum up: no double bookings, rules in one place, one record per stay, a full audit trail, and guests who can serve themselves.' },
    { card: summaryCard(5, true), say: 'Next up: real payments, automated browser tests, cloud photo storage, and dynamic pricing.' },
  ] },
  { id: 'outro', beats: [
    { card: { type: 'title', eyebrow: 'Thank you', title: 'Maison <em>Aurelia</em>', sub: 'Hotel management where the database enforces the rules.', pills: ['Next.js', 'MySQL', 'Neo4j', 'Redis'] },
      say: 'That’s Maison Aurelia. Thanks for watching.', pad: 1.2 },
  ] },
];

// Pronunciation fixes, applied only to the spoken text (subtitles keep the original).
// Neural voices (edge-tts) need almost none; the older macOS voices need all of these.
export const SPEECH_NEURAL = [[/Neo4j/g, 'Neo4J']];
export const SPEECH = [
  [/Maison/g, 'Mayzon'], [/Neo4j/g, 'Neo 4 J'], [/MySQL/g, 'My S Q L'], [/\bSQL\b/g, 'S Q L'], [/\bAPI\b/g, 'A P I'],
  [/\bPDF\b/g, 'P D F'], [/\bCSV\b/g, 'C S V'], [/\bSMTP\b/g, 'S M T P'], [/WebSockets/g, 'web sockets'], [/Razorpay/g, 'Razor pay'],
];
