// Fast In-Memory Offline English Dictionary & Word Chain Validator
// Enhanced with Dynamic Wiktionary & Open Compound Resolution

const rawWords = require('an-array-of-english-words');
const config = require('../config');
const { KNOWN_COMPOUNDS } = require('./compounds');
const https = require('https');

// Load words into a Set for O(1) lookups
const dictionarySet = new Set(rawWords.map(w => w.toLowerCase()));

// Supplemental common compound words/collocations to make play smooth
const compoundSet = new Set(KNOWN_COMPOUNDS.map(w => w.toLowerCase()));
for (const word of compoundSet) {
  dictionarySet.add(word);
}

// In-memory dynamic cache for words verified during runtime
const dynamicVerifiedCompounds = new Map();

/**
 * Checks Wiktionary for a batch of phrase titles in a single HTTP request.
 * @param {string[]} phrases
 * @returns {Promise<Set<string>>}
 */
function queryDynamicWiktionary(phrases) {
  return new Promise((resolve) => {
    if (!phrases || phrases.length === 0) return resolve(new Set());
    const validPhrases = phrases.filter(p => p && p.length >= 3);
    if (validPhrases.length === 0) return resolve(new Set());

    const titles = validPhrases.map(p => encodeURIComponent(p)).join('|');
    const url = `https://en.wiktionary.org/w/api.php?action=query&titles=${titles}&format=json`;

    const req = https.get(url, {
      headers: { 'User-Agent': 'WordsendApp/2.0 (realtime word chain game)' },
      timeout: 1800
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const pages = json.query ? json.query.pages : {};
          const matched = new Set();
          for (const pid of Object.keys(pages)) {
            const page = pages[pid];
            if (page && Number(pid) > 0 && page.missing === undefined && page.title) {
              matched.add(page.title.toLowerCase());
            }
          }
          resolve(matched);
        } catch {
          resolve(new Set());
        }
      });
    });

    req.on('error', () => resolve(new Set()));
    req.on('timeout', () => {
      req.destroy();
      resolve(new Set());
    });
  });
}

/**
 * Validates a submitted word against game rules and the current base word for compound word chaining.
 *
 * @param {string} rawInput - The user submitted word
 * @param {string} baseWord - The active base word to chain from
 * @param {Set<string>} usedWords - Words already played in the current game
 * @returns {Promise<{ valid: boolean, reason?: string, cleanWord: string, compoundForm?: string, compoundWord?: string }>}
 */
