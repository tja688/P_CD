using System;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Pcd.Kernel;

namespace Pcd.DevHost
{
    public static class Program
    {
        public static int Main(string[] args)
        {
            int port = 7420;
            if (args.Length == 1 && !int.TryParse(args[0], out port))
            {
                Console.Error.WriteLine("用法：Pcd.DevHost [端口]");
                return 1;
            }

            var listener = new HttpListener();
            listener.Prefixes.Add("http://127.0.0.1:" + port.ToString() + "/");
            listener.Start();
            Console.WriteLine("pcd-devhost ws://127.0.0.1:" + port.ToString() + "/");
            var gate = new ManualResetEventSlim(false);
            Console.CancelKeyPress += (_, eventArgs) =>
            {
                eventArgs.Cancel = true;
                gate.Set();
            };
            listener.BeginGetContext(Accepted, listener);
            gate.Wait();
            listener.Close();
            return 0;
        }

        private static void Accepted(IAsyncResult result)
        {
            var listener = (HttpListener)result.AsyncState!;
            HttpListenerContext context;
            try
            {
                context = listener.EndGetContext(result);
            }
            catch (ObjectDisposedException)
            {
                return;
            }
            catch (HttpListenerException)
            {
                return;
            }

            try
            {
                listener.BeginGetContext(Accepted, listener);
            }
            catch (ObjectDisposedException)
            {
                return;
            }

            ThreadPool.QueueUserWorkItem(_ => Serve(context));
        }

        private static void Serve(HttpListenerContext context)
        {
            try
            {
                if (!context.Request.IsWebSocketRequest)
                {
                    context.Response.StatusCode = 400;
                    context.Response.Close();
                    return;
                }

                System.Net.WebSockets.HttpListenerWebSocketContext socket = context.AcceptWebSocketAsync(null).GetAwaiter().GetResult();
                var buffer = new byte[1024 * 256];
                var incoming = new StringBuilder();
                while (socket.WebSocket.State == System.Net.WebSockets.WebSocketState.Open)
                {
                    System.Net.WebSockets.WebSocketReceiveResult received = socket.WebSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None).GetAwaiter().GetResult();
                    if (received.MessageType == System.Net.WebSockets.WebSocketMessageType.Close)
                    {
                        break;
                    }

                    incoming.Append(Encoding.UTF8.GetString(buffer, 0, received.Count));
                    if (!received.EndOfMessage)
                    {
                        continue;
                    }

                    string request = incoming.ToString();
                    incoming.Clear();
                    string response;
                    try
                    {
                        response = KernelEntry.Invoke(request);
                    }
                    catch (Exception ex)
                    {
                        response = "{\"error\":" + Quote(ex.Message) + "}";
                    }

                    byte[] payload = Encoding.UTF8.GetBytes(response);
                    socket.WebSocket.SendAsync(new ArraySegment<byte>(payload), System.Net.WebSockets.WebSocketMessageType.Text, true, CancellationToken.None).GetAwaiter().GetResult();
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine(ex.Message);
                try
                {
                    context.Response.Abort();
                }
                catch (Exception)
                {
                }
            }
        }

        private static string Quote(string value)
        {
            return "\"" + value.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
        }
    }
}
