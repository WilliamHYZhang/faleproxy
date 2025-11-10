const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const DEFAULT_PORT = process.env.PORT || 3001;
const TARGET_TERM = 'Yale';
const REPLACEMENT_TERM = 'Fale';

// Middleware to parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * Replace occurrences of "Yale" with "Fale" while preserving the character
 * casing pattern of the original match.
 * @param {string} text
 * @returns {string}
 */
function replaceYaleWithFale(text) {
  if (typeof text !== 'string' || !text) {
    return text;
  }

  const replacement = REPLACEMENT_TERM;
  const pattern = new RegExp(TARGET_TERM, 'gi');

  return text.replace(pattern, (match) => {
    return replacement
      .split('')
      .map((char, index) => {
        const originalChar = match[index] || '';
        if (!originalChar) {
          return char;
        }

        if (originalChar === originalChar.toUpperCase()) {
          return char.toUpperCase();
        }

        if (originalChar === originalChar.toLowerCase()) {
          return char.toLowerCase();
        }

        return char;
      })
      .join('');
  });
}

/**
 * Apply replacement logic to a Cheerio instance, updating text nodes and
 * titles while leaving URLs and attributes untouched.
 * @param {import('cheerio').CheerioAPI} $
 */
function applyYaleToFaleTransform($) {
  const scope = $('body').length ? $('body') : $.root();

  scope
    .find('*')
    .addBack()
    .contents()
    .filter(function filterTextNodes() {
      return this.type === 'text';
    })
    .each(function transformNode() {
      const original = typeof this.data === 'string' ? this.data : '';
      if (!original) {
        return;
      }

      const updated = replaceYaleWithFale(original);
      if (original !== updated) {
        $(this).replaceWith(updated);
      }
    });

  $('title').each((_, element) => {
    const $element = $(element);
    const originalTitle = $element.text();
    const updatedTitle = replaceYaleWithFale(originalTitle);
    if (originalTitle !== updatedTitle) {
      $element.text(updatedTitle);
    }
  });
}

/**
 * Transform raw HTML content by applying Yale → Fale replacements.
 * @param {string} html
 * @returns {import('cheerio').CheerioAPI}
 */
function transformHtml(html) {
  const $ = cheerio.load(html);
  applyYaleToFaleTransform($);
  return $;
}

// API endpoint to fetch and modify content
app.post('/fetch', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const response = await axios.get(url);
    const $ = transformHtml(response.data);

    return res.json({
      success: true,
      content: $.html(),
      title: $('title').text(),
      originalUrl: url
    });
  } catch (error) {
    console.error('Error fetching URL:', error.message);
    return res.status(500).json({
      error: `Failed to fetch content: ${error.message}`
    });
  }
});

if (require.main === module) {
  app.listen(DEFAULT_PORT, () => {
    console.log(`Faleproxy server running at http://localhost:${DEFAULT_PORT}`);
  });
}

module.exports = app;
module.exports.app = app;
module.exports.replaceYaleWithFale = replaceYaleWithFale;
module.exports.applyYaleToFaleTransform = applyYaleToFaleTransform;
module.exports.transformHtml = transformHtml;
module.exports.DEFAULT_PORT = DEFAULT_PORT;
module.exports.TARGET_TERM = TARGET_TERM;
module.exports.REPLACEMENT_TERM = REPLACEMENT_TERM;