async function validateWord(rawInput, baseWord, usedWords) {
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
    // --- Step A: Fast In-Memory Check (0ms) ---
    const forwardClosed = base + clean;
    if ((dictionarySet.has(forwardClosed) || compoundSet.has(forwardClosed)) && (!usedWords || !usedWords.has(forwardClosed))) {
      return {
        valid: true,
        cleanWord: clean,
        compoundWord: forwardClosed,
        compoundForm: `${base} + ${clean} = ${forwardClosed}`
      };
    }

    const backwardClosed = clean + base;
    if ((dictionarySet.has(backwardClosed) || compoundSet.has(backwardClosed)) && (!usedWords || !usedWords.has(backwardClosed))) {
      return {
        valid: true,
        cleanWord: clean,
        compoundWord: backwardClosed,
        compoundForm: `${clean} + ${base} = ${backwardClosed}`
      };
    }

    // Check if player entered the full compound word itself: e.g. "baseball" when base is "base"
    if (clean.startsWith(base) && clean.length > base.length) {
      const suffix = clean.slice(base.length);
      if (suffix.length >= config.RULES.MIN_WORD_LENGTH) {
        if ((dictionarySet.has(clean) || compoundSet.has(clean) || dictionarySet.has(suffix)) &&
            (!usedWords || (!usedWords.has(suffix) && !usedWords.has(clean)))) {
          return {
            valid: true,
            cleanWord: suffix,
            compoundWord: clean,
            compoundForm: `${base} + ${suffix} = ${clean}`
          };
        }
      }
    }

    // e.g. "football" when base is "ball"
    if (clean.endsWith(base) && clean.length > base.length) {
      const prefix = clean.slice(0, clean.length - base.length);
      if (prefix.length >= config.RULES.MIN_WORD_LENGTH) {
        if ((dictionarySet.has(clean) || compoundSet.has(clean) || dictionarySet.has(prefix)) &&
            (!usedWords || (!usedWords.has(prefix) && !usedWords.has(clean)))) {
          return {
            valid: true,
            cleanWord: prefix,
            compoundWord: clean,
            compoundForm: `${prefix} + ${base} = ${clean}`
          };
        }
      }
    }

    // Check in-memory dynamic cache from prior queries
    const cacheKeyFwd = `${base}_${clean}`;
    if (dynamicVerifiedCompounds.has(cacheKeyFwd)) {
      const info = dynamicVerifiedCompounds.get(cacheKeyFwd);
      return { valid: true, cleanWord: clean, compoundWord: info.compoundWord, compoundForm: info.compoundForm };
    }
    const cacheKeyBwd = `${clean}_${base}`;
    if (dynamicVerifiedCompounds.has(cacheKeyBwd)) {
      const info = dynamicVerifiedCompounds.get(cacheKeyBwd);
      return { valid: true, cleanWord: clean, compoundWord: info.compoundWord, compoundForm: info.compoundForm };
    }

    // --- Step B: Plural & Lemmatization Normalization ---
    let cleanSingular = '';
    if (clean.endsWith('s') && clean.length > 3) {
      cleanSingular = clean.slice(0, -1);
    }
    let cleanSingularEs = '';
    if (clean.endsWith('es') && clean.length > 4) {
      cleanSingularEs = clean.slice(0, -2);
    }

    // --- Step C: Dynamic Live Wiktionary Lookup ---
    const candidateOpenFwd = `${base} ${clean}`;
    const candidateOpenBwd = `${clean} ${base}`;
    const candidateOpenFwdSingular = cleanSingular ? `${base} ${cleanSingular}` : '';
    const candidateOpenBwdSingular = cleanSingular ? `${cleanSingular} ${base}` : '';
    const candidateOpenFwdEs = cleanSingularEs ? `${base} ${cleanSingularEs}` : '';

    const batch = [
      candidateOpenFwd,
      candidateOpenBwd,
      forwardClosed,
      backwardClosed,
      candidateOpenFwdSingular,
      candidateOpenBwdSingular,
      candidateOpenFwdEs
    ].filter(Boolean);

    try {
      const matchedSet = await queryDynamicWiktionary(batch);

      // Check Forward matches
      if (matchedSet.has(candidateOpenFwd) || matchedSet.has(forwardClosed) ||
          (candidateOpenFwdSingular && matchedSet.has(candidateOpenFwdSingular)) ||
          (candidateOpenFwdEs && matchedSet.has(candidateOpenFwdEs))) {
        const title = matchedSet.has(candidateOpenFwd) ? candidateOpenFwd
          : matchedSet.has(forwardClosed) ? forwardClosed
          : candidateOpenFwdSingular && matchedSet.has(candidateOpenFwdSingular) ? candidateOpenFwdSingular
          : candidateOpenFwdEs;
        const form = `${base} + ${clean} = ${title}`;

        // Cache dynamically for instant 0ms on repeat
        dynamicVerifiedCompounds.set(cacheKeyFwd, { compoundWord: title, compoundForm: form });
        compoundSet.add(forwardClosed);
        dictionarySet.add(forwardClosed);
        dictionarySet.add(clean);

        return {
          valid: true,
          cleanWord: clean,
          compoundWord: title,
          compoundForm: form
        };
      }

      // Check Backward matches
      if (matchedSet.has(candidateOpenBwd) || matchedSet.has(backwardClosed) ||
          (candidateOpenBwdSingular && matchedSet.has(candidateOpenBwdSingular))) {
        const title = matchedSet.has(candidateOpenBwd) ? candidateOpenBwd
          : matchedSet.has(backwardClosed) ? backwardClosed
          : candidateOpenBwdSingular;
        const form = `${clean} + ${base} = ${title}`;

        dynamicVerifiedCompounds.set(cacheKeyBwd, { compoundWord: title, compoundForm: form });
        compoundSet.add(backwardClosed);
        dictionarySet.add(backwardClosed);
        dictionarySet.add(clean);

        return {
          valid: true,
          cleanWord: clean,
          compoundWord: title,
          compoundForm: form
        };
      }
    } catch {
      // Ignore network errors and continue to local fallback
    }

    // --- Step D: Informative Rejection ---
    if (!dictionarySet.has(clean) && !cleanSingular) {
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
