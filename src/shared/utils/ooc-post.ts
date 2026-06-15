import { WebClient } from '@slack/web-api';
import { config } from '../../config/index.js';
import type { ISubmissionRepository } from '../../domain/interfaces/ISubmissionRepository.js';
import { fetchOriginalMessage } from './slack-message-fetcher.js';
import { fetchUserProfile, type SlackUserProfile } from './slack-user-profile.js';


let _helperClient: WebClient | undefined;

function getHelperClient(): WebClient | undefined {
  if (!config.slack.helperBotToken) return undefined;
  if (!_helperClient) _helperClient = new WebClient(config.slack.helperBotToken);
  return _helperClient;
}


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

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

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
      console.error('[ooc-post] post failed:', err);
    }
    if (taskQueue.length > 0) {
      await sleep(5000);
    }
  }

  isProcessing = false;
}


async function runPost(task: PostTask): Promise<void> {
  const { client, slackLink, submitterId, originalContent, repo, submissionId } = task;

  const submissionNumber =
    repo && submissionId ? await repo.assignNextNumber(submissionId) : undefined;

  const content = originalContent ?? (await resolveContent(client, slackLink));

  if (content) {
    await postWithContent(client, slackLink, submitterId, content, submissionNumber);
  } else {
    await postFallback(client, slackLink, submitterId, submissionNumber);
  }
}

async function resolveContent(
  client: WebClient,
  slackLink: string,
): Promise<OriginalContent | undefined> {
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

  await postHelperMessage(submissionNumber);

  if (content.imageUrl) {
    const fileId = await reuploadSlackImage(client, content.imageUrl);
    if (fileId) {
      await sendOocMessage(client, submitter, {
        blocks: buildImageBlocks(author, slackLink, content.text, fileId),
        attachments: [{ color: '#DDDDDD', footer: footerText, ts: msgTs }],
      });
      return;
    }
  }

  await sendOocMessage(client, submitter, {
    attachments: [{
      color: '#DDDDDD',
      author_name: author.displayName,
      author_icon: author.iconUrl,
      author_link: slackLink,
      text: content.text || undefined,
      image_url: content.imageUrl,
      footer: footerText,
      ts: msgTs,
      mrkdwn_in: ['text'],
    }],
  });
}

async function postFallback(
  client: WebClient,
  slackLink: string,
  submitterId: string,
  submissionNumber?: number,
): Promise<void> {
  await postHelperMessage(submissionNumber);
  const submitter = await fetchUserProfile(client, submitterId);
  await sendOocMessage(client, submitter, { text: slackLink, unfurl_links: true });
}


function parseSlackLink(link: string): { msgTs?: number; footerText: string } {
  const isFileLink = link.includes('/files/');
  const tsMatch = !isFileLink ? link.match(/\/p(\d{10})/) : null;
  const msgTs = tsMatch ? parseInt(tsMatch[1]) : undefined;
  const channelMatch = !isFileLink ? link.match(/\/archives\/([A-Z0-9]+)\//) : null;
  const channelId = channelMatch?.[1];
  const footerText = channelId?.startsWith('C')
    ? `Posted in <#${channelId}>`
    : 'Posted in a Direct Message';
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
): Promise<void> {
  await (client.chat.postMessage as any)({
    channel: config.slack.oocChannelId,
    username: submitter.displayName,
    icon_url: `${submitter.iconUrl}?_=${Date.now()}`,
    unfurl_links: false,
    ...payload,
  });
}

async function postHelperMessage(submissionNumber?: number): Promise<void> {
  const helperClient = getHelperClient();
  if (!helperClient) {
    console.warn('[helper-bot] SLACK_HELPER_BOT_TOKEN not set — skipping');
    return;
  }
  if (!config.slack.helperBotMessage) {
    console.warn('[helper-bot] SLACK_HELPER_BOT_MESSAGE not set — skipping');
    return;
  }
  const text = submissionNumber
    ? `*Submission #${submissionNumber}* - ${config.slack.helperBotMessage}`
    : config.slack.helperBotMessage;
  try {
    await helperClient.chat.postMessage({ channel: config.slack.oocChannelId, text });
  } catch (err) {
    console.error('[helper-bot] post failed:', err);
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
    console.error('Failed to re-upload image:', err);
    return undefined;
  }
}
