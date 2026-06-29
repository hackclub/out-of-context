import { WebClient } from '@slack/web-api';
import { config } from '../../config/index.js';
import type { ISubmissionRepository } from '../../domain/interfaces/ISubmissionRepository.js';
import { fetchOriginalMessage } from './slack-message-fetcher.js';
import { fetchUserProfile, type SlackUserProfile } from './slack-user-profile.js';
import { logger } from './logger.js';

interface OriginalContent {
  text: string;
  authorId: string;
  imageUrl?: string;
}

interface PostTask {
  client: WebClient;
  slackLink: string;
  submitterId: string;
  originalContent?: OriginalContent;
  repo?: ISubmissionRepository;
  submissionId?: string;
}

const taskQueue: PostTask[] = [];
let isProcessing = false;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function postToOocChannel(
  client: WebClient,
  slackLink: string,
  submitterId: string,
  originalContent?: OriginalContent,
  repo?: ISubmissionRepository,
  submissionId?: string,
): void {
  taskQueue.push({ client, slackLink, submitterId, originalContent, repo, submissionId });
  drainQueue();
}

async function drainQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  while (taskQueue.length > 0) {
    const task = taskQueue.shift()!;
    try {
      await runPost(task);
    } catch (err) {
      logger.error('[ooc-post] post failed:', err);
    }
    if (taskQueue.length > 0) {
      await sleep(5000);
    }
  }

  isProcessing = false;
}

async function runPost(task: PostTask): Promise<void> {
  const { client, slackLink, submitterId, originalContent, repo, submissionId } = task;

  const submissionNumber = repo && submissionId ? await repo.assignNextNumber(submissionId) : undefined;

  const content = originalContent ?? (await resolveContent(client, slackLink));

  if (content) {
    await postWithContent(client, slackLink, submitterId, content, submissionNumber);
  } else {
    await postFallback(client, slackLink, submitterId, submissionNumber);
  }
}

async function resolveContent(client: WebClient, slackLink: string): Promise<OriginalContent | undefined> {
  const fetched = await fetchOriginalMessage(client, slackLink);
  if (fetched?.authorId && (fetched.text || fetched.imageUrl)) {
    return { text: fetched.text, authorId: fetched.authorId, imageUrl: fetched.imageUrl };
  }
  return undefined;
}

async function postWithContent(
  client: WebClient,
  slackLink: string,
  submitterId: string,
  content: OriginalContent,
  submissionNumber?: number,
): Promise<void> {
  const [submitter, author] = await Promise.all([
    fetchUserProfile(client, submitterId),
    fetchUserProfile(client, content.authorId),
  ]);

  const { msgTs, footerText } = parseSlackLink(slackLink);

  let postedTs: string | undefined;

  if (content.imageUrl) {
    const fileId = await reuploadSlackImage(client, content.imageUrl);
    if (fileId) {
      postedTs = await sendOocMessage(client, submitter, {
        text: content.text || slackLink,
        blocks: buildImageBlocks(author, slackLink, content.text, fileId),
        attachments: [{ color: '#DDDDDD', fallback: content.text || slackLink, footer: footerText, ts: msgTs }],
      });
      await postSubmissionNumber(client, postedTs, submissionNumber);
      return;
    }
  }

  postedTs = await sendOocMessage(client, submitter, {
    attachments: [
      {
        color: '#DDDDDD',
        fallback: content.text || slackLink,
        author_name: author.displayName,
        author_icon: author.iconUrl,
        author_link: slackLink,
        text: content.text || undefined,
        image_url: content.imageUrl,
        footer: footerText,
        ts: msgTs,
        mrkdwn_in: ['text'],
      },
    ],
  });
  await postSubmissionNumber(client, postedTs, submissionNumber);
}

async function postFallback(
  client: WebClient,
  slackLink: string,
  submitterId: string,
  submissionNumber?: number,
): Promise<void> {
  const submitter = await fetchUserProfile(client, submitterId);
  const postedTs = await sendOocMessage(client, submitter, { text: slackLink, unfurl_links: true });
  await postSubmissionNumber(client, postedTs, submissionNumber);
}

function parseSlackLink(link: string): { msgTs?: number; footerText: string } {
  const isFileLink = link.includes('/files/');
  const tsMatch = !isFileLink ? link.match(/\/p(\d{10})/) : null;
  const msgTs = tsMatch ? Number.parseInt(tsMatch[1]) : undefined;
  const channelMatch = !isFileLink ? link.match(/\/archives\/([A-Z0-9]+)\//) : null;
  const channelId = channelMatch?.[1];
  const footerText = channelId?.startsWith('C') ? `Posted in <#${channelId}>` : 'Posted in a Direct Message';
  return { msgTs, footerText };
}

function buildImageBlocks(
  author: SlackUserProfile,
  slackLink: string,
  text: string | undefined,
  fileId: string,
): any[] {
  const authorElements: any[] = [];
  if (author.iconUrl) {
    authorElements.push({ type: 'image', image_url: author.iconUrl, alt_text: author.displayName });
  }
  authorElements.push({ type: 'mrkdwn', text: `*<${slackLink}|${author.displayName}>*` });

  const blocks: any[] = [{ type: 'context', elements: authorElements }];
  if (text) blocks.push({ type: 'section', text: { type: 'mrkdwn', text } });
  blocks.push({ type: 'image', slack_file: { id: fileId }, alt_text: 'image' });
  return blocks;
}

async function sendOocMessage(
  client: WebClient,
  submitter: SlackUserProfile,
  payload: { blocks?: any[]; attachments?: any[]; text?: string; unfurl_links?: boolean },
): Promise<string | undefined> {
  const result = await (client.chat.postMessage as any)({
    channel: config.slack.oocChannelId,
    username: submitter.displayName,
    icon_url: submitter.iconUrl,
    unfurl_links: false,
    ...payload,
  });
  return result?.ts as string | undefined;
}

async function postSubmissionNumber(
  client: WebClient,
  threadTs: string | undefined,
  submissionNumber?: number,
): Promise<void> {
  if (!submissionNumber || !threadTs) return;
  try {
    await client.chat.postMessage({
      channel: config.slack.oocChannelId,
      thread_ts: threadTs,
      text: `#${submissionNumber}`,
    });
  } catch (err) {
    logger.error('[ooc-post] failed to post submission number:', err);
  }
}

async function reuploadSlackImage(client: WebClient, url: string): Promise<string | undefined> {
  try {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) return undefined;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return undefined;

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.split('/')[1]?.split(';')[0]?.replace('+xml', '') || 'jpg';
    const buffer = Buffer.from(await res.arrayBuffer());

    const result = await client.filesUploadV2({ file: buffer, filename: `image.${ext}` });
    return result.files[0]?.files?.[0]?.id;
  } catch (err) {
    logger.error('Failed to re-upload image:', err);
    return undefined;
  }
}
