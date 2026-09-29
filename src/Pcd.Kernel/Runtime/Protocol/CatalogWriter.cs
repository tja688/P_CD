namespace Pcd.Kernel
{
    internal static class CatalogWriter
    {
        public static void Write(JsonWriter writer, ContentCatalog catalog, string contentId)
        {
            writer.BeginObject();
            writer.Name("protocol");
            writer.Value(RuleProtocol.Version);
            writer.Name("kernel");
            writer.Value(KernelVersion.Text);
            writer.Name("content");
            writer.Value(catalog.Hash);
            writer.Name("contentId");
            writer.Value(contentId);
            writer.Name("defaultMonster");
            writer.Value(catalog.DefaultMonster);
            writer.Name("defaultDeck");
            WriteStrings(writer, catalog.DefaultDeck);
            writer.Name("decks");
            writer.BeginArray();
            for (int i = 0; i < catalog.Decks.Length; i++)
            {
                DeckDefinition deck = catalog.Decks[i];
                writer.BeginObject();
                writer.Name("id");
                writer.Value(deck.Id);
                writer.Name("name");
                writer.Value(deck.Name);
                writer.Name("cards");
                WriteStrings(writer, deck.Cards);
                writer.EndObject();
            }

            writer.EndArray();
            writer.Name("monsters");
            writer.BeginArray();
            for (int i = 0; i < catalog.Monsters.Length; i++)
            {
                MonsterDefinition monster = catalog.Monsters[i];
                writer.BeginObject();
                writer.Name("id");
                writer.Value(monster.Id);
                writer.Name("name");
                writer.Value(monster.Name);
                writer.Name("starting");
                writer.BeginArray();
                for (int s = 0; s < monster.Starting.Length; s++)
                {
                    StartingPlacement place = monster.Starting[s];
                    writer.BeginObject();
                    writer.Name("card");
                    writer.Value(place.CardId);
                    writer.Name("random");
                    writer.Value(place.RandomCell);
                    writer.Name("cell");
                    writer.Value(place.Cell);
                    writer.EndObject();
                }

                writer.EndArray();
                writer.Name("intents");
                WriteStrings(writer, monster.Intents);
                writer.Name("skills");
                WriteStrings(writer, monster.Skills);
                writer.EndObject();
            }

            writer.EndArray();
            writer.Name("cards");
            writer.BeginArray();
            for (int i = 0; i < catalog.Cards.Length; i++)
            {
                CardDefinition card = catalog.Cards[i];
                writer.BeginObject();
                writer.Name("id");
                writer.Value(card.Id);
                writer.Name("name");
                writer.Value(card.Name);
                writer.Name("spell");
                writer.Value(card.IsSpell);
                writer.Name("points");
                writer.Value(card.Points);
                writer.Name("load");
                writer.Value(card.Load);
                writer.Name("rarity");
                writer.Value(card.Rarity);
                writer.Name("countdown");
                writer.Value(CountdownOf(card));
                writer.Name("text");
                writer.Value(catalog.TextOf(card.Id));
                writer.EndObject();
            }

            writer.EndArray();
            WriteNamed(writer, "statuses", catalog.Statuses, status => status.Id, status => status.Name);
            WriteNamed(writer, "resources", catalog.Resources, resource => resource.Id, resource => resource.Name);
            WriteNamed(writer, "keywords", catalog.Keywords, keyword => keyword.Id, keyword => keyword.Name);
            writer.EndObject();
        }

        private static int CountdownOf(CardDefinition card)
        {
            int countdown = 0;
            for (int i = 0; i < card.Abilities.Length; i++)
            {
                if (card.Abilities[i].Trigger == "countdown" && card.Abilities[i].Countdown > countdown)
                {
                    countdown = card.Abilities[i].Countdown;
                }
            }

            return countdown;
        }

        private static void WriteNamed<T>(JsonWriter writer, string name, T[] items, System.Func<T, string> id, System.Func<T, string> label)
        {
            writer.Name(name);
            writer.BeginArray();
            for (int i = 0; i < items.Length; i++)
            {
                writer.BeginObject();
                writer.Name("id");
                writer.Value(id(items[i]));
                writer.Name("name");
                writer.Value(label(items[i]));
                writer.EndObject();
            }

            writer.EndArray();
        }

        private static void WriteStrings(JsonWriter writer, string[] values)
        {
            writer.BeginArray();
            for (int i = 0; i < values.Length; i++)
            {
                writer.Value(values[i]);
            }

            writer.EndArray();
        }
    }
}
