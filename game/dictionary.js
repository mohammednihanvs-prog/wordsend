// Fast In-Memory Offline English Dictionary & Word Chain Validator
// Enhanced with Dynamic Wiktionary, Wikipedia OpenSearch & Datamuse Resolution

const rawWords = require('an-array-of-english-words');
const config = require('../config');
const { KNOWN_COMPOUNDS } = require('./compounds');
const https = require('https');

// Load words into a Set for O(1) lookups
const dictionarySet = new Set(rawWords.map(w => w.toLowerCase()));

// Supplemental common compound words/collocations to make play smooth
const compoundSet = new Set(KNOWN_COMPOUNDS.map(w => w.toLowerCase()));
for (const word of compoundSet) {
  dictionarySet.add(word.replace(/[^a-z]/g, ''));
}

// In-memory dynamic cache for words verified during runtime
const dynamicVerifiedCompounds = new Map();

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Checks Wiktionary for a batch of phrase titles in a single HTTP request.
 * @param {string[]} phrases
 * @returns {Promise<Set<string>>}
 */
function queryDynamicWiktionary(phrases) {
  return new Promise((resolve) => {
    if (!phrases || phrases.length === 0) return resolve(new Set());
    const validPhrases = phrases.filter(p => p && p.length >= 2);
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
 * Checks Wikipedia OpenSearch for phrase or compound concepts.
 * @param {string} query
 * @returns {Promise<string|null>}
 */
function queryWikipediaOpenSearch(query) {
  return new Promise((resolve) => {
    if (!query || query.length < 3) return resolve(null);
    const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json`;

    const req = https.get(url, {
      headers: { 'User-Agent': 'WordsendApp/2.0 (realtime word chain game)' },
      timeout: 1600
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const results = json[1] || [];
          if (results.length > 0) {
            const first = results[0].toLowerCase();
            const cleanQ = query.toLowerCase().replace(/[^a-z]/g, '');
            const cleanF = first.replace(/[^a-z]/g, '');
            if (cleanF === cleanQ || cleanF.startsWith(cleanQ) || first.includes(query.toLowerCase())) {
              return resolve(results[0]);
            }
          }
          resolve(null);
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Checks Datamuse for natural English word collocations.
 * @param {string} first
 * @param {string} second
 * @returns {Promise<boolean>}
 */
function queryDatamuseCollocation(first, second) {
  return new Promise((resolve) => {
    if (!first || !second) return resolve(false);
    const url = `https://api.datamuse.com/words?rel_bga=${encodeURIComponent(first)}&max=200`;

    const req = https.get(url, {
      headers: { 'User-Agent': 'WordsendApp/2.0' },
      timeout: 1500
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const hasWord = Array.isArray(list) && list.some(item => item.word && item.word.toLowerCase() === second.toLowerCase());
          resolve(hasWord);
        } catch {
          resolve(false);
        }
      });
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
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

  const rawClean = rawInput.trim().toLowerCase();
  const clean = rawClean.replace(/[^a-z]/g, '');
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
  if (usedWords && (usedWords.has(clean) || usedWords.has(rawClean))) {
    return { valid: false, reason: `"${clean}" was already played in this game!`, cleanWord: clean };
  }

  // 4. Compound Word Verification
  if (base) {
    // --- Step 0: Check if player entered the full compound (e.g. "heart attack" or "downsyndrome") ---
    if (rawClean.includes(' ') || clean.length > base.length) {
      // Forward prefix check: starts with base
      if (rawClean.startsWith(base + ' ')) {
        const wordPart = rawClean.slice(base.length + 1).trim().replace(/[^a-z]/g, '');
        if (wordPart.length >= config.RULES.MIN_WORD_LENGTH) {
          return {
            valid: true,
            cleanWord: wordPart,
            compoundWord: `${base} ${wordPart}`,
            compoundForm: `${base} + ${wordPart} = ${base} ${wordPart}`
          };
        }
      }
      if (clean.startsWith(base) && clean.length > base.length) {
        const wordPart = clean.slice(base.length);
        if (wordPart.length >= config.RULES.MIN_WORD_LENGTH) {
          const formName = `${base} + ${wordPart} = ${clean}`;
          return {
            valid: true,
            cleanWord: wordPart,
            compoundWord: clean,
            compoundForm: formName
          };
        }
      }

      // Backward suffix check: ends with base
      if (rawClean.endsWith(' ' + base)) {
        const wordPart = rawClean.slice(0, rawClean.length - (base.length + 1)).trim().replace(/[^a-z]/g, '');
        if (wordPart.length >= config.RULES.MIN_WORD_LENGTH) {
          return {
            valid: true,
            cleanWord: wordPart,
            compoundWord: `${wordPart} ${base}`,
            compoundForm: `${wordPart} + ${base} = ${wordPart} ${base}`
          };
        }
      }
      if (clean.endsWith(base) && clean.length > base.length) {
        const wordPart = clean.slice(0, clean.length - base.length);
        if (wordPart.length >= config.RULES.MIN_WORD_LENGTH) {
          const formName = `${wordPart} + ${base} = ${clean}`;
          return {
            valid: true,
            cleanWord: wordPart,
            compoundWord: clean,
            compoundForm: formName
          };
        }
      }
    }

    // --- Step A: Fast In-Memory Check (0ms) ---
    const forwardClosed = base + clean;
    const forwardOpen = `${base} ${clean}`;
    if ((dictionarySet.has(forwardClosed) || compoundSet.has(forwardClosed) || compoundSet.has(forwardOpen)) &&
        (!usedWords || (!usedWords.has(forwardClosed) && !usedWords.has(forwardOpen)))) {
      return {
        valid: true,
        cleanWord: clean,
        compoundWord: forwardClosed,
        compoundForm: `${base} + ${clean} = ${forwardClosed}`
      };
    }

    const backwardClosed = clean + base;
    const backwardOpen = `${clean} ${base}`;
    if ((dictionarySet.has(backwardClosed) || compoundSet.has(backwardClosed) || compoundSet.has(backwardOpen)) &&
        (!usedWords || (!usedWords.has(backwardClosed) && !usedWords.has(backwardOpen)))) {
      return {
        valid: true,
        cleanWord: clean,
        compoundWord: backwardClosed,
        compoundForm: `${clean} + ${base} = ${backwardClosed}`
      };
    }

    // Check in-memory dynamic cache from prior lookups
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

    // --- Step C: Dynamic Live Wiktionary Lookup (with title-case support) ---
    const candidateOpenFwd = `${base} ${clean}`;
    const candidateOpenBwd = `${clean} ${base}`;
    const candidateOpenFwdCap = `${capitalize(base)} ${clean}`;
    const candidateOpenBwdCap = `${capitalize(clean)} ${base}`;
    const candidateOpenFwdSingular = cleanSingular ? `${base} ${cleanSingular}` : '';
    const candidateOpenBwdSingular = cleanSingular ? `${cleanSingular} ${base}` : '';
    const candidateOpenFwdSingularCap = cleanSingular ? `${capitalize(base)} ${cleanSingular}` : '';

    const batch = [
      candidateOpenFwd,
      candidateOpenBwd,
      candidateOpenFwdCap,
      candidateOpenBwdCap,
      forwardClosed,
      backwardClosed,
      candidateOpenFwdSingular,
      candidateOpenBwdSingular,
      candidateOpenFwdSingularCap
    ].filter(Boolean);

    try {
      const matchedSet = await queryDynamicWiktionary(batch);

      // Check Forward matches
      if (matchedSet.has(candidateOpenFwd) || matchedSet.has(candidateOpenFwdCap) ||
          matchedSet.has(forwardClosed) ||
          (candidateOpenFwdSingular && (matchedSet.has(candidateOpenFwdSingular) || matchedSet.has(candidateOpenFwdSingularCap)))) {
        const title = matchedSet.has(candidateOpenFwd) ? candidateOpenFwd
          : matchedSet.has(candidateOpenFwdCap) ? candidateOpenFwdCap
          : matchedSet.has(forwardClosed) ? forwardClosed
          : candidateOpenFwdSingular;
        const form = `${base} + ${clean} = ${title}`;

        dynamicVerifiedCompounds.set(cacheKeyFwd, { compoundWord: title, compoundForm: form });
        compoundSet.add(forwardClosed);
        compoundSet.add(candidateOpenFwd);
        dictionarySet.add(clean);

        return {
          valid: true,
          cleanWord: clean,
          compoundWord: title,
          compoundForm: form
        };
      }

      // Check Backward matches
      if (matchedSet.has(candidateOpenBwd) || matchedSet.has(candidateOpenBwdCap) ||
          matchedSet.has(backwardClosed) ||
          (candidateOpenBwdSingular && matchedSet.has(candidateOpenBwdSingular))) {
        const title = matchedSet.has(candidateOpenBwd) ? candidateOpenBwd
          : matchedSet.has(candidateOpenBwdCap) ? candidateOpenBwdCap
          : matchedSet.has(backwardClosed) ? backwardClosed
          : candidateOpenBwdSingular;
        const form = `${clean} + ${base} = ${title}`;

        dynamicVerifiedCompounds.set(cacheKeyBwd, { compoundWord: title, compoundForm: form });
        compoundSet.add(backwardClosed);
        compoundSet.add(candidateOpenBwd);
        dictionarySet.add(clean);

        return {
          valid: true,
          cleanWord: clean,
          compoundWord: title,
          compoundForm: form
        };
      }
    } catch {
      // Ignore network errors and continue
    }

    // --- Step D: Wikipedia OpenSearch Resolution ---
    try {
      const wikiFwd = await queryWikipediaOpenSearch(candidateOpenFwd);
      if (wikiFwd) {
        const form = `${base} + ${clean} = ${wikiFwd}`;
        dynamicVerifiedCompounds.set(cacheKeyFwd, { compoundWord: wikiFwd, compoundForm: form });
        compoundSet.add(forwardClosed);
        compoundSet.add(candidateOpenFwd);
        dictionarySet.add(clean);
        return {
          valid: true,
          cleanWord: clean,
          compoundWord: wikiFwd,
          compoundForm: form
        };
      }

      const wikiBwd = await queryWikipediaOpenSearch(candidateOpenBwd);
      if (wikiBwd) {
        const form = `${clean} + ${base} = ${wikiBwd}`;
        dynamicVerifiedCompounds.set(cacheKeyBwd, { compoundWord: wikiBwd, compoundForm: form });
        compoundSet.add(backwardClosed);
        compoundSet.add(candidateOpenBwd);
        dictionarySet.add(clean);
        return {
          valid: true,
          cleanWord: clean,
          compoundWord: wikiBwd,
          compoundForm: form
        };
      }
    } catch {}

    // --- Step E: Datamuse Collocation Check ---
    try {
      const isDatamuseFwd = await queryDatamuseCollocation(base, clean);
      if (isDatamuseFwd) {
        const title = `${base} ${clean}`;
        const form = `${base} + ${clean} = ${title}`;
        dynamicVerifiedCompounds.set(cacheKeyFwd, { compoundWord: title, compoundForm: form });
        compoundSet.add(forwardClosed);
        compoundSet.add(title);
        dictionarySet.add(clean);
        return {
          valid: true,
          cleanWord: clean,
          compoundWord: title,
          compoundForm: form
        };
      }

      const isDatamuseBwd = await queryDatamuseCollocation(clean, base);
      if (isDatamuseBwd) {
        const title = `${clean} ${base}`;
        const form = `${clean} + ${base} = ${title}`;
        dynamicVerifiedCompounds.set(cacheKeyBwd, { compoundWord: title, compoundForm: form });
        compoundSet.add(backwardClosed);
        compoundSet.add(title);
        dictionarySet.add(clean);
        return {
          valid: true,
          cleanWord: clean,
          compoundWord: title,
          compoundForm: form
        };
      }
    } catch {}

    // --- Step F: Noun-Noun Adjunct Pair Heuristic ("dont limit to a dictionary") ---
    // If both words are recognized English words (>= 2 letters) and not stopwords:
    const commonStopwords = new Set([
      'the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'were', 'been',
      'they', 'what', 'when', 'then', 'than', 'into', 'just', 'more', 'some', 'such'
    ]);

    if (dictionarySet.has(clean) && !commonStopwords.has(clean) && clean.length >= 3) {
      // Both words are valid English words! Accept as natural noun compound:
      const title = `${base} ${clean}`;
      const form = `${base} + ${clean} = ${title}`;
      dynamicVerifiedCompounds.set(cacheKeyFwd, { compoundWord: title, compoundForm: form });
      compoundSet.add(forwardClosed);
      compoundSet.add(title);

      return {
        valid: true,
        cleanWord: clean,
        compoundWord: title,
        compoundForm: form
      };
    }

    // --- Informative Rejection for gibberish ---
    if (!dictionarySet.has(clean)) {
      return {
        valid: false,
        reason: `"${clean}" is not in the dictionary.`,
        cleanWord: clean
      };
    }

    return {
      valid: false,
      reason: `"${clean}" does not pair with "${baseWord}".`,
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
