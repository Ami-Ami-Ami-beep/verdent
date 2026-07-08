// Konfigurations-Website (Dashboard).
// Bietet Login + REST-API zum Lesen/Schreiben der Server-Konfiguration.
import express from 'express';
import session from 'express-session';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChannelType } from 'discord.js';
import { getGuildConfig, saveGuildConfig } from '../lib/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function startWeb(client) {
  const port = process.env.WEB_PORT || 3000;
  const password = process.env.DASHBOARD_PASSWORD || 'admin';
  const secret = process.env.SESSION_SECRET || 'change-me';

  const app = express();
  app.use(express.json({ limit: '256kb' }));
  app.use(
    session({
      secret,
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 Stunden
    })
  );

  // Middleware: schützt die /api/-Routen (außer Login/Session).
  const requireAuth = (req, res, next) => {
    if (req.session?.authed) return next();
    res.status(401).json({ error: 'Nicht angemeldet' });
  };

  // ── Auth ───────────────────────────────────────────────
  app.post('/api/login', (req, res) => {
    if (req.body?.password === password) {
      req.session.authed = true;
      return res.json({ ok: true });
    }
    res.status(401).json({ error: 'Falsches Passwort' });
  });

  app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get('/api/session', (req, res) => {
    res.json({ authed: !!req.session?.authed });
  });

  // ── Server-Liste ───────────────────────────────────────
  app.get('/api/guilds', requireAuth, (req, res) => {
    const guilds = client.guilds.cache.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.iconURL({ size: 64 }) || null,
      memberCount: g.memberCount
    }));
    res.json(guilds);
  });

  // Kanäle, Kategorien und Rollen eines Servers (für die Auswahlfelder).
  app.get('/api/guilds/:id/meta', requireAuth, (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Server nicht gefunden' });

    const textChannels = guild.channels.cache
      .filter((c) => c.type === ChannelType.GuildText)
      .map((c) => ({ id: c.id, name: c.name }));
    const categories = guild.channels.cache
      .filter((c) => c.type === ChannelType.GuildCategory)
      .map((c) => ({ id: c.id, name: c.name }));
    const roles = guild.roles.cache
      .filter((r) => r.id !== guild.id) // @everyone weglassen
      .map((r) => ({ id: r.id, name: r.name }));

    res.json({ name: guild.name, textChannels, categories, roles });
  });

  // ── Konfiguration lesen/schreiben ──────────────────────
  app.get('/api/guilds/:id/config', requireAuth, (req, res) => {
    if (!client.guilds.cache.has(req.params.id)) {
      return res.status(404).json({ error: 'Server nicht gefunden' });
    }
    res.json(getGuildConfig(req.params.id));
  });

  app.post('/api/guilds/:id/config', requireAuth, (req, res) => {
    if (!client.guilds.cache.has(req.params.id)) {
      return res.status(404).json({ error: 'Server nicht gefunden' });
    }
    try {
      const cfg = sanitizeConfig(req.params.id, req.body);
      saveGuildConfig(cfg);
      res.json({ ok: true, config: getGuildConfig(req.params.id) });
    } catch (err) {
      console.error('Konfiguration speichern fehlgeschlagen:', err);
      res.status(400).json({ error: 'Ungültige Konfiguration' });
    }
  });

  // Statische Dateien (das eigentliche Dashboard-Frontend).
  app.use(express.static(join(__dirname, 'public')));

  app.listen(port, () => {
    console.log(`🌐 Dashboard läuft auf http://localhost:${port}`);
  });

  return app;
}

