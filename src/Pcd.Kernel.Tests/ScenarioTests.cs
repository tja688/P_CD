using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;

namespace Pcd.Kernel.Tests
{
    public sealed class ScenarioTests
    {
        public static IEnumerable<TestCaseData> Files()
        {
            string dir = Path.Combine(RepoRoot(), "scenarios", "rules");
            foreach (string file in Directory.GetFiles(dir, "*.yaml").OrderBy(path => path))
            {
                yield return new TestCaseData(file).SetName(Path.GetFileNameWithoutExtension(file));
            }
        }

        [TestCaseSource(nameof(Files))]
        public void Rules_scenario(string file)
        {
            ScenarioRunner.Run(file);
        }

        private static string RepoRoot()
        {
            DirectoryInfo? dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir != null)
            {
                if (File.Exists(Path.Combine(dir.FullName, "global.json")))
                {
                    return dir.FullName;
                }

                dir = dir.Parent;
            }

            throw new DirectoryNotFoundException("Could not find global.json above the test output.");
        }
    }
}
