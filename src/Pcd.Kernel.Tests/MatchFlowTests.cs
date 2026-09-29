using System;
using NUnit.Framework;
using Pcd.Kernel;

namespace Pcd.Kernel.Tests
{
    public sealed class MatchFlowTests
    {
        [Test]
        public void Snapshot_roundtrip_continues_with_the_same_events()
        {
            ContentCatalog catalog = ContentCatalog.LoadBlank();
            MatchSession original = Start(catalog, 3);
            AdvanceResult pending = original.Advance();
            string snapshot = original.ToSnapshot();
            MatchSession restored = MatchSession.FromSnapshot(snapshot, catalog);

            Assert.That(restored.ToSnapshot(), Is.EqualTo(snapshot));
            string option = pending.Pending!.Options[0].Id;
            original.SubmitAndAdvance(option);
            restored.SubmitAndAdvance(option);

            Assert.That(restored.EventHash(), Is.EqualTo(original.EventHash()));
        }

        [Test]
        public void Snapshot_rejects_a_different_kernel_version()
        {
            ContentCatalog catalog = ContentCatalog.LoadBlank();
            MatchSession session = Start(catalog, 1);
            session.Advance();
            string snapshot = session.ToSnapshot().Replace("\"kernel\":\"" + KernelVersion.Text + "\"", "\"kernel\":\"9.9.9\"", StringComparison.Ordinal);

            var error = Assert.Throws<InvalidOperationException>(() => MatchSession.FromSnapshot(snapshot, catalog));

            Assert.That(error!.Message, Does.Contain("内核版本不符"));
            Assert.That(error.Message, Does.Contain("9.9.9"));
        }

        [Test]
        public void Replay_reproduces_the_event_hash()
        {
            ContentCatalog catalog = ContentCatalog.LoadBlank();
            PlayoutResult played = RandomPlayout.Play(catalog, Setup(catalog, 11), 400, null);
            MatchSession replayed = MatchSession.PlayReplay(played.ReplayJson, catalog);

            Assert.That(replayed.EventHash(), Is.EqualTo(played.Hash));
            Assert.That(played.Winner, Is.Not.EqualTo("unfinished"));
        }

        [Test]
        public void Replay_rejects_a_different_content_hash()
        {
            ContentCatalog catalog = ContentCatalog.LoadBlank();
            PlayoutResult played = RandomPlayout.Play(catalog, Setup(catalog, 2), 50, null);
            string replay = played.ReplayJson.Replace(catalog.Hash, new string('a', catalog.Hash.Length), StringComparison.Ordinal);

            var error = Assert.Throws<InvalidOperationException>(() => MatchSession.PlayReplay(replay, catalog));

            Assert.That(error!.Message, Does.Contain("内容哈希不符"));
        }

        [Test]
        public void Copy_does_not_share_later_answers()
        {
            ContentCatalog catalog = ContentCatalog.LoadBlank();
            MatchSession original = Start(catalog, 5);
            AdvanceResult pending = original.Advance();
            int hand = original.View("player").HandCount;
            MatchSession copy = original.Copy();

            copy.SubmitAndAdvance(pending.Pending!.Options[0].Id);

            Assert.That(original.View("player").HandCount, Is.EqualTo(hand));
            Assert.That(original.Advance().Pending, Is.Not.Null);
            Assert.That(original.EventHash(), Is.Not.EqualTo(copy.EventHash()));
        }

        [Test]
        public void Public_view_hides_the_hand_but_shows_the_board()
        {
            ContentCatalog catalog = ContentCatalog.LoadBlank();
            MatchSession session = Start(catalog, 1);
            session.Advance();
            MatchView player = session.View("player");
            MatchView publicly = session.View("public");

            Assert.That(player.Hand.Length, Is.GreaterThan(0));
            Assert.That(publicly.Hand.Length, Is.EqualTo(0));
            Assert.That(publicly.HandCount, Is.EqualTo(player.HandCount));
            Assert.That(publicly.Cells[4].Card, Is.Not.Null);
            Assert.That(player.Deck.Length, Is.EqualTo(0));
            Assert.That(session.View("omniscient").Deck.Length, Is.EqualTo(player.DeckCount));
        }

        [Test]
        public void Void_card_stays_in_the_void()
        {
            ContentCatalog catalog = BlankMonster(out string monsterId, out string unitId, out string intentId);
            var position = new MatchPosition
            {
                MonsterId = monsterId,
                Phase = "player-action",
                Round = 1,
                Opportunities = 1,
                PlayerHand = new[] { new PositionCard { CardId = unitId } },
                PlayerVoid = new[] { new PositionCard { CardId = intentId } }
            };
            MatchSession session = MatchSession.FromPosition(catalog, position);
            AdvanceResult pending = session.Advance();

            Assert.That(session.View("omniscient").PlayerVoid.Length, Is.EqualTo(1));

            session.SubmitAndAdvance("end-turn");

            Assert.That(session.View("omniscient").PlayerVoid[0].CardId, Is.EqualTo(intentId));
            Assert.That(pending.Pending!.Actor, Is.EqualTo("player"));
        }

        [Test]
        public void Same_seed_playout_hash_is_stable()
        {
            // Seed 7 on the blank catalog: monster wins by full board in round 6.
            const string expected = "96f27ba2583b6cca8c40621caf045478525129fb1b2016d862213427792cf206";

            Assert.That(MatchProtocol.PlayoutHash(7), Is.EqualTo(expected));
            Assert.That(MatchProtocol.PlayoutHash(7), Is.EqualTo(expected));
        }

        [Test]
        public void Probe_command_still_routes_through_the_entry_point()
        {
            const string request = "{\"seed\":42,\"count\":1}";
            const string expected = "{\"version\":\"0.1.0\",\"values\":[13679457532755275413]}";

            Assert.That(KernelEntry.Invoke(request), Is.EqualTo(expected));
        }

        private static MatchSession Start(ContentCatalog catalog, ulong seed)
        {
            return MatchSession.Start(catalog, Setup(catalog, seed));
        }

        private static MatchSetup Setup(ContentCatalog catalog, ulong seed)
        {
            return new MatchSetup
            {
                Seed = seed,
                MonsterId = catalog.DefaultMonster!,
                Deck = catalog.DefaultDeck
            };
        }

        private static ContentCatalog BlankMonster(out string monsterId, out string unitId, out string intentId)
        {
            unitId = "card.tu01";
            intentId = "card.tu02";
            monsterId = "monster.tu01";
            return new ContentCatalog(
                new[]
                {
                    new CardDefinition(unitId, "单位", false, 2),
                    new CardDefinition(intentId, "意图", false, 2)
                },
                new[]
                {
                    new MonsterDefinition(monsterId, "怪物", Array.Empty<StartingPlacement>(), new[] { intentId })
                },
                Array.Empty<string>(),
                monsterId);
        }
    }
}