// Übernimmt nur bekannte Felder und erzwingt sinnvolle Typen/Grenzen.
function sanitizeConfig(guildId, body = {}) {
  const cur = getGuildConfig(guildId);
  const bool = (v, d) => (typeof v === 'boolean' ? v : d);
  const str = (v, d) => (typeof v === 'string' ? v : d);
  const int = (v, d, min, max) => {
    const n = Number.parseInt(v, 10);
    if (Number.isNaN(n)) return d;
    return Math.min(max, Math.max(min, n));
  };
  const list = (v, d) =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : d;

  const t = body.tickets || {};
  const a = body.antiraid || {};
  const m = body.automod || {};
  const w = body.welcome || {};
  const l = body.logging || {};
  const ap = body.applications || {};
  const ar = body.autorole || {};
  const lv = body.levels || {};
  const sg = body.suggestions || {};

  const validActions = ['kick', 'ban', 'lockdown', 'alert'];

  return {
    guildId,
    tickets: {
      enabled: bool(t.enabled, cur.tickets.enabled),
      logChannelId: str(t.logChannelId, cur.tickets.logChannelId),
      panelMessage: str(t.panelMessage, cur.tickets.panelMessage).slice(0, 2000),
      types: Array.isArray(t.types)
        ? t.types
            .filter((x) => x && String(x.name || '').trim())
            .slice(0, 20)
            .map((x) => ({
              id: String(x.id || '').trim(),
              name: String(x.name).slice(0, 60),
              emoji: String(x.emoji || '').slice(0, 40),
              categoryId: String(x.categoryId || ''),
              welcomeMessage: String(x.welcomeMessage || '').slice(0, 2000),
              staffRoleIds: list(x.staffRoleIds, [])
            }))
        : cur.tickets.types
    },
    antiraid: {
      enabled: bool(a.enabled, cur.antiraid.enabled),
      joinThreshold: int(a.joinThreshold, cur.antiraid.joinThreshold, 2, 100),
      joinWindowSeconds: int(a.joinWindowSeconds, cur.antiraid.joinWindowSeconds, 1, 600),
      action: validActions.includes(a.action) ? a.action : cur.antiraid.action,
      minAccountAgeMinutes: int(a.minAccountAgeMinutes, cur.antiraid.minAccountAgeMinutes, 0, 525600),
      alertChannelId: str(a.alertChannelId, cur.antiraid.alertChannelId)
    },
    automod: {
      enabled: bool(m.enabled, cur.automod.enabled),
      antiInvite: bool(m.antiInvite, cur.automod.antiInvite),
      antiSpam: bool(m.antiSpam, cur.automod.antiSpam),
      spamMessageCount: int(m.spamMessageCount, cur.automod.spamMessageCount, 2, 50),
      spamWindowSeconds: int(m.spamWindowSeconds, cur.automod.spamWindowSeconds, 1, 60),
      antiMassMention: bool(m.antiMassMention, cur.automod.antiMassMention),
      maxMentions: int(m.maxMentions, cur.automod.maxMentions, 1, 50),
      bannedWords: list(m.bannedWords, cur.automod.bannedWords),
      ignoredRoleIds: list(m.ignoredRoleIds, cur.automod.ignoredRoleIds)
    },
    welcome: {
      enabled: bool(w.enabled, cur.welcome.enabled),
      channelId: str(w.channelId, cur.welcome.channelId),
      message: str(w.message, cur.welcome.message).slice(0, 2000),
      leaveEnabled: bool(w.leaveEnabled, cur.welcome.leaveEnabled),
      leaveMessage: str(w.leaveMessage, cur.welcome.leaveMessage).slice(0, 2000)
    },
    logging: {
      enabled: bool(l.enabled, cur.logging.enabled),
      channelId: str(l.channelId, cur.logging.channelId),
      messageDelete: bool(l.messageDelete, cur.logging.messageDelete),
      messageEdit: bool(l.messageEdit, cur.logging.messageEdit),
      memberJoin: bool(l.memberJoin, cur.logging.memberJoin),
      memberLeave: bool(l.memberLeave, cur.logging.memberLeave),
      modActions: bool(l.modActions, cur.logging.modActions)
    },
    applications: {
      enabled: bool(ap.enabled, cur.applications.enabled),
      panelMessage: str(ap.panelMessage, cur.applications.panelMessage).slice(0, 2000),
      types: Array.isArray(ap.types)
        ? ap.types
            .filter((x) => x && String(x.name || '').trim())
            .slice(0, 20)
            .map((x) => ({
              id: String(x.id || '').trim(),
              name: String(x.name).slice(0, 60),
              emoji: String(x.emoji || '').slice(0, 40),
              reviewChannelId: String(x.reviewChannelId || ''),
              acceptedRoleId: String(x.acceptedRoleId || ''),
              questions: list(x.questions, []).slice(0, 5)
            }))
        : cur.applications.types
    },
    autorole: {
      enabled: bool(ar.enabled, cur.autorole.enabled),
      roleId: str(ar.roleId, cur.autorole.roleId)
    },
    levels: {
      enabled: bool(lv.enabled, cur.levels.enabled),
      xpPerMessage: int(lv.xpPerMessage, cur.levels.xpPerMessage, 1, 100),
      cooldownSeconds: int(lv.cooldownSeconds, cur.levels.cooldownSeconds, 0, 3600),
      announce: bool(lv.announce, cur.levels.announce),
      announceChannelId: str(lv.announceChannelId, cur.levels.announceChannelId)
    },
    suggestions: {
      enabled: bool(sg.enabled, cur.suggestions.enabled),
      channelId: str(sg.channelId, cur.suggestions.channelId)
    },
    selfRoles: Array.isArray(body.selfRoles)
      ? body.selfRoles
          .filter((r) => r && typeof r.roleId === 'string' && r.roleId.trim())
          .slice(0, 25)
          .map((r) => ({
            roleId: String(r.roleId).trim(),
            label: String(r.label || '').slice(0, 80),
            emoji: String(r.emoji || '').slice(0, 40)
          }))
      : cur.selfRoles
  };
}
