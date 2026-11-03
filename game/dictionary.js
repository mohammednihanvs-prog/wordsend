// Fast In-Memory Offline English Dictionary & Word Chain Validator
const rawWords = require('an-array-of-english-words');
const config = require('../config');
const { KNOWN_COMPOUNDS } = require('./compounds');

// Load words into a Set for O(1) lookups
const dictionarySet = new Set(rawWords.map(w => w.toLowerCase()));

// Supplemental common compound words/collocations to make play smooth
const compoundSet = new Set(KNOWN_COMPOUNDS.map(w => w.toLowerCase()));
for (const word of compoundSet) {
  dictionarySet.add(word);
}

/**
 * Validates a submitted word against game rules and the current base word for compound word chaining.
 *
 * @param {string} rawInput - The user submitted word
 * @param {string} baseWord - The active base word to chain from
 * @param {Set<string>} usedWords - Words already played in the current game
 * @returns {{ valid: boolean, reason?: string, cleanWord: string, compoundForm?: string, compoundWord?: string }}
 */
function validateWord(rawInput, baseWord, usedWords) {
  if (!rawInput || typeof rawInput !== 'string') {
    return { valid: false, reason: 'Please enter a word.', cleanWord: '' };
  }

  // Clean input: lowercase and remove any stray punctuation/spaces
  const clean = rawInput.trim().toLowerCase().replace(/[^a-z]/g, '');
  const base = (baseWord || '').trim().toLowerCase().replace(/[^a-z]/g, '');

  if (clean.length === 0) {
    return { valid: false, reason: 'Please enter a valid word.', cleanWord: '' };
  }

  // 1. Minimum length check
  if (clean.length < config.RULES.MIN_WORD_LENGTH) {
    return { valid: false, reason: `Word must be at least ${config.RULES.MIN_WORD_LENGTH} letters.`, cleanWord: clean };
  }

  // 2. Cannot repeat the current base word
  if (clean === base) {
    return { valid: false, reason: `Cannot repeat the current base word "${baseWord}".`, cleanWord: clean };
  }

  // 3. Must not be already used in this match
  if (usedWords && usedWords.has(clean)) {
    return { valid: false, reason: `"${clean}" was already played in this game!`, cleanWord: clean };
  }

  // 4. Compound Word Verification
  if (base) {
    // Check A: Forward compound: base + clean (e.g. base + ball = baseball)
    const forward = base + clean;
    if ((dictionarySet.has(forward) || compoundSet.has(forward)) && (!usedWords || !usedWords.has(forward))) {
      return {
        valid: true,
        cleanWord: clean,
        compoundWord: forward,
        compoundForm: `${base} + ${clean} = ${forward}`
      };
    }

    // Check B: Backward compound: clean + base (e.g. foot + ball = football)
    const backward = clean + base;
    if ((dictionarySet.has(backward) || compoundSet.has(backward)) && (!usedWords || !usedWords.has(backward))) {
      return {
        valid: true,
        cleanWord: clean,
        compoundWord: backward,
        compoundForm: `${clean} + ${base} = ${backward}`
      };
    }

    // Check C: Did player enter the full compound word itself?
    // e.g. base is "base", player typed "baseball" -> extracted suffix is "ball"
    if (clean.startsWith(base) && clean.length > base.length) {
      const suffix = clean.slice(base.length);
      if (suffix.length >= config.RULES.MIN_WORD_LENGTH) {
        const fullWord = clean;
        if ((dictionarySet.has(fullWord) || compoundSet.has(fullWord) || dictionarySet.has(suffix)) &&
            (!usedWords || (!usedWords.has(suffix) && !usedWords.has(fullWord)))) {
          return {
            valid: true,
            cleanWord: suffix,
            compoundWord: fullWord,
            compoundForm: `${base} + ${suffix} = ${fullWord}`
          };
        }
      }
    }

    // e.g. base is "ball", player typed "football" -> extracted prefix is "foot"
    if (clean.endsWith(base) && clean.length > base.length) {
      const prefix = clean.slice(0, clean.length - base.length);
      if (prefix.length >= config.RULES.MIN_WORD_LENGTH) {
        const fullWord = clean;
        if ((dictionarySet.has(fullWord) || compoundSet.has(fullWord) || dictionarySet.has(prefix)) &&
            (!usedWords || (!usedWords.has(prefix) && !usedWords.has(fullWord)))) {
          return {
            valid: true,
            cleanWord: prefix,
            compoundWord: fullWord,
            compoundForm: `${prefix} + ${base} = ${fullWord}`
          };
        }
      }
    }

    // Check if the word itself is in the dictionary or not
    if (!dictionarySet.has(clean)) {
      return {
        valid: false,
        reason: `"${clean}" is not in the dictionary.`,
        cleanWord: clean
      };
    }

    return {
      valid: false,
      reason: `"${clean}" does not form a compound word with "${baseWord}".`,
      cleanWord: clean
    };
  }

  // Fallback if no base word yet
  if (!dictionarySet.has(clean)) {
    return { valid: false, reason: `"${clean}" is not in the dictionary!`, cleanWord: clean };
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
  dictionarySet,
  compoundSet
};
