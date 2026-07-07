// Datenbankschicht auf Basis von SQLite (better-sqlite3).
// Echte relationale Tabellen – keine JSON-Datei als Datenbank.
import Database from 'better-sqlite3';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, 'bot.sqlite'));
db.pragma('journal_mode = WAL');

// ── Schema ───────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS guilds (
    guild_id TEXT PRIMARY KEY,
    tickets_enabled INTEGER DEFAULT 0,
    tickets_category_id TEXT DEFAULT '',
    tickets_staff_role_id TEXT DEFAULT '',
    tickets_log_channel_id TEXT DEFAULT '',
    tickets_panel_message TEXT DEFAULT 'Brauchst du Hilfe? Klick auf den Button, um ein Ticket zu oeffnen!',
    tickets_welcome_message TEXT DEFAULT 'Danke fuer dein Ticket! Ein Teammitglied meldet sich gleich.',
    antiraid_enabled INTEGER DEFAULT 0,
    antiraid_join_threshold INTEGER DEFAULT 8,
    antiraid_join_window_seconds INTEGER DEFAULT 10,
    antiraid_action TEXT DEFAULT 'kick',
    antiraid_min_account_age_minutes INTEGER DEFAULT 0,
    antiraid_alert_channel_id TEXT DEFAULT '',
    automod_enabled INTEGER DEFAULT 0,
    automod_anti_invite INTEGER DEFAULT 1,
    automod_anti_spam INTEGER DEFAULT 1,
    automod_spam_message_count INTEGER DEFAULT 5,
    automod_spam_window_seconds INTEGER DEFAULT 5,
    automod_anti_mass_mention INTEGER DEFAULT 1,
    automod_max_mentions INTEGER DEFAULT 5,
    welcome_enabled INTEGER DEFAULT 0,
    welcome_channel_id TEXT DEFAULT '',
    welcome_message TEXT DEFAULT 'Willkommen {user} auf **{server}**! Du bist Mitglied Nr. {count}.',
    welcome_leave_enabled INTEGER DEFAULT 0,
    welcome_leave_message TEXT DEFAULT '{user} hat den Server verlassen.',
    logging_enabled INTEGER DEFAULT 0,
    logging_channel_id TEXT DEFAULT '',
    logging_message_delete INTEGER DEFAULT 1,
    logging_message_edit INTEGER DEFAULT 1,
    logging_member_join INTEGER DEFAULT 1,
    logging_member_leave INTEGER DEFAULT 1,
    logging_mod_actions INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS automod_banned_words (
    guild_id TEXT NOT NULL,
    word TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS automod_ignored_roles (
    guild_id TEXT NOT NULL,
    role_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ticket_staff_roles (
    guild_id TEXT NOT NULL,
    role_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tickets (
    channel_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    opener_id TEXT NOT NULL,
    number INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open'
  );

  CREATE TABLE IF NOT EXISTS ticket_counter (
    guild_id TEXT PRIMARY KEY,
    counter INTEGER NOT NULL DEFAULT 0
  );
`);

// Spalten des guilds-Datensatzes → verschachteltes Konfig-Objekt.
function rowToConfig(guildId, row, bannedWords, ignoredRoles, staffRoles) {
  return {
    guildId,
    tickets: {
      enabled: !!row.tickets_enabled,
      categoryId: row.tickets_category_id,
      staffRoleIds: staffRoles,
      logChannelId: row.tickets_log_channel_id,
      panelMessage: row.tickets_panel_message,
      welcomeMessage: row.tickets_welcome_message
    },
    antiraid: {
      enabled: !!row.antiraid_enabled,
      joinThreshold: row.antiraid_join_threshold,
      joinWindowSeconds: row.antiraid_join_window_seconds,
      action: row.antiraid_action,
      minAccountAgeMinutes: row.antiraid_min_account_age_minutes,
      alertChannelId: row.antiraid_alert_channel_id
    },
    automod: {
      enabled: !!row.automod_enabled,
      antiInvite: !!row.automod_anti_invite,
      antiSpam: !!row.automod_anti_spam,
      spamMessageCount: row.automod_spam_message_count,
      spamWindowSeconds: row.automod_spam_window_seconds,
      antiMassMention: !!row.automod_anti_mass_mention,
      maxMentions: row.automod_max_mentions,
      bannedWords,
      ignoredRoleIds: ignoredRoles
    },
    welcome: {
      enabled: !!row.welcome_enabled,
      channelId: row.welcome_channel_id,
      message: row.welcome_message,
      leaveEnabled: !!row.welcome_leave_enabled,
      leaveMessage: row.welcome_leave_message
    },
    logging: {
      enabled: !!row.logging_enabled,
      channelId: row.logging_channel_id,
      messageDelete: !!row.logging_message_delete,
      messageEdit: !!row.logging_message_edit,
      memberJoin: !!row.logging_member_join,
      memberLeave: !!row.logging_member_leave,
      modActions: !!row.logging_mod_actions
    }
  };
}

const b = (v) => (v ? 1 : 0);

// ── Guild-Konfiguration ──────────────────────────────────
const ensureGuild = db.prepare('INSERT OR IGNORE INTO guilds (guild_id) VALUES (?)');
const selectGuild = db.prepare('SELECT * FROM guilds WHERE guild_id = ?');
const selectWords = db.prepare('SELECT word FROM automod_banned_words WHERE guild_id = ?');
const selectRoles = db.prepare('SELECT role_id FROM automod_ignored_roles WHERE guild_id = ?');
const selectStaffRoles = db.prepare('SELECT role_id FROM ticket_staff_roles WHERE guild_id = ?');

export function getGuildConfig(guildId) {
  ensureGuild.run(guildId);
  const row = selectGuild.get(guildId);
  const words = selectWords.all(guildId).map((r) => r.word);
  const roles = selectRoles.all(guildId).map((r) => r.role_id);
  let staffRoles = selectStaffRoles.all(guildId).map((r) => r.role_id);
  // Migration: alte Einzelrolle (Spalte) übernehmen, falls die Liste noch leer ist.
  if (staffRoles.length === 0 && row.tickets_staff_role_id) {
    staffRoles = [row.tickets_staff_role_id];
  }
  return rowToConfig(guildId, row, words, roles, staffRoles);
}

const updateGuild = db.prepare(`
  UPDATE guilds SET
    tickets_enabled=@tickets_enabled, tickets_category_id=@tickets_category_id,
    tickets_staff_role_id=@tickets_staff_role_id, tickets_log_channel_id=@tickets_log_channel_id,
    tickets_panel_message=@tickets_panel_message, tickets_welcome_message=@tickets_welcome_message,
    antiraid_enabled=@antiraid_enabled, antiraid_join_threshold=@antiraid_join_threshold,
    antiraid_join_window_seconds=@antiraid_join_window_seconds, antiraid_action=@antiraid_action,
    antiraid_min_account_age_minutes=@antiraid_min_account_age_minutes,
    antiraid_alert_channel_id=@antiraid_alert_channel_id,
    automod_enabled=@automod_enabled, automod_anti_invite=@automod_anti_invite,
    automod_anti_spam=@automod_anti_spam, automod_spam_message_count=@automod_spam_message_count,
    automod_spam_window_seconds=@automod_spam_window_seconds,
    automod_anti_mass_mention=@automod_anti_mass_mention, automod_max_mentions=@automod_max_mentions,
    welcome_enabled=@welcome_enabled, welcome_channel_id=@welcome_channel_id,
    welcome_message=@welcome_message, welcome_leave_enabled=@welcome_leave_enabled,
    welcome_leave_message=@welcome_leave_message,
    logging_enabled=@logging_enabled, logging_channel_id=@logging_channel_id,
    logging_message_delete=@logging_message_delete, logging_message_edit=@logging_message_edit,
    logging_member_join=@logging_member_join, logging_member_leave=@logging_member_leave,
    logging_mod_actions=@logging_mod_actions
  WHERE guild_id=@guild_id
`);

const deleteWords = db.prepare('DELETE FROM automod_banned_words WHERE guild_id = ?');
const insertWord = db.prepare('INSERT INTO automod_banned_words (guild_id, word) VALUES (?, ?)');
const deleteRoles = db.prepare('DELETE FROM automod_ignored_roles WHERE guild_id = ?');
const insertRole = db.prepare('INSERT INTO automod_ignored_roles (guild_id, role_id) VALUES (?, ?)');
const deleteStaffRoles = db.prepare('DELETE FROM ticket_staff_roles WHERE guild_id = ?');
const insertStaffRole = db.prepare('INSERT INTO ticket_staff_roles (guild_id, role_id) VALUES (?, ?)');

export const saveGuildConfig = db.transaction((cfg) => {
  ensureGuild.run(cfg.guildId);
  updateGuild.run({
    guild_id: cfg.guildId,
    tickets_enabled: b(cfg.tickets.enabled),
    tickets_category_id: cfg.tickets.categoryId || '',
    tickets_staff_role_id: (cfg.tickets.staffRoleIds && cfg.tickets.staffRoleIds[0]) || '',
    tickets_log_channel_id: cfg.tickets.logChannelId || '',
    tickets_panel_message: cfg.tickets.panelMessage || '',
    tickets_welcome_message: cfg.tickets.welcomeMessage || '',
    antiraid_enabled: b(cfg.antiraid.enabled),
    antiraid_join_threshold: cfg.antiraid.joinThreshold,
    antiraid_join_window_seconds: cfg.antiraid.joinWindowSeconds,
    antiraid_action: cfg.antiraid.action || 'kick',
    antiraid_min_account_age_minutes: cfg.antiraid.minAccountAgeMinutes,
    antiraid_alert_channel_id: cfg.antiraid.alertChannelId || '',
    automod_enabled: b(cfg.automod.enabled),
    automod_anti_invite: b(cfg.automod.antiInvite),
    automod_anti_spam: b(cfg.automod.antiSpam),
    automod_spam_message_count: cfg.automod.spamMessageCount,
    automod_spam_window_seconds: cfg.automod.spamWindowSeconds,
    automod_anti_mass_mention: b(cfg.automod.antiMassMention),
    automod_max_mentions: cfg.automod.maxMentions,
    welcome_enabled: b(cfg.welcome.enabled),
    welcome_channel_id: cfg.welcome.channelId || '',
    welcome_message: cfg.welcome.message || '',
    welcome_leave_enabled: b(cfg.welcome.leaveEnabled),
    welcome_leave_message: cfg.welcome.leaveMessage || '',
    logging_enabled: b(cfg.logging.enabled),
    logging_channel_id: cfg.logging.channelId || '',
    logging_message_delete: b(cfg.logging.messageDelete),
    logging_message_edit: b(cfg.logging.messageEdit),
    logging_member_join: b(cfg.logging.memberJoin),
    logging_member_leave: b(cfg.logging.memberLeave),
    logging_mod_actions: b(cfg.logging.modActions)
  });

  deleteWords.run(cfg.guildId);
  for (const w of cfg.automod.bannedWords || []) {
    const word = String(w).trim();
    if (word) insertWord.run(cfg.guildId, word);
  }
  deleteRoles.run(cfg.guildId);
  for (const r of cfg.automod.ignoredRoleIds || []) {
    const role = String(r).trim();
    if (role) insertRole.run(cfg.guildId, role);
  }
  deleteStaffRoles.run(cfg.guildId);
  for (const r of cfg.tickets.staffRoleIds || []) {
    const role = String(r).trim();
    if (role) insertStaffRole.run(cfg.guildId, role);
  }
});

// ── Verwarnungen ─────────────────────────────────────────
const insertWarning = db.prepare(
  'INSERT INTO warnings (guild_id, user_id, moderator_id, reason, created_at) VALUES (?,?,?,?,?)'
);
const countWarnings = db.prepare('SELECT COUNT(*) AS n FROM warnings WHERE guild_id=? AND user_id=?');
const selectWarnings = db.prepare(
  'SELECT id, moderator_id, reason, created_at FROM warnings WHERE guild_id=? AND user_id=? ORDER BY id'
);
const deleteWarnings = db.prepare('DELETE FROM warnings WHERE guild_id=? AND user_id=?');

export function addWarning(guildId, userId, moderatorId, reason) {
  insertWarning.run(guildId, userId, moderatorId, reason, new Date().toISOString());
  return countWarnings.get(guildId, userId).n;
}

export function getWarnings(guildId, userId) {
  return selectWarnings.all(guildId, userId);
}

export function clearWarnings(guildId, userId) {
  deleteWarnings.run(guildId, userId);
}

// ── Tickets ──────────────────────────────────────────────
const bumpCounter = db.prepare(`
  INSERT INTO ticket_counter (guild_id, counter) VALUES (?, 1)
  ON CONFLICT(guild_id) DO UPDATE SET counter = counter + 1
`);
const readCounter = db.prepare('SELECT counter FROM ticket_counter WHERE guild_id = ?');
const insertTicket = db.prepare(
  "INSERT OR REPLACE INTO tickets (channel_id, guild_id, opener_id, number, created_at, status) VALUES (?,?,?,?,?, 'open')"
);
const ticketByChannel = db.prepare("SELECT 1 FROM tickets WHERE channel_id=? AND status='open'");
const openByUser = db.prepare("SELECT 1 FROM tickets WHERE guild_id=? AND opener_id=? AND status='open'");
const closeTicketStmt = db.prepare("UPDATE tickets SET status='closed' WHERE channel_id=?");

export function nextTicketNumber(guildId) {
  bumpCounter.run(guildId);
  return readCounter.get(guildId).counter;
}

export function createTicket(channelId, guildId, openerId, number) {
  insertTicket.run(channelId, guildId, openerId, number, new Date().toISOString());
}

export function isTicketChannel(channelId) {
  return !!ticketByChannel.get(channelId);
}

export function hasOpenTicket(guildId, openerId) {
  return !!openByUser.get(guildId, openerId);
}

export function closeTicket(channelId) {
  closeTicketStmt.run(channelId);
}

export default db;
