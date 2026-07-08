// Ersetzt Platzhalter in Willkommens-/Abschiedsnachrichten.
// {user}   → Erwähnung des Mitglieds
// {tag}    → Name#0000
// {server} → Servername
// {count}  → Mitgliederzahl
export function formatMemberMessage(template, member) {
  return (template || '')
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{tag}', member.user.tag)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{count}', String(member.guild.memberCount));
}
