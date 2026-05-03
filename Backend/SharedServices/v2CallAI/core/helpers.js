/**
 * Attempt to clean and parse malformed JSON-like strings, especially from LLM output.
 *
 * Returns:
 * {
 *   ok: boolean,
 *   data?: any,
 *   cleaned?: string,
 *   error?: Error,
 *   steps: string[]
 * }
 */
export function parseDirtyJson(input) {
  const steps = [];

  if (input == null) {
    return {
      ok: false,
      error: new Error('Input is null or undefined'),
      steps,
    };
  }

  let text = String(input);

  // Helper to attempt parsing and return the formatted success object
  const attemptParse = (currentText, customStep) => {
    try {
      const data = JSON.parse(currentText);
      if (customStep) steps.push(customStep);
      return { ok: true, data, cleaned: currentText, steps };
    } catch (_) {
      return null;
    }
  };

  // 1. First try raw parse
  let result = attemptParse(text, 'Parsed without cleaning');
  if (result) return result;

  // 2. Basic normalisation
  text = stripBom(text, steps);
  text = normaliseNewlines(text, steps);
  text = replaceSmartQuotes(text, steps);
  text = removeZeroWidthChars(text, steps);
  text = trim(text, steps);

  result = attemptParse(text);
  if (result) return result;

  // 3. Remove markdown fences / wrappers
  text = extractFromMarkdownCodeBlock(text, steps);
  result = attemptParse(text);
  if (result) return result;

  // 4. Extract probable JSON region
  text = extractLikelyJson(text, steps);
  result = attemptParse(text);
  if (result) return result;

  // 5. Remove comments (Done before string alterations to avoid conflicts)
  text = removeComments(text, steps);
  result = attemptParse(text);
  if (result) return result;

  // 6. Conservative repairs
  text = removeTrailingCommas(text, steps);
  text = fixPythonLiterals(text, steps);
  result = attemptParse(text);
  if (result) return result;

  // 7. Aggressive repairs
  text = convertSingleQuotedStrings(text, steps);
  text = quoteUnquotedKeys(text, steps);
  result = attemptParse(text);
  if (result) return result;

  // Final failure
  return {
    ok: false,
    error: new Error('Failed to parse JSON after applying all cleaning steps.'),
    cleaned: text,
    steps,
  };
}

/* ---------------- Helpers ---------------- */

function stripBom(text, steps) {
  const next = text.replace(/^\uFEFF/, '');
  if (next !== text) steps.push('Removed BOM');
  return next;
}

function normaliseNewlines(text, steps) {
  const next = text.replace(/\r\n?/g, '\n');
  if (next !== text) steps.push('Normalised newlines');
  return next;
}

function removeZeroWidthChars(text, steps) {
  const next = text.replace(/[\u200B-\u200D\uFEFF]/g, '');
  if (next !== text) steps.push('Removed zero-width characters');
  return next;
}

function replaceSmartQuotes(text, steps) {
  const next = text
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
  if (next !== text) steps.push('Replaced smart quotes');
  return next;
}

function trim(text, steps) {
  const next = text.trim();
  if (next !== text) steps.push('Trimmed whitespace');
  return next;
}

/**
 * Extract content from markdown code fences.
 */
function extractFromMarkdownCodeBlock(text, steps) {
  const codeBlockMatch = text.match(
    /```(?:json|javascript|js)?\s*([\s\S]*?)\s*```/i
  );
  if (codeBlockMatch) {
    steps.push('Extracted content from markdown code fence');
    return codeBlockMatch[1].trim();
  }

  const next = text.replace(/^`+|`+$/g, '').trim();
  if (next !== text) steps.push('Removed wrapping backticks');
  return next;
}

/**
 * Try to extract the substring spanning the first balanced {...} or [...].
 */
function extractLikelyJson(text, steps) {
  const candidates = [];

  const obj = extractBalanced(text, '{', '}');
  if (obj) candidates.push(obj);

  const arr = extractBalanced(text, '[', ']');
  if (arr) candidates.push(arr);

  if (candidates.length === 0) return text;

  candidates.sort((a, b) => a.start - b.start);
  const chosen = candidates[0].value.trim();

  if (chosen && chosen !== text) {
    steps.push('Extracted likely JSON substring');
    return chosen;
  }

  return text;
}

function extractBalanced(text, openChar, closeChar) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let quote = null;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        inString = false;
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      escaped = false;
      continue;
    }

    if (ch === openChar) {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === closeChar) {
      depth--;
      if (depth === 0 && start !== -1) {
        return { start, end: i, value: text.slice(start, i + 1) };
      }
    }
  }

  return null;
}

/**
 * Remove trailing commas before } or ].
 * Uses a regex trick to skip over text contained within strings.
 */
function removeTrailingCommas(text, steps) {
  const next = text.replace(
    /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|(,\s*[\]}])/g,
    (match, badCommaGroup) => {
      if (badCommaGroup) {
        return match.replace(/,\s*/, ''); // Remove the comma, keep the bracket/brace
      }
      return match; // It was a string, return unchanged
    }
  );
  if (next !== text) steps.push('Removed trailing commas');
  return next;
}

/**
 * Convert Python-style literals to JSON literals.
 * Uses a regex trick to skip over text contained within strings.
 */
function fixPythonLiterals(text, steps) {
  const next = text.replace(
    /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b(None|True|False)\b/g,
    (match, pythonLiteral) => {
      if (pythonLiteral === 'None') return 'null';
      if (pythonLiteral === 'True') return 'true';
      if (pythonLiteral === 'False') return 'false';
      return match; // It was a string, return unchanged
    }
  );

  if (next !== text) steps.push('Converted Python-style literals');
  return next;
}

/**
 * Quote unquoted object keys: { foo: "bar" } -> { "foo": "bar" }
 * Uses a regex trick to skip over text contained within strings.
 */
function quoteUnquotedKeys(text, steps) {
  const next = text.replace(
    /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|([{,]\s*)([A-Za-z_$][A-Za-z0-9_\-$]*)(\s*:)/g,
    (match, prefix, key, suffix) => {
      if (key) {
        return `${prefix}"${key}"${suffix}`;
      }
      return match; // It was a string, return unchanged
    }
  );
  if (next !== text) steps.push('Quoted unquoted object keys');
  return next;
}

/**
 * Convert single-quoted strings to double-quoted strings.
 * Safely handles escapes and nested quotes.
 */
function convertSingleQuotedStrings(text, steps) {
  let next = '';
  let inDouble = false;
  let inSingle = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      if (inSingle && ch === "'") {
        // Unescape single quotes inside single-quoted strings
        // as they will now be valid inside double quotes.
        next = next.slice(0, -1);
        next += "'";
      } else {
        next += ch;
      }
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      next += ch;
      escaped = true;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      next += ch;
      continue;
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      next += '"';
      continue;
    }

    if (ch === '"' && inSingle) {
      next += '\\"';
      continue;
    }

    next += ch;
  }

  if (next !== text)
    steps.push('Converted single-quoted strings to double quotes');
  return next;
}

/**
 * Remove JS-style comments while respecting strings.
 */
function removeComments(text, steps) {
  let result = '';
  let inString = false;
  let quote = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const nextChar = text[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        result += ch;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && nextChar === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      result += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        inString = false;
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      result += ch;
      continue;
    }

    if (ch === '/' && nextChar === '/') {
      inLineComment = true;
      i++;
      continue;
    }

    if (ch === '/' && nextChar === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    result += ch;
  }

  if (result !== text) steps.push('Removed comments');
  return result;
}
