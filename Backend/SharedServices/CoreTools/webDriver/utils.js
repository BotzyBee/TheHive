import { JSDOM } from 'jsdom';
import { Ok, Err } from '../../Utils/helperFunctions.js';

/**
 * Cleans an HTML string and extracts unique URLs.
 * @param {string} htmlString - The raw HTML content.
 * @param {string} baseUrl - Required to resolve relative links and compute styles properly.
 */
export async function cleanHtmlString(htmlString, baseUrl = 'http://localhost') {
    try {
        const dom = new JSDOM(htmlString, { url: baseUrl });
        const { document, window } = dom.window;

        // 1. Combine all removals into a single query for performance
        const elementsToRemove = [
            'style', 'script', 'svg', 'iframe', 'noscript', 'canvas', 'video', 'audio',
            '.cookie-banner', '#gdpr-dialog', '.social-share-buttons', '.share-bar',
            '.ad-container', '#ad-block', '[aria-hidden="true"]',
            // Fast inline-style hiding check (replaces the slow getComputedStyle loop)
            '[hidden]', '[style*="display: none"]', '[style*="display:none"]', '[style*="visibility: hidden"]'
        ];

        document.querySelectorAll(elementsToRemove.join(', ')).forEach(el => el.remove());

        // 2. Remove HTML comments to save tokens
        const walker = document.createTreeWalker(document.body, window.NodeFilter.SHOW_COMMENT, null, false);
        let currentNode;
        const comments = [];
        while ((currentNode = walker.nextNode())) {
            comments.push(currentNode);
        }
        comments.forEach(comment => comment.remove());

        // 3. Extract valid HTTP/HTTPS URLs
        const urls = new Set();
        document.querySelectorAll('a[href]').forEach(a => {
            const href = a.getAttribute('href');
            if (href) {
                try {
                    const urlObj = new URL(href, baseUrl);
                    // Only keep web links (drop mailto:, tel:, javascript:)
                    if (['http:', 'https:'].includes(urlObj.protocol)) {
                        urls.add(urlObj.href);
                    }
                } catch (e) {
                    // Ignore invalid URLs
                }
            }
        });

        // 4. Aggressive Attribute Stripping (Whitelist approach)
        const allowedAttributes = ['href', 'src', 'alt'];
        document.querySelectorAll('body *').forEach(el => {
            // Iterate backwards because NodeList updates live as attributes are removed
            for (let i = el.attributes.length - 1; i >= 0; i--) {
                const attrName = el.attributes[i].name;
                if (!allowedAttributes.includes(attrName)) {
                    el.removeAttribute(attrName);
                }
            }
        });

        // 5. Minify whitespace (Collapses newlines, tabs, and multi-spaces)
        const minifiedHtml = document.body.innerHTML
            .replace(/\s+/g, ' ')
            .trim();

        return Ok({
            cleanedHtml: minifiedHtml,
            extractedUrls: Array.from(urls)
        });

    } catch (error) {
        return Err(`Error (cleanHtmlString): ${error.message}`);
    }
}