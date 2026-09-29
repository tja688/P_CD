using NUnit.Framework;
using Pcd.Kernel;

namespace Pcd.Kernel.Tests
{
    public sealed class ContentRulesTests
    {
        [Test]
        public void Starter_decks_pass_construction_limits()
        {
            ContentCatalog catalog = ContentCatalog.LoadRules();

            Assert.That(DeckRules.Validate(catalog, Deck(catalog, "deck.science"), null), Is.Empty);
            Assert.That(DeckRules.Validate(catalog, Deck(catalog, "deck.mystery"), null), Is.Empty);
            Assert.That(DeckRules.Validate(catalog, Deck(catalog, "deck.religion"), null), Is.Empty);
        }

        [Test]
        public void Deck_rules_name_the_offending_card()
        {
            ContentCatalog catalog = ContentCatalog.LoadRules();
            string[] tooMany = new string[15];
            for (int i = 0; i < 15; i++)
            {
                tooMany[i] = "card.c001";
            }

            string[] issues = DeckRules.Validate(catalog, tooMany, null);

            Assert.That(string.Join("\n", issues), Does.Contain("card.c001"));
        }

        [Test]
        public void Sixteen_cards_are_rejected()
        {
            ContentCatalog catalog = ContentCatalog.LoadRules();
            var cards = new string[16];
            for (int i = 0; i < 16; i++)
            {
                cards[i] = "card.c002";
            }

            string[] issues = DeckRules.Validate(catalog, cards, null);

            Assert.That(string.Join("\n", issues), Does.Contain("15"));
        }

        [Test]
        public void Generated_text_uses_working_keyword_names()
        {
            ContentCatalog catalog = ContentCatalog.LoadRules();

            Assert.That(catalog.TextOf("card.c001"), Is.EqualTo("入场：选择一张敌方卡牌，添加解析标记。"));
            Assert.That(catalog.TextOf("card.c002"), Is.EqualTo(""));
            Assert.That(catalog.TextOf("card.c003"), Is.EqualTo("入场：选择一张敌方卡牌，若其拥有解析标记，则清除解析标记，使其点数-5，否则使其点数-3。"));
            Assert.That(catalog.TextOf("card.c004"), Is.EqualTo("入场：为本卡添加解析标记。"));
            Assert.That(catalog.TextOf("card.c005"), Is.EqualTo("驻场：每有一张拥有解析标记的卡牌，本卡点数+2。"));
            Assert.That(catalog.TextOf("card.c006"), Is.EqualTo("入场：献祭2，在镜像格生成一张本卡的复制，当其中一张离场，移除另一张。"));
            Assert.That(catalog.TextOf("card.c007"), Is.EqualTo("入场：献祭1，本卡点数+己方弃牌堆的卡牌数量。"));
            Assert.That(catalog.TextOf("card.c008"), Is.EqualTo("入场：将一张本卡的复制洗入牌组。离场：将一张本卡的复制洗入牌组。"));
            Assert.That(catalog.TextOf("card.c009"), Is.EqualTo("入场：献祭1。"));
            Assert.That(catalog.TextOf("card.c010"), Is.EqualTo("入场：随机将至多三张弃牌堆卡牌洗入牌组。"));
            Assert.That(catalog.TextOf("card.c011"), Is.EqualTo("入场：获得2点信仰。"));
            Assert.That(catalog.TextOf("card.c012"), Is.EqualTo("驻场：己方回合结束时，获得1点信仰。"));
            Assert.That(catalog.TextOf("card.c013"), Is.EqualTo("入场：消耗4点信仰，选择一张己方卡牌，使其获得返魂，使其点数+2。"));
            Assert.That(catalog.TextOf("card.c014"), Is.EqualTo("驻场：己方回合开始时，消耗1点信仰，本卡点数+1。"));
            Assert.That(catalog.TextOf("card.c015"), Is.EqualTo("入场：消耗4点信仰，选择一张敌方卡牌，转化为信徒。"));
            Assert.That(catalog.TextOf("card.c016"), Is.EqualTo("驻场：己方回合结束时，选择一张相邻敌方卡牌，添加解析标记。"));
            Assert.That(catalog.TextOf("card.c017"), Is.EqualTo("驻场：己方回合结束时，选择一张拥有解析标记的敌方卡牌，使其点数-2。"));
            Assert.That(catalog.TextOf("card.c018"), Is.EqualTo("驻场：计时3，随机选择一张敌方卡牌，使其点数-3，添加解析标记。"));
            Assert.That(catalog.TextOf("card.c019"), Is.EqualTo("驻场：计时3，本卡点数+3。"));
            Assert.That(catalog.TextOf("card.c020"), Is.EqualTo("入场：选择一张卡牌，使其点数+6，并获得计时2：点数-2。"));
            Assert.That(catalog.TextOf("card.c021"), Is.EqualTo(""));
            Assert.That(catalog.TextOf("card.c022"), Is.EqualTo("入场：为相邻敌方卡牌添加解析标记。"));
            Assert.That(catalog.TextOf("card.c023"), Is.EqualTo("入场：选择一张拥有解析标记的敌方卡牌，使其点数-2。"));
            Assert.That(catalog.TextOf("card.m001"), Is.EqualTo("驻场：敌方卡牌打出到相邻格时，为其添加解析标记。"));
            Assert.That(catalog.TextOf("card.m002"), Is.EqualTo("驻场：敌方每打出一张法术卡，己方卡牌的计时-1。"));
            Assert.That(catalog.TextOf("card.m003"), Is.EqualTo("驻场：每当有卡牌打出到污染格，本卡点数+2。"));
        }

        [Test]
        public void Missing_ability_reference_names_the_card()
        {
            const string yaml = @"
cards:
  - id: card.a01
    points: 1
    abilities:
      - actions:
          - kind: grant
            ability: ability.missing
monster:
  id: monster.a01
  intents:
    - card.a01
";

            var error = Assert.Throws<ContentException>(() => ContentCatalog.Parse(yaml));

            Assert.That(error!.Message, Does.Contain("card.a01"));
            Assert.That(error.Message, Does.Contain("ability.missing"));
        }

        private static string[] Deck(ContentCatalog catalog, string id)
        {
            for (int i = 0; i < catalog.Decks.Length; i++)
            {
                if (catalog.Decks[i].Id == id)
                {
                    return catalog.Decks[i].Cards;
                }
            }

            Assert.Fail("找不到牌组 " + id);
            return System.Array.Empty<string>();
        }
    }
}
