using System;
using System.IO;
using System.Text;
using Pcd.Kernel;

namespace Pcd.Sim
{
    public static class SimProgram
    {
        public static int Main(string[] args)
        {
            Console.OutputEncoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false);
            return Run(args, Console.Out, Console.Error);
        }

        public static int Run(string[] args, TextWriter stdout, TextWriter stderr)
        {
            if (args == null || args.Length == 0 || (args.Length == 1 && args[0] == "version"))
            {
                stdout.Write(KernelVersion.Text);
                stdout.Write('\n');
                return 0;
            }

            stderr.Write("用法：pcd-sim version\n");
            return 1;
        }
    }
}
