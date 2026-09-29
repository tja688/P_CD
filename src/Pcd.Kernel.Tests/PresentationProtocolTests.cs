using NUnit.Framework;

namespace Pcd.Kernel.Tests
{
    public sealed class PresentationProtocolTests
    {
        [Test]
        public void Catalog_lists_the_three_playable_decks_and_monsters()
        {
            string json = KernelEntry.Invoke("{\"command\":\"catalog\",\"content\":\"rules\"}");

            Assert.That(json, Does.Contain("\"deck.science\""));
            Assert.That(json, Does.Contain("\"deck.mystery\""));
            Assert.That(json, Does.Contain("\"deck.religion\""));
            Assert.That(json, Does.Contain("\"monster.001\""));
            Assert.That(json, Does.Contain("\"monster.003\""));
            Assert.That(json, Does.Contain("弱点采样机"));
            Assert.That(json, Does.Contain("入场：选择一张敌方卡牌，添加解析标记。"));
        }

        [Test]
        public void Rules_match_can_start_and_the_view_names_statuses()
        {
            string started = KernelEntry.Invoke("{\"command\":\"start\",\"content\":\"rules\",\"monster\":\"monster.003\",\"seed\":3}");
            Assert.That(started, Does.Contain("\"pending\""));
            Assert.That(started, Does.Contain("cell-polluted"));

            string snapshot = RawJsonString(started, "snapshot");
            string request = "{\"command\":\"view\",\"content\":\"rules\",\"audience\":\"player\",\"snapshot\":" + snapshot + "}";
            string view = KernelEntry.Invoke(request);

            Assert.That(view, Does.Contain("\"statuses\""));
            Assert.That(view, Does.Contain("\"timer\""));
            Assert.That(view, Does.Contain("\"pools\""));
            Assert.That(view, Does.Contain("\"polluted\":true"));
            Assert.That(view, Does.Contain("card.m003"));
        }

        [Test]
        public void Monster_countdown_intent_enters_with_timer()
        {
            string advance = KernelEntry.Invoke("{\"command\":\"start\",\"content\":\"rules\",\"monster\":\"monster.002\",\"seed\":1}");
            for (int step = 0; step < 40; step++)
            {
                string snapshot = RawJsonString(advance, "snapshot");
                string view = KernelEntry.Invoke("{\"command\":\"view\",\"content\":\"rules\",\"audience\":\"player\",\"snapshot\":" + snapshot + "}");
                if (view.Contains("\"card\":\"card.c018\"") || view.Contains("\"card\":\"card.c019\""))
                {
                    Assert.That(view, Does.Contain("\"timerMax\":3"));
                    return;
                }

                string? option = FirstOptionId(advance);
                Assert.That(option, Is.Not.Null);
                advance = KernelEntry.Invoke("{\"command\":\"answer\",\"content\":\"rules\",\"snapshot\":" + snapshot + ",\"option\":" + option + "}");
            }

            Assert.Fail("计时意图没有入场。");
        }

        [Test]
        public void Blank_start_still_uses_the_blank_catalog()
        {
            string started = KernelEntry.Invoke("{\"command\":\"start\",\"seed\":1}");

            Assert.That(started, Does.Contain("card.m901"));
            Assert.That(started, Does.Not.Contain("card.m003"));
        }

        private static string? FirstOptionId(string json)
        {
            int options = json.IndexOf("\"options\":[", System.StringComparison.Ordinal);
            if (options < 0)
            {
                return null;
            }

            return RawJsonString(json.Substring(options), "id");
        }

        private static string RawJsonString(string json, string key)
        {
            string token = "\"" + key + "\":";
            int start = json.IndexOf(token, System.StringComparison.Ordinal);
            Assert.That(start, Is.GreaterThanOrEqualTo(0));
            int valueStart = start + token.Length;
            Assert.That(json[valueStart], Is.EqualTo('"'));
            int i = valueStart + 1;
            while (i < json.Length)
            {
                if (json[i] == '\\')
                {
                    i += 2;
                    continue;
                }

                if (json[i] == '"')
                {
                    return json.Substring(valueStart, i - valueStart + 1);
                }

                i++;
            }

            Assert.Fail("字符串没有结束。");
            return "";
        }
    }
}
