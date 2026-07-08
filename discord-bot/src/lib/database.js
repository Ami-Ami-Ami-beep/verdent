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

  CREATE TABLE IF NOT EXISTS self_roles (
    guild_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    label TEXT DEFAULT '',
    emoji TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS user_levels (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS application_questions (
    guild_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    question TEXT NOT NULL
  );
`);

// Neue Konfig-Spalten nachrüsten (für bereits bestehende Datenbanken).
// Fügt fehlende Spalten der guilds-Tabelle hinzu.
function ensureColumns() {
  const existing = new Set(db.prepare('PRAGMA table_info(guilds)').all().map((c) => c.name));
  const columns = {
    applications_enabled: 'INTEGER DEFAULT 0',
    applications_review_channel_id: "TEXT DEFAULT ''",
    applications_accepted_role_id: "TEXT DEFAULT ''",
    applications_panel_message: "TEXT DEFAULT 'Bewirb dich für unser Team! Klick auf den Button.'",
    autorole_enabled: 'INTEGER DEFAULT 0',
    autorole_role_id: "TEXT DEFAULT ''",
    levels_enabled: 'INTEGER DEFAULT 0',
    levels_xp_per_message: 'INTEGER DEFAULT 15',
    levels_cooldown_seconds: 'INTEGER DEFAULT 60',
    levels_announce: 'INTEGER DEFAULT 1',
    levels_announce_channel_id: "TEXT DEFAULT ''",
    suggestions_enabled: 'INTEGER DEFAULT 0',
    suggestions_channel_id: "TEXT DEFAULT ''"
  };
  for (const [name, def] of Object.entries(columns)) {
    if (!existing.has(name)) db.exec(`ALTER TABLE guilds ADD COLUMN ${name} ${def}`);
  }
}
ensureColumns();

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
    },
    applications: {
      enabled: !!row.applications_enabled,
      reviewChannelId: row.applications_review_channel_id || '',
      acceptedRoleId: row.applications_accepted_role_id || '',
      panelMessage: row.applications_panel_message || '',
      questions: [] // wird separat geladen
    },
    autorole: {
      enabled: !!row.autorole_enabled,
      roleId: row.autorole_role_id || ''
    },
    levels: {
      enabled: !!row.levels_enabled,
      xpPerMessage: row.levels_xp_per_message ?? 15,
      cooldownSeconds: row.levels_cooldown_seconds ?? 60,
      announce: row.levels_announce == null ? true : !!row.levels_announce,
      announceChannelId: row.levels_announce_channel_id || ''
    },
    suggestions: {
      enabled: !!row.suggestions_enabled,
      channelId: row.suggestions_channel_id || ''
    },
    selfRoles: [] // wird separat geladen
  };
}

const b = (v) => (v ? 1 : 0);

// ── Guild-Konfiguration ──────────────────────────────────
const ensureGuild = db.prepare('INSERT OR IGNORE INTO guilds (guild_id) VALUES (?)');
const selectGuild = db.prepare('SELECT * FROM guilds WHERE guild_id = ?');
const selectWords = db.prepare('SELECT word FROM automod_banned_words WHERE guild_id = ?');
const selectRoles = db.prepare('SELECT role_id FROM automod_ignored_roles WHERE guild_id = ?');
const selectStaffRoles = db.prepare('SELECT role_id FROM ticket_staff_roles WHERE guild_id = ?');
const selectQuestions = db.prepare('SELECT question FROM application_questions WHERE guild_id = ? ORDER BY position');
const selectSelfRoles = db.prepare('SELECT role_id, label, emoji FROM self_roles WHERE guild_id = ?');

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
  const cfg = rowToConfig(guildId, row, words, roles, staffRoles);
  cfg.applications.questions = selectQuestions.all(guildId).map((r) => r.question);
  cfg.selfRoles = selectSelfRoles.all(guildId).map((r) => ({ roleId: r.role_id, label: r.label, emoji: r.emoji }));
  return cfg;
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
    logging_mod_actions=@logging_mod_actions,
    applications_enabled=@applications_enabled,
    applications_review_channel_id=@applications_review_channel_id,
    applications_accepted_role_id=@applications_accepted_role_id,
    applications_panel_message=@applications_panel_message,
    autorole_enabled=@autorole_enabled, autorole_role_id=@autorole_role_id,
    levels_enabled=@levels_enabled, levels_xp_per_message=@levels_xp_per_message,
    levels_cooldown_seconds=@levels_cooldown_seconds, levels_announce=@levels_announce,
    levels_announce_channel_id=@levels_announce_channel_id,
    suggestions_enabled=@suggestions_enabled, suggestions_channel_id=@suggestions_channel_id
  WHERE guild_id=@guild_id
`);

const deleteWords = db.prepare('DELETE FROM automod_banned_words WHERE guild_id = ?');
const insertWord = db.prepare('INSERT INTO automod_banned_words (guild_id, word) VALUES (?, ?)');
const deleteRoles = db.prepare('DELETE FROM automod_ignored_roles WHERE guild_id = ?');
const insertRole = db.prepare('INSERT INTO automod_ignored_roles (guild_id, role_id) VALUES (?, ?)');
const deleteStaffRoles = db.prepare('DELETE FROM ticket_staff_roles WHERE guild_id = ?');
const insertStaffRole = db.prepare('INSERT INTO ticket_staff_roles (guild_id, role_id) VALUES (?, ?)');
const deleteQuestions = db.prepare('DELETE FROM application_questions WHERE guild_id = ?');
const insertQuestion = db.prepare('INSERT INTO application_questions (guild_id, position, question) VALUES (?, ?, ?)');
const deleteSelfRoles = db.prepare('DELETE FROM self_roles WHERE guild_id = ?');
const insertSelfRole = db.prepare('INSERT INTO self_roles (guild_id, role_id, label, emoji) VALUES (?, ?, ?, ?)');

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
    logging_mod_actions: b(cfg.logging.modActions),
    applications_enabled: b(cfg.applications?.enabled),
    applications_review_channel_id: cfg.applications?.reviewChannelId || '',
    applications_accepted_role_id: cfg.applications?.acceptedRoleId || '',
    applications_panel_message: cfg.applications?.panelMessage || '',
    autorole_enabled: b(cfg.autorole?.enabled),
    autorole_role_id: cfg.autorole?.roleId || '',
    levels_enabled: b(cfg.levels?.enabled),
    levels_xp_per_message: cfg.levels?.xpPerMessage ?? 15,
    levels_cooldown_seconds: cfg.levels?.cooldownSeconds ?? 60,
    levels_announce: b(cfg.levels?.announce),
    levels_announce_channel_id: cfg.levels?.announceChannelId || '',
    suggestions_enabled: b(cfg.suggestions?.enabled),
    suggestions_channel_id: cfg.suggestions?.channelId || ''
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
  deleteQuestions.run(cfg.guildId);
  (cfg.applications?.questions || []).forEach((q, i) => {
    const question = String(q).trim();
    if (question) insertQuestion.run(cfg.guildId, i, question.slice(0, 300));
  });
  deleteSelfRoles.run(cfg.guildId);
  for (const sr of cfg.selfRoles || []) {
    const role = String(sr.roleId || '').trim();
    if (role) insertSelfRole.run(cfg.guildId, role, String(sr.label || '').slice(0, 80), String(sr.emoji || '').slice(0, 40));
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

// ── Level-System (XP) ────────────────────────────────────
const upsertXp = db.prepare(`
  INSERT INTO user_levels (guild_id, user_id, xp) VALUES (?, ?, ?)
  ON CONFLICT(guild_id, user_id) DO UPDATE SET xp = xp + excluded.xp
`);
const selectXp = db.prepare('SELECT xp FROM user_levels WHERE guild_id=? AND user_id=?');
const countAbove = db.prepare('SELECT COUNT(*) AS n FROM user_levels WHERE guild_id=? AND xp > ?');
const topXp = db.prepare('SELECT user_id, xp FROM user_levels WHERE guild_id=? ORDER BY xp DESC LIMIT ?');

// XP → Level und umgekehrt (einfache, gleichmäßige Kurve).
export function levelFromXp(xp) {
  return Math.floor(Math.sqrt((xp || 0) / 100));
}
export function xpForLevel(level) {
  return level * level * 100;
}

/** Vergibt XP und meldet, ob ein Level-Aufstieg passiert ist. */
export function addXp(guildId, userId, amount) {
  const before = selectXp.get(guildId, userId)?.xp ?? 0;
  upsertXp.run(guildId, userId, amount);
  const after = before + amount;
  const oldLevel = levelFromXp(before);
  const newLevel = levelFromXp(after);
  return { xp: after, level: newLevel, leveledUp: newLevel > oldLevel };
}

export function getUserLevel(guildId, userId) {
  const xp = selectXp.get(guildId, userId)?.xp ?? 0;
  const level = levelFromXp(xp);
  const rank = countAbove.get(guildId, xp).n + 1;
  return { xp, level, rank };
}

export function getLeaderboard(guildId, limit = 10) {
  return topXp.all(guildId, limit).map((r) => ({ userId: r.user_id, xp: r.xp, level: levelFromXp(r.xp) }));
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
