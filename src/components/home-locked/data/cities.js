/**
 * STEP 06 — BULGARIA MAP CITY DATA
 * Geographic coordinates are real-world city coordinates (WGS84).
 * visualAnchor is calibrated to the EXISTING locked raster and must not be
 * moved merely to make the geographic projection look cleaner.
 */
export const CITIES = [
  {
    id: "vidin",
    name: "Видин",
    lat: 43.99159,
    lon: 22.88236,
    active: false,
    visualAnchor: { xPct: 17.75, yPct: 20.05 },
    hitBox: { leftPct: 15.5, topPct: 18.8, widthPct: 4.5, heightPct: 2.5 },
  },
  {
    id: "ruse",
    name: "Русе",
    lat: 43.84872,
    lon: 25.9534,
    active: false,
    visualAnchor: { xPct: 36.05, yPct: 17.75 },
    hitBox: { leftPct: 34.3, topPct: 16.5, widthPct: 3.5, heightPct: 2.5 },
  },
  {
    id: "pleven",
    name: "Плевен",
    lat: 43.41791,
    lon: 24.61666,
    active: false,
    visualAnchor: { xPct: 28.75, yPct: 26.25 },
    hitBox: { leftPct: 26.5, topPct: 25.0, widthPct: 4.5, heightPct: 2.5 },
  },
  {
    id: "veliko-tarnovo",
    name: "Велико Търново",
    lat: 43.08124,
    lon: 25.62904,
    active: false,
    visualAnchor: { xPct: 38.5, yPct: 30.25 },
    hitBox: { leftPct: 34.0, topPct: 29.0, widthPct: 9.0, heightPct: 2.5 },
  },
  {
    id: "shumen",
    name: "Шумен",
    lat: 43.27064,
    lon: 26.92286,
    active: true,
    visualAnchor: { xPct: 46.7, yPct: 23.25 },
    hitBox: { leftPct: 44.3, topPct: 22.0, widthPct: 4.8, heightPct: 2.5 },
  },
  {
    id: "varna",
    name: "Варна",
    lat: 43.21912,
    lon: 27.91024,
    active: true,
    visualAnchor: { xPct: 50.55, yPct: 31.65 },
    hitBox: { leftPct: 48.3, topPct: 30.4, widthPct: 4.5, heightPct: 2.5 },
  },
  {
    id: "sofia",
    name: "София",
    lat: 42.69751,
    lon: 23.32415,
    active: false,
    visualAnchor: { xPct: 18.75, yPct: 36.25 },
    hitBox: { leftPct: 16.0, topPct: 35.0, widthPct: 5.5, heightPct: 2.5 },
  },
  {
    id: "plovdiv",
    name: "Пловдив",
    lat: 42.15387,
    lon: 24.75001,
    active: false,
    visualAnchor: { xPct: 31.9, yPct: 41.75 },
    hitBox: { leftPct: 29.0, topPct: 40.5, widthPct: 5.8, heightPct: 2.5 },
  },
  {
    id: "burgas",
    name: "Бургас",
    lat: 42.50651,
    lon: 27.46886,
    active: true,
    visualAnchor: { xPct: 50.55, yPct: 40.05 },
    hitBox: { leftPct: 48.3, topPct: 38.8, widthPct: 4.5, heightPct: 2.5 },
  },
  {
    id: "blagoevgrad",
    name: "Благоевград",
    lat: 42.01457,
    lon: 23.09804,
    active: false,
    visualAnchor: { xPct: 15.75, yPct: 50.25 },
    hitBox: { leftPct: 12.0, topPct: 49.0, widthPct: 7.5, heightPct: 2.5 },
  },
  {
    id: "smolyan",
    name: "Смолян",
    lat: 41.57439,
    lon: 24.71204,
    active: false,
    visualAnchor: { xPct: 27.75, yPct: 51.45 },
    hitBox: { leftPct: 24.5, topPct: 50.2, widthPct: 6.5, heightPct: 2.5 },
  },
];

export const ACTIVE_CITY_IDS = CITIES.filter((c) => c.active).map((c) => c.id);
