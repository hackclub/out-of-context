/**
 * Extracts a Slack message link from a string of text.
 * @param text The text to search for a link.
 * @returns The first Slack message link found, or null if none.
 */
export const extractSlackLink = (text: string): string | null => {
  const slackLinkRegex = /https:\/\/[a-zA-Z0-9-]+\.slack\.com\/archives\/[A-Z0-9]+\/p[0-9]+/;
  const match = text.match(slackLinkRegex);
  return match ? match[0] : null;
};
