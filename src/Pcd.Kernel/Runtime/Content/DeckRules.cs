using System;
using System.Collections.Generic;

namespace Pcd.Kernel
{
    public static class DeckRules
    {
        public const int DeckSize = 15;
        public const int LoadCap = 90;

        public static string[] Validate(ContentCatalog catalog, string[] cards, string[]? backs)
        {
            if (catalog == null)
            {
                throw new ArgumentNullException(nameof(catalog));
            }

            if (cards == null)
            {
                throw new ArgumentNullException(nameof(cards));
            }

            var issues = new List<string>();
            if (cards.Length != DeckSize)
            {
                issues.Add("牌组必须是 15 张，当前是 " + cards.Length + "。");
            }

            if (backs != null && backs.Length != cards.Length)
            {
                issues.Add("卡背数量必须和卡牌数量一致。");
            }

            int load = 0;
            var counts = new Dictionary<string, int>(StringComparer.Ordinal);
            var order = new List<string>();
            for (int i = 0; i < cards.Length; i++)
            {
                string id = cards[i];
                CardDefinition card;
                try
                {
                    card = catalog.RequireCard(id);
                }
                catch (ContentException)
                {
                    issues.Add("内容 " + id + "：牌组引用的卡牌不存在。");
                    continue;
                }

                load += card.Load;
                if (backs != null && i < backs.Length && backs[i].Length > 0)
                {
                    BackDefinition? back = catalog.FindBack(backs[i]);
                    if (back == null)
                    {
                        issues.Add("内容 " + backs[i] + "：牌组引用的卡背不存在。");
                    }
                    else
                    {
                        load += back.Load;
                    }
                }

                if (!counts.ContainsKey(id))
                {
                    counts[id] = 0;
                    order.Add(id);
                }

                counts[id] = counts[id] + 1;
            }

            if (load > LoadCap)
            {
                issues.Add("牌组总负荷是 " + load + "，不能超过 90。");
            }

            order.Sort(StringComparer.Ordinal);
            for (int i = 0; i < order.Count; i++)
            {
                string id = order[i];
                CardDefinition card = catalog.RequireCard(id);
                int cap = CopyCap(card.Rarity);
                if (cap < 0)
                {
                    issues.Add("内容 " + id + "：没有稀有度，不能计入构筑。");
                    continue;
                }

                if (counts[id] > cap)
                {
                    issues.Add("内容 " + id + "：同名最多 " + cap + " 张，当前是 " + counts[id] + "。");
                }
            }

            return issues.ToArray();
        }

        public static int CopyCap(string rarity)
        {
            if (rarity == "white")
            {
                return 3;
            }

            if (rarity == "blue")
            {
                return 2;
            }

            if (rarity == "gold")
            {
                return 1;
            }

            return -1;
        }
    }
}
