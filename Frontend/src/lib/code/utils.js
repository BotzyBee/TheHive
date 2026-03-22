
import { marked } from 'marked';
import DOMPurify from 'dompurify';

    /**
     * Helper function to parse Markdown and then sanitize the HTML
     * @param {string} markdownText 
     * @returns {string} The sanitized HTML generated from the Markdown input
     */
    export function parseAndSanitizeMarkdown(markdownText) {
        const rawHtml = marked.parse(markdownText);
        const sanitizedHtml = DOMPurify.sanitize(rawHtml);
        return sanitizedHtml;
    }