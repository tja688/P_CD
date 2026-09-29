using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using Pcd.Kernel;

[assembly: SupportedOSPlatform("browser")]

return 0;

public partial class KernelBridge
{
    [JSExport]
    public static string Invoke(string requestJson)
    {
        return KernelProbe.Invoke(requestJson);
    }
}
