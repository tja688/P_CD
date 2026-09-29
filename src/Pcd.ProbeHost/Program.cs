using System;
using System.Text;
using Pcd.Kernel;

namespace Pcd.ProbeHost
{
    public static class Program
    {
        public static int Main(string[] args)
        {
            Console.OutputEncoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false);
            if (args.Length != 1)
            {
                Console.Error.Write("用法：Pcd.ProbeHost <request-json>\n");
                return 1;
            }

            Console.Out.Write(KernelProbe.Invoke(args[0]));
            Console.Out.Write('\n');
            return 0;
        }
    }
}
