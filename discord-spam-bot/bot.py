import os

import discord
from discord import app_commands

# Maximale Anzahl an Nachrichten pro Befehl, damit der Bot nicht von
# Discord wegen Rate-Limits gesperrt wird.
MAX_COUNT = 10


class SpamBot(discord.Client):
    def __init__(self) -> None:
        # Slash-Commands brauchen keine "message content"-Berechtigung,
        # daher reichen die Standard-Intents.
        intents = discord.Intents.default()
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)

    async def setup_hook(self) -> None:
        # Slash-Commands global bei Discord registrieren.
        await self.tree.sync()


client = SpamBot()


@client.event
async def on_ready() -> None:
    print(f"Eingeloggt als {client.user} (ID: {client.user.id})")


@client.tree.command(name="spam", description="Spamt ein Wort in den Chat.")
@app_commands.describe(
    wort="Das Wort, das gespammt werden soll.",
    anzahl=f"Wie oft (1-{MAX_COUNT}). Standard: 5.",
)
async def spam(interaction: discord.Interaction, wort: str, anzahl: int = 5) -> None:
    anzahl = max(1, min(anzahl, MAX_COUNT))

    # Erste Antwort auf den Slash-Command.
    await interaction.response.send_message(wort)

    # Restliche Nachrichten in den gleichen Channel schreiben.
    for _ in range(anzahl - 1):
        await interaction.channel.send(wort)


def main() -> None:
    token = os.environ.get("DISCORD_TOKEN")
    if not token:
        raise SystemExit(
            "Bitte die Umgebungsvariable DISCORD_TOKEN setzen "
            "(siehe README.md)."
        )
    client.run(token)


if __name__ == "__main__":
    main()
