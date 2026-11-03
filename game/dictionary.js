// Fast In-Memory Offline English Dictionary & Word Chain Validator
const rawWords = require('an-array-of-english-words');
const config = require('../config');

// Load words into a Set for O(1) lookups
const dictionarySet = new Set(rawWords.map(w => w.toLowerCase()));

// Supplemental common compound words/collocations to make play smooth
const extraCompounds = [
  'basecamp', 'icecream', 'creditcard', 'highscore', 'playground',
  'superstar', 'hotdog', 'pancake', 'raincoat', 'notebook',
  'sunflower', 'popcorn', 'jellyfish', 'teacup', 'cupcake'
];
for (const word of extraCompounds) {
  dictionarySet.add(word);
}

/**
 * Validates a submitted word against game rules and the current base word.
 *
 * @param {string} rawInput - The user submitted word
 * @param {string} baseWord - The active base word to chain from
 * @param {Set<string>} usedWords - Words already played in the current game
 * @param {string} chainMode - 'compound' | 'shiritori' | 'any'
 * @returns {{ valid: boolean, reason?: string, cleanWord: string, compoundForm?: string }}
 */
function validateWord(rawInput, baseWord, usedWords, chainMode = 'compound') {
  if (!rawInput || typeof rawInput !== 'string') {
    return { valid: false, reason: 'Please enter a word.', cleanWord: '' };
  }

  const clean = rawInput.trim().toLowerCase();
  const base = (baseWord || '').trim().toLowerCase();

  // 1. Letters only
  if (!/^[a-z]+$/.test(clean)) {
    return { valid: false, reason: 'Letters only! No numbers, spaces, or symbols.', cleanWord: clean };
  }

  // 2. Minimum length check
  if (clean.length < config.RULES.MIN_WORD_LENGTH) {
    return { valid: false, reason: `Word must be at least ${config.RULES.MIN_WORD_LENGTH} letters.`, cleanWord: clean };
  }

  // 3. Cannot reuse same word as current base word
  if (clean === base) {
    return { valid: false, reason: `Cannot repeat the current base word "${baseWord}".`, cleanWord: clean };
  }

  // 4. Must not be already used in this match
  if (usedWords && usedWords.has(clean)) {
    return { valid: false, reason: `"${clean}" was already used in this game!`, cleanWord: clean };
  }

  // 5. Must exist in English dictionary
  if (!dictionarySet.has(clean)) {
    return { valid: false, reason: `"${clean}" is not in the dictionary!`, cleanWord: clean };
  }

  // 6. Chain Mode Rules
  if (chainMode === 'compound' && base) {
    const forwardCompound = base + clean;   // e.g. base + ball = baseball
    const backwardCompound = clean + base;  // e.g. air + base = airbase

    if (dictionarySet.has(forwardCompound)) {
      return {
        valid: true,
        cleanWord: clean,
        compoundForm: `${base} + ${clean} = ${forwardCompound}`
      };
    }

    if (dictionarySet.has(backwardCompound)) {
      return {
        valid: true,
        cleanWord: clean,
        compoundForm: `${clean} + ${base} = ${backwardCompound}`
      };
    }

    // Check if player entered the compound word itself (e.g. "baseball" when base is "base")
    if (clean.startsWith(base) && clean.length > base.length) {
      const suffix = clean.slice(base.length);
      if (dictionarySet.has(suffix)) {
        return {
          valid: true,
          cleanWord: suffix,
          compoundForm: `${base} + ${suffix} = ${clean}`
        };
      }
    }
    if (clean.endsWith(base) && clean.length > base.length) {
      const prefix = clean.slice(0, clean.length - base.length);
      if (dictionarySet.has(prefix)) {
        return {
          valid: true,
          cleanWord: prefix,
          compoundForm: `${prefix} + ${base} = ${clean}`
        };
      }
    }

    return {
      valid: false,
      reason: `"${clean}" does not form a compound word with "${baseWord}"!`,
      cleanWord: clean
    };
  }

  if (chainMode === 'shiritori' && base) {
    const lastChar = base.slice(-1);
    const firstChar = clean[0];
    if (firstChar !== lastChar) {
      return {
        valid: false,
        reason: `Word must start with "${lastChar.toUpperCase()}" (the last letter of "${baseWord}")!`,
        cleanWord: clean
      };
    }
  }

  return { valid: true, cleanWord: clean };
}

/**
 * Returns a random starting word from curated pool.
 */
function getRandomStartingWord(excludeWords = new Set()) {
  const pool = config.STARTING_WORDS.filter(w => !excludeWords.has(w.toLowerCase()));
  if (pool.length === 0) {
    return config.STARTING_WORDS[Math.floor(Math.random() * config.STARTING_WORDS.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = {
  validateWord,
  getRandomStartingWord,
  dictionarySet
};
