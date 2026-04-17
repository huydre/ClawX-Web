/**
 * Static catalog of apps that users can connect via Composio.
 *
 * `slug` must match the app/toolkit identifier expected by Composio
 * (e.g. "github", "gmail") so it can be forwarded to the proxy unchanged.
 *
 * This catalog is shared between frontend (for rendering cards) and backend
 * (for validating connect requests). Keep it small and representative —
 * the full Composio catalog is huge; we only list curated popular apps.
 */

export interface AppDefinition {
  slug: string;
  name: string;
  category: 'popular' | 'communication' | 'productivity' | 'crm' | 'dev';
  description: string;
  logoUrl: string;
  authType: 'OAUTH2' | 'API_KEY';
  scopes: string[];
  tools: Array<{ id: string; summary: string }>;
}

export const APPLICATIONS_CATALOG: AppDefinition[] = [
  {
    slug: 'discord',
    name: 'Discord',
    category: 'popular',
    description: 'An instant messaging and VoIP social platform.',
    logoUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/discord.svg',
    authType: 'OAUTH2',
    scopes: ['guilds.members.read', 'guilds', 'connections', 'identify', 'guilds.join', 'messages.read', 'email', 'openid'],
    tools: [
      { id: 'DISCORD_GET_CURRENT_USER_APPLICATION_ENTITLEMENTS', summary: 'Retrieve entitlements for the current user for a given application.' },
      { id: 'DISCORD_GET_GATEWAY', summary: 'Retrieve a valid WebSocket URL for establishing a Gateway connection.' },
      { id: 'DISCORD_INVITE_RESOLVE', summary: 'Resolve a Discord invite code.' },
    ],
  },
  {
    slug: 'github',
    name: 'GitHub',
    category: 'popular',
    description: 'Code hosting platform for version control and collaboration.',
    logoUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/github.svg',
    authType: 'OAUTH2',
    scopes: ['repo', 'read:user', 'user:email', 'read:org'],
    tools: [
      { id: 'GITHUB_CREATE_ISSUE', summary: 'Create an issue in a repository.' },
      { id: 'GITHUB_LIST_REPOS', summary: 'List repositories for the authenticated user.' },
      { id: 'GITHUB_GET_FILE_CONTENT', summary: 'Get the contents of a file in a repository.' },
    ],
  },
  {
    slug: 'gmail',
    name: 'Gmail',
    category: 'popular',
    description: 'Google email service with spam protection and G Suite integration.',
    logoUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/gmail.svg',
    authType: 'OAUTH2',
    scopes: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'],
    tools: [
      { id: 'GMAIL_SEND_EMAIL', summary: 'Send an email from the connected Gmail account.' },
      { id: 'GMAIL_LIST_THREADS', summary: 'List email threads in the mailbox.' },
      { id: 'GMAIL_GET_MESSAGE', summary: 'Fetch a full email message by id.' },
    ],
  },
  {
    slug: 'googlecalendar',
    name: 'Google Calendar',
    category: 'productivity',
    description: 'Time management tool for scheduling, reminders, and email integration.',
    logoUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/google-calendar.svg',
    authType: 'OAUTH2',
    scopes: ['https://www.googleapis.com/auth/calendar'],
    tools: [
      { id: 'GOOGLECALENDAR_CREATE_EVENT', summary: 'Create a new event on a calendar.' },
      { id: 'GOOGLECALENDAR_LIST_EVENTS', summary: 'List events on a calendar.' },
    ],
  },
  {
    slug: 'googledrive',
    name: 'Google Drive',
    category: 'productivity',
    description: 'Cloud storage for uploading, sharing, and collaborating on files.',
    logoUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/google-drive.svg',
    authType: 'OAUTH2',
    scopes: ['https://www.googleapis.com/auth/drive'],
    tools: [
      { id: 'GOOGLEDRIVE_LIST_FILES', summary: 'List files in Drive.' },
      { id: 'GOOGLEDRIVE_UPLOAD_FILE', summary: 'Upload a file to Drive.' },
    ],
  },
  {
    slug: 'googlesheets',
    name: 'Google Sheets',
    category: 'productivity',
    description: 'Cloud-based spreadsheet tool enabling real-time collaboration.',
    logoUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/google-sheets.svg',
    authType: 'OAUTH2',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    tools: [
      { id: 'GOOGLESHEETS_READ_RANGE', summary: 'Read a range of cells from a spreadsheet.' },
      { id: 'GOOGLESHEETS_APPEND_ROWS', summary: 'Append rows to a sheet.' },
    ],
  },
  {
    slug: 'slack',
    name: 'Slack',
    category: 'communication',
    description: 'Team messaging platform for channels, DMs, and integrations.',
    logoUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/slack.svg',
    authType: 'OAUTH2',
    scopes: ['channels:read', 'chat:write', 'users:read'],
    tools: [
      { id: 'SLACK_POST_MESSAGE', summary: 'Post a message to a channel.' },
      { id: 'SLACK_LIST_CHANNELS', summary: 'List public channels in the workspace.' },
    ],
  },
  {
    slug: 'notion',
    name: 'Notion',
    category: 'productivity',
    description: 'All-in-one workspace for notes, docs, wikis, and databases.',
    logoUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/notion.svg',
    authType: 'OAUTH2',
    scopes: ['read_content', 'update_content', 'insert_content'],
    tools: [
      { id: 'NOTION_CREATE_PAGE', summary: 'Create a page in a database or parent page.' },
      { id: 'NOTION_QUERY_DATABASE', summary: 'Query a Notion database.' },
    ],
  },
  {
    slug: 'jira',
    name: 'Jira',
    category: 'dev',
    description: 'Bug and issue tracking for software teams.',
    logoUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/jira.svg',
    authType: 'OAUTH2',
    scopes: ['read:jira-work', 'write:jira-work'],
    tools: [
      { id: 'JIRA_CREATE_ISSUE', summary: 'Create a Jira issue.' },
      { id: 'JIRA_SEARCH_ISSUES', summary: 'Search for issues using JQL.' },
    ],
  },
  {
    slug: 'linear',
    name: 'Linear',
    category: 'dev',
    description: 'Streamlined issue tracking for modern software teams.',
    logoUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/linear.svg',
    authType: 'OAUTH2',
    scopes: ['read', 'write'],
    tools: [
      { id: 'LINEAR_CREATE_ISSUE', summary: 'Create a Linear issue.' },
      { id: 'LINEAR_LIST_ISSUES', summary: 'List issues in a team.' },
    ],
  },
  {
    slug: 'hubspot',
    name: 'HubSpot',
    category: 'crm',
    description: 'Inbound marketing, sales, and service platform.',
    logoUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/hubspot.svg',
    authType: 'OAUTH2',
    scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write'],
    tools: [
      { id: 'HUBSPOT_CREATE_CONTACT', summary: 'Create a contact.' },
      { id: 'HUBSPOT_LIST_CONTACTS', summary: 'List contacts.' },
    ],
  },
  {
    slug: 'trello',
    name: 'Trello',
    category: 'productivity',
    description: 'Visual kanban boards for organizing tasks and projects.',
    logoUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/trello.svg',
    authType: 'OAUTH2',
    scopes: ['read', 'write'],
    tools: [
      { id: 'TRELLO_CREATE_CARD', summary: 'Create a card on a list.' },
      { id: 'TRELLO_LIST_BOARDS', summary: 'List boards for the user.' },
    ],
  },
  {
    slug: 'asana',
    name: 'Asana',
    category: 'productivity',
    description: 'Work management platform for teams.',
    logoUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/asana.svg',
    authType: 'OAUTH2',
    scopes: ['default'],
    tools: [
      { id: 'ASANA_CREATE_TASK', summary: 'Create a task.' },
      { id: 'ASANA_LIST_PROJECTS', summary: 'List projects in a workspace.' },
    ],
  },
  {
    slug: 'zoom',
    name: 'Zoom',
    category: 'communication',
    description: 'Video conferencing, online meetings, and webinars.',
    logoUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/zoom.svg',
    authType: 'OAUTH2',
    scopes: ['meeting:write', 'meeting:read', 'user:read'],
    tools: [
      { id: 'ZOOM_CREATE_MEETING', summary: 'Schedule a Zoom meeting.' },
      { id: 'ZOOM_LIST_MEETINGS', summary: 'List upcoming meetings.' },
    ],
  },
  {
    slug: 'calendly',
    name: 'Calendly',
    category: 'productivity',
    description: 'Automated scheduling for meetings and appointments.',
    logoUrl: 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/calendly.svg',
    authType: 'OAUTH2',
    scopes: ['default'],
    tools: [
      { id: 'CALENDLY_LIST_EVENTS', summary: 'List scheduled events.' },
      { id: 'CALENDLY_GET_USER', summary: 'Get current user profile.' },
    ],
  },
];

export const POPULAR_SLUGS = ['discord', 'github', 'gmail', 'googlecalendar', 'googledrive', 'googlesheets'];

export function getAppBySlug(slug: string): AppDefinition | undefined {
  return APPLICATIONS_CATALOG.find((a) => a.slug === slug);
}
