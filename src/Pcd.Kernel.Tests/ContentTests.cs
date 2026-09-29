using System;
using NUnit.Framework;
using Pcd.Kernel;

namespace Pcd.Kernel.Tests
{
    public sealed class ContentTests
    {
        [Test]
        public void Blank_catalog_exposes_working_names()
        {
            ContentCatalog catalog = ContentCatalog.LoadBlank();

            Assert.That(catalog.DefaultMonster, Is.EqualTo("monster.b01"));
            Assert.That(catalog.DefaultDeck.Length, Is.EqualTo(15));
            Assert.That(catalog.NameOf("card.p01"), Is.EqualTo("一点"));
            Assert.That(catalog.NameOf("monster.b01"), Is.EqualTo("白板怪物"));
            Assert.That(catalog.Hash, Does.Match("^[0-9a-f]{64}$"));
        }

        [Test]
        public void Duplicate_card_id_names_the_id()
        {
            const string yaml = @"
cards:
  - id: card.a01
    points: 1
  - id: card.a01
    points: 2
monster:
  id: monster.a01
  intents:
    - card.a01
";

            var error = Assert.Throws<ContentException>(() => ContentCatalog.Parse(yaml));

            Assert.That(error!.Message, Does.Contain("card.a01"));
            Assert.That(error.Message, Does.Contain("标识重复"));
        }

        [Test]
        public void Missing_intent_card_names_the_reference()
        {
            const string yaml = @"
cards:
  - id: card.a01
    points: 1
monster:
  id: monster.a01
  intents:
    - card.missing
";

            var error = Assert.Throws<ContentException>(() => ContentCatalog.Parse(yaml));

            Assert.That(error!.Message, Does.Contain("monster.a01"));
            Assert.That(error.Message, Does.Contain("card.missing"));
        }

        [Test]
        public void Yaml_reads_nested_maps_and_inline_flow()
        {
            const string yaml = @"
board:
  - cell: 5
    modifiers:
      - source: cover
        amount: -2
intents: [card.a01, card.a02]
inline:
  - { cell: 1, card: card.a01, owner: player }
";
            YamlNode root = YamlNode.Parse(yaml);

            Assert.That(root.Get("board")!.Items[0].Get("modifiers")!.Items[0].Int("amount"), Is.EqualTo(-2));
            Assert.That(root.Get("intents")!.Items[1].Scalar, Is.EqualTo("card.a02"));
            Assert.That(root.Get("inline")!.Items[0].Str("owner"), Is.EqualTo("player"));
            Assert.That(root.Get("inline")!.Items[0].Int("cell"), Is.EqualTo(1));
        }
    }
}
