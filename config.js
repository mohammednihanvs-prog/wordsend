// Central Game Configuration and Tunable Defaults
module.exports = {
  PORT: process.env.PORT || 3000,

  // Player room constraints
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 8,

  // Tunable scoring rules
  SCORING: {
    CORRECT: 1,    // Points awarded for a correct chain word (+1)
    INCORRECT: 0,  // Points awarded for an invalid word (0)
    SKIP: -1       // Points deducted for skipping or timeout (-1)
  },

  // Lobby defaults and allowed slider/input ranges
  RULES: {
    DEFAULT_WINNING_SCORE: 10,
    MIN_WINNING_SCORE: 3,
    MAX_WINNING_SCORE: 50,

    DEFAULT_TURN_TIMER: 10, // seconds
    MIN_TURN_TIMER: 5,
    MAX_TURN_TIMER: 30,

    // Chain modes:
    // 'any'       -> Any valid unused English word (Default: fast, fun, accessible)
    // 'compound'  -> Word must form a compound word with base word (e.g. base -> ball = baseball)
    // 'shiritori' -> Word must start with base word's last letter (e.g. base -> elephant)
    DEFAULT_CHAIN_MODE: 'any',
    CHAIN_MODES: ['any', 'compound', 'shiritori'],

    // Anti-stall trigger: number of full cycles of all players skipping/failing before server resets base word
    ANTI_STALL_CYCLES: 1,

    MIN_WORD_LENGTH: 2
  },

  // Curated starting words that have abundant compounds and easy accessibility
  STARTING_WORDS: [
    'base', 'ball', 'fire', 'water', 'sun', 'snow', 'rain', 'book',
    'play', 'light', 'room', 'car', 'time', 'sea', 'hand', 'head',
    'foot', 'air', 'star', 'dog', 'cat', 'gold', 'moon', 'ice',
    'news', 'bird', 'ship', 'box', 'eye', 'wind', 'rock', 'work',
    'road', 'life', 'door', 'home', 'back', 'land', 'side', 'line',
    'wood', 'card', 'post', 'free', 'down', 'blue', 'black', 'white'
  ],

  // Available fun avatars and color palettes for players
  AVATARS: [
    { emoji: '🦊', color: '#ff7675', name: 'Fox' },
    { emoji: '🐼', color: '#74b9ff', name: 'Panda' },
    { emoji: '🦁', color: '#ffeaa7', name: 'Lion' },
    { emoji: '🐸', color: '#55efc4', name: 'Frog' },
    { emoji: '🦄', color: '#a29bfe', name: 'Unicorn' },
    { emoji: '🐯', color: '#fab1a0', name: 'Tiger' },
    { emoji: '🐙', color: '#fd79a8', name: 'Octopus' },
    { emoji: '🐨', color: '#dfe6e9', name: 'Koala' }
  ]
};
