import DOMPurify from 'dompurify';

// Configure DOMPurify for chat messages
const config = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'code', 'pre'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|sms|geo|maps|skype|ssh|irc|ircs|news|nntp|sip|sips|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

export function sanitizeMessage(message: string): string {
  // Only sanitize on client side
  if (typeof window === 'undefined') {
    return message;
  }
  
  // Sanitize HTML to prevent XSS
  const clean = DOMPurify.sanitize(message, config);
  
  // Additional validation for maximum length (should already be checked, but double-check)
  if (clean.length > 5000) {
    return clean.substring(0, 5000);
  }
  
  return clean;
}

export function sanitizeInput(input: string): string {
  // Remove any HTML tags completely from input
  if (typeof window === 'undefined') {
    return input;
  }
  
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

export function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (char) => map[char]);
}