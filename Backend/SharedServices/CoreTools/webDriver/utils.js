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
        const { document } = dom.window;

        // 1. Heavy Pruning
        const junkTags = ['style', 'script', 'svg', 'iframe', 'noscript', 'canvas', 'video', 'audio', 'head'];
        const junkAttrs = ['[aria-hidden="true"]', '[hidden]', '[style*="display: none"]'];
        document.querySelectorAll([...junkTags, ...junkAttrs].join(', ')).forEach(el => el.remove());

        // 2. Interactive Attribute Whitelist
        const keeperAttrs = [
            'id', 'name', 'type', 'placeholder', 'aria-label', 
            'role', 'href', 'value', 'data-testid', 'data-nav-id'
        ];

        // 3. Process Elements
        const allElements = document.querySelectorAll('body *');
        allElements.forEach((el, index) => {
            const tagName = el.tagName.toLowerCase();
            const isInteractive = ['button', 'a', 'input', 'textarea', 'select', 'option'].includes(tagName);
            
            // Assign a unique "Action ID" to every interactive element
            // This is the ONLY selector the AI should ideally use.
            if (isInteractive) {
                el.setAttribute('data-nav-id', `ix-${index}`);
            }

            // Strip non-essential attributes
            for (let i = el.attributes.length - 1; i >= 0; i--) {
                const attrName = el.attributes[i].name;
                if (!keeperAttrs.includes(attrName)) {
                    el.removeAttribute(attrName);
                }
            }

            // Remove empty non-interactive containers (reduces noise)
            if (!isInteractive && !el.textContent.trim() && !el.children.length) {
                el.remove();
            }
        });

        // 4. Final Polish
        let cleaned = document.body.innerHTML
            .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
            .replace(/\s+/g, ' ')            // Minify whitespace
            .trim();

        return Ok(cleaned);

    } catch (error) {
        return Err(`Error (cleanHtmlString) : ${error.message}`);
    }
}