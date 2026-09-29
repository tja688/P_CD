using System;

namespace Pcd.Kernel
{
    public static class MatchProtocol
    {
        public static string PlayoutHash(ulong seed)
        {
            return PlaySeed(seed).Hash;
        }

        public static string Invoke(string requestJson)
        {
            if (requestJson == null)
            {
                throw new ArgumentNullException(nameof(requestJson));
            }

            JsonValue root = JsonReader.Parse(requestJson);
            string command = root.Require("command").String();
            if (command != "playout")
            {
                throw new ArgumentException("未知命令：" + command);
            }

            ulong seed = root.Require("seed").ULong();
            int max = 400;
            JsonValue? maxNode = root.Find("max");
            if (maxNode != null && !maxNode.IsNull)
            {
                max = maxNode.Int();
            }

            PlayoutResult result = PlaySeed(seed, max);
            var writer = new JsonWriter();
            writer.BeginObject();
            writer.Name("version");
            writer.Value(KernelVersion.Text);
            writer.Name("protocol");
            writer.Value(RuleProtocol.Version);
            writer.Name("hash");
            writer.Value(result.Hash);
            writer.Name("winner");
            writer.Value(result.Winner);
            writer.Name("reason");
            writer.Value(result.Reason);
            writer.Name("rounds");
            writer.Value(result.Rounds);
            writer.Name("events");
            if (result.Session == null)
            {
                throw new InvalidOperationException("对局没有会话。");
            }

            writer.Value(result.Session.Events.Count);
            writer.Name("decisions");
            writer.Value(result.Decisions);
            writer.EndObject();
            return writer.ToString();
        }

        private static PlayoutResult PlaySeed(ulong seed, int maxDecisions = 400)
        {
            ContentCatalog catalog = ContentCatalog.LoadBlank();
            if (catalog.DefaultMonster == null)
            {
                throw new InvalidOperationException("白板内容没有默认怪物。");
            }

            var setup = new MatchSetup
            {
                Seed = seed,
                MonsterId = catalog.DefaultMonster,
                Deck = catalog.DefaultDeck,
                OpportunitiesPerTurn = 1
            };
            return RandomPlayout.Play(catalog, setup, maxDecisions, null);
        }
    }
}
