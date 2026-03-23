
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { TextMessage, ImageMessage, AudioMessage, DataMessage } from './classes.js';

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

export function processApiMessagesToClasses(messageArray) {
    if (!Array.isArray(messageArray)) {
    return [];
    }
    const outputArray = messageArray.map((msg) => {
    switch (msg.type) {
        case 'text':
        return new TextMessage(msg);
        case 'image':
        return new ImageMessage(msg);
        case 'audio':
        return new AudioMessage(msg);
        case 'data':
        return new DataMessage(msg);
        default:
        return [];
    }
    });
    return outputArray;
}

export function generateShortID(prefix) {
  if (!prefix) prefix = 'Action';
  return `${prefix}_****`.replace(/[*y]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == '*' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function parseStatus(status){
  if(status.taskStatus === "Custom Status"){
    return status.customText;
  } else {
    return status.taskStatus;
  }
}